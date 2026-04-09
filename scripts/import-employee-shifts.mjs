import dotenv from "dotenv"
import { Client } from "pg"
import XLSX from "xlsx"

dotenv.config({ path: ".env.local" })
dotenv.config()

function sanitizeConnectionString(value) {
  if (!value) return value
  return value.startsWith("DATABASE_URL=") ? value.slice("DATABASE_URL=".length) : value
}

function requireConnectionConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: sanitizeConnectionString(process.env.DATABASE_URL),
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    }
  }

  if (process.env.SUPABASE_DB_URL) {
    return {
      connectionString: sanitizeConnectionString(process.env.SUPABASE_DB_URL),
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    }
  }

  throw new Error("Missing database connection. Set DATABASE_URL or SUPABASE_DB_URL.")
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function excelDateToIso(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d)).toISOString().slice(0, 10)
  }

  const text = normalizeText(value)
  if (!text) return null

  const parsed = new Date(text)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10)
  }

  return null
}

function readRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) throw new Error("Workbook does not contain any worksheets")

  const worksheet = workbook.Sheets[sheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: null, raw: true })
  return { sheetName, rows }
}

async function matchDriver(client, row) {
  const employeeNumber = normalizeText(row["Employee Number"])
  const firstName = normalizeText(row["First Name"])
  const lastName = normalizeText(row["Last Name"])

  if (employeeNumber) {
    const exactEmployee = await client.query(
      `
        select id
        from public.drivers
        where lower(coalesce(employee_number, '')) = lower($1)
           or lower(driver_code) = lower($1)
        limit 2
      `,
      [employeeNumber]
    )

    if (exactEmployee.rowCount === 1) {
      return { status: "matched", driverId: exactEmployee.rows[0].id }
    }

    if (exactEmployee.rowCount > 1) {
      return { status: "ambiguous", driverId: null }
    }
  }

  const nameMatches = await client.query(
    `
      select id
      from public.drivers
      where lower(coalesce(first_name, '')) = lower($1)
        and lower(coalesce(surname, '')) = lower($2)
      limit 2
    `,
    [firstName, lastName]
  )

  if (nameMatches.rowCount === 1) {
    return { status: "matched", driverId: nameMatches.rows[0].id }
  }

  if (nameMatches.rowCount > 1) {
    return { status: "ambiguous", driverId: null }
  }

  return { status: "unmatched", driverId: null }
}

async function main() {
  const workbookPath = process.argv[2] || "basis/employee data.xlsx"
  const client = new Client(requireConnectionConfig())
  const { sheetName, rows } = readRows(workbookPath)

  console.log("Reading workbook:", workbookPath)
  console.log("Sheet:", sheetName, "Rows:", rows.length)

  await client.connect()

  try {
    await client.query("begin")
    await client.query("set local statement_timeout = 0")

    const importJob = await client.query(
      `
        insert into public.employee_roster_imports (
          file_name,
          status,
          started_at,
          summary
        )
        values ($1, 'processing', timezone('utc', now()), '{}'::jsonb)
        returning id
      `,
      [workbookPath.split(/[\\\\/]/).pop()]
    )

    const importId = importJob.rows[0].id
    let matchedRows = 0
    let unmatchedRows = 0
    let ambiguousRows = 0
    let errorRows = 0

    const insertedPeriods = []
    const matchedDriverIds = new Set()
    const driverPeriods = new Map()
    const today = new Date().toISOString().slice(0, 10)

    for (let index = 0; index < rows.length; index++) {
      const rawRow = rows[index]
      const employeeNumber = normalizeText(rawRow["Employee Number"])
      const firstName = normalizeText(rawRow["First Name"])
      const lastName = normalizeText(rawRow["Last Name"])
      const start = excelDateToIso(rawRow["Start"])
      const end = excelDateToIso(rawRow["End"])

      let matchStatus = "invalid"
      let matchedDriverId = null
      let errors = []

      if (!employeeNumber || !firstName || !lastName || !start || !end) {
        errors.push("Missing required employee or date fields")
        errorRows++
      } else if (end < start) {
        errors.push("End date is before start date")
        errorRows++
      } else {
        const match = await matchDriver(client, rawRow)
        matchStatus = match.status
        matchedDriverId = match.driverId

        if (match.status === "matched" && match.driverId) {
          matchedRows++
          matchedDriverIds.add(match.driverId)
          driverPeriods.set(match.driverId, { start, end, employeeNumber })
          insertedPeriods.push({
            driverId: match.driverId,
            employeeNumber,
            start,
            end,
          })
        } else if (match.status === "ambiguous") {
          ambiguousRows++
        } else {
          unmatchedRows++
        }
      }

      const stagedRow = await client.query(
        `
          insert into public.employee_roster_import_rows (
            import_id,
            row_number,
            employee_number,
            first_name,
            last_name,
            period_start,
            period_end,
            matched_driver_id,
            match_status,
            errors,
            raw_payload
          )
          values ($1, $2, $3, $4, $5, $6, $7, $8, $9::public.roster_match_status, $10::jsonb, $11::jsonb)
          returning id
        `,
        [
          importId,
          index + 1,
          employeeNumber || null,
          firstName || null,
          lastName || null,
          start,
          end,
          matchedDriverId,
          matchStatus,
          JSON.stringify(errors),
          JSON.stringify(rawRow),
        ]
      )

      if (matchStatus === "matched" && matchedDriverId) {
        insertedPeriods[insertedPeriods.length - 1].sourceRowId = stagedRow.rows[0].id
      }
    }

    if (matchedDriverIds.size > 0) {
      await client.query(
        `
          delete from public.driver_roster_periods
          where driver_id = any($1::uuid[])
        `,
        [Array.from(matchedDriverIds)]
      )

      for (const period of insertedPeriods) {
        await client.query(
          `
            insert into public.driver_roster_periods (
              driver_id,
              employee_number,
              period_start,
              period_end,
              source_import_id,
              source_row_id
            )
            values ($1, $2, $3, $4, $5, $6)
          `,
          [
            period.driverId,
            period.employeeNumber,
            period.start,
            period.end,
            importId,
            period.sourceRowId ?? null,
          ]
        )
      }

    }

    await client.query(
      `
        update public.employee_roster_imports
        set
          status = 'completed',
          total_rows = $2,
          matched_rows = $3,
          unmatched_rows = $4,
          ambiguous_rows = $5,
          error_rows = $6,
          finished_at = timezone('utc', now()),
          summary = $7::jsonb
        where id = $1
      `,
      [
        importId,
        rows.length,
        matchedRows,
        unmatchedRows,
        ambiguousRows,
        errorRows,
        JSON.stringify({
          matchedRows,
          unmatchedRows,
          ambiguousRows,
          errorRows,
          refreshedDrivers: matchedDriverIds.size,
        }),
      ]
    )

    await client.query("commit")

    for (const driverId of matchedDriverIds) {
      const period = driverPeriods.get(driverId)
      const desiredState =
        period && period.start <= today && period.end >= today ? "active" : "off"

      await client.query(
        `
          select public.upsert_driver_state_tx(
            $1,
            $2::public.driver_state,
            'employee_shift_import',
            'Updated from employee data workbook',
            null,
            'import'
          )
        `,
        [driverId, desiredState]
      )

      if (desiredState === "active" && period?.start) {
        await client.query(
          `
            update public.driver_state_history
            set effective_from = $2
            where driver_id = $1
              and effective_to is null
              and state = 'active'
          `,
          [driverId, period.start]
        )
      }

      await client.query(`select public.refresh_driver_snapshot($1, null)`, [driverId])
    }

    console.log("Shift import completed.")
    console.log(
      JSON.stringify(
        {
          importId,
          totalRows: rows.length,
          matchedRows,
          unmatchedRows,
          ambiguousRows,
          errorRows,
          refreshedDrivers: matchedDriverIds.size,
        },
        null,
        2
      )
    )
  } catch (error) {
    await client.query("rollback").catch(() => {})
    console.error("Shift import failed.")
    console.error(error)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
