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

function canonicalDriverCode(value) {
  return normalizeText(value).replace(/\s+/g, " ").toUpperCase()
}

function displayDriverName(code) {
  return canonicalDriverCode(code)
}

function readScheduleRows(filePath) {
  const workbook = XLSX.readFile(filePath, { cellDates: true })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false })

  return rows
    .map((row) => ({
      team: normalizeText(row["DRIVER WEEK OFF SCHEDULE"]),
      make: normalizeText(row["__EMPTY"]),
      vehicleNumber: normalizeText(row["__EMPTY_1"]),
      registrationNumber: normalizeText(row["__EMPTY_2"]),
      driver: canonicalDriverCode(row["__EMPTY_3"]),
      reliefDriver: canonicalDriverCode(row["__EMPTY_12"]),
    }))
    .filter((row) => row.vehicleNumber || row.driver || row.reliefDriver)
    .filter(
      (row) =>
        row.vehicleNumber.toUpperCase() !== "VEHICLE NO." &&
        row.driver !== "DRIVER" &&
        row.team.toUpperCase() !== "TEAM"
    )
}

async function clearFleetData(client) {
  await client.query(`
    begin;
      update public.users set linked_driver_id = null where linked_driver_id is not null;
      update public.drivers set current_leave_id = null, current_allocation_id = null, current_vehicle_id = null;
      update public.vehiclesc set current_allocation_id = null, current_driver_id = null;

      delete from public.allocation_history;
      delete from public.allocations;
      delete from public.driver_leave;
      delete from public.driver_state_history;
      delete from public.driver_roster_periods;
      delete from public.employee_roster_import_rows;
      delete from public.employee_roster_imports;
      delete from public.audit_logs;
      delete from public.cron_job_runs;
      delete from public.vehicle_rotation_plan_items;
      delete from public.drivers;
      delete from public.vehiclesc;
    commit;
  `)
}

async function insertVehicle(client, row) {
  const inserted = await client.query(
    `
      insert into public.vehiclesc (
        vehicle_number,
        registration_number,
        display_label,
        make,
        model,
        vehicle_type,
        status,
        needs_allocation,
        allocation_locked,
        veh_allocated_flag
      )
      values ($1, $2, $3, $4, $5, $6, 'active', true, false, false)
      returning id
    `,
    [
      row.vehicleNumber,
      row.registrationNumber || null,
      [row.vehicleNumber, row.registrationNumber].filter(Boolean).join(" - ") || row.vehicleNumber,
      row.make || null,
      row.make ? `${row.make} ${row.vehicleNumber}` : row.vehicleNumber,
      row.make || null,
    ]
  )

  return inserted.rows[0].id
}

async function insertDriver(client, code) {
  const displayName = displayDriverName(code)
  const inserted = await client.query(
    `
      insert into public.drivers (
        employee_number,
        driver_code,
        display_name,
        first_name,
        surname,
        status,
        available,
        current_state,
        state_started_on,
        current_state_days,
        warning_level,
        is_allocatable,
        roster_status
      )
      values ($1, $1, $2, $3, $4, 'OFF', true, 'off', current_date, 0, 'normal', true, 'unknown')
      returning id
    `,
    [code, displayName, displayName, displayName]
  )

  const driverId = inserted.rows[0].id

  await client.query(
    `
      insert into public.driver_state_history (
        driver_id,
        state,
        effective_from,
        source,
        reason_code
      )
      values ($1, 'off', current_date, 'import', 'week_off_schedule_import')
    `,
    [driverId]
  )

  await client.query(`select public.refresh_driver_snapshot($1, null)`, [driverId])

  return driverId
}

async function main() {
  const workbookPath = process.argv[2] || "./driver_week_off_schedule_v2.xlsx"
  const rows = readScheduleRows(workbookPath)
  const client = new Client(requireConnectionConfig())

  console.log("Workbook rows:", rows.length)
  await client.connect()

  try {
    console.log("Clearing existing fleet data...")
    await clearFleetData(client)

    await client.query("begin")
    await client.query("set local statement_timeout = 0")

    const seenVehicles = new Set()
    const seenDrivers = new Set()
    let vehicleCount = 0
    let driverCount = 0
    let reliefDriverCount = 0

    for (const row of rows) {
      if (row.vehicleNumber && !seenVehicles.has(row.vehicleNumber.toLowerCase())) {
        await insertVehicle(client, row)
        seenVehicles.add(row.vehicleNumber.toLowerCase())
        vehicleCount++
      }

      if (row.driver && !seenDrivers.has(row.driver)) {
        await insertDriver(client, row.driver)
        seenDrivers.add(row.driver)
        driverCount++
      }

      if (row.reliefDriver && !seenDrivers.has(row.reliefDriver)) {
        await insertDriver(client, row.reliefDriver)
        seenDrivers.add(row.reliefDriver)
        driverCount++
        reliefDriverCount++
      }
    }

    await client.query("commit")

    const verification = await client.query(`
      select
        (select count(*) from public.drivers) as drivers,
        (select count(*) from public.vehiclesc) as vehicles,
        (select count(*) from public.driver_state_history) as driver_states
    `)

    console.log("Week-off schedule import completed.")
    console.log(
      JSON.stringify(
        {
          importedVehicles: vehicleCount,
          importedDrivers: driverCount,
          reliefDriversIncluded: reliefDriverCount,
          verification: verification.rows[0],
        },
        null,
        2
      )
    )
  } catch (error) {
    await client.query("rollback").catch(() => {})
    console.error("Week-off schedule import failed.")
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
