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
      source: "DATABASE_URL",
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    }
  }

  if (process.env.SUPABASE_DB_URL) {
    return {
      connectionString: sanitizeConnectionString(process.env.SUPABASE_DB_URL),
      source: "SUPABASE_DB_URL",
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    }
  }

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_DB_PASSWORD) {
    const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0]
    const host = process.env.SUPABASE_DB_HOST || `db.${projectRef}.supabase.co`
    const port = Number(process.env.SUPABASE_DB_PORT || 5432)
    const database = process.env.SUPABASE_DB_NAME || "postgres"
    const user = process.env.SUPABASE_DB_USER || "postgres"

    return {
      connectionString: `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(
        process.env.SUPABASE_DB_PASSWORD
      )}@${host}:${port}/${database}`,
      source: "NEXT_PUBLIC_SUPABASE_URL + SUPABASE_DB_PASSWORD",
      ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false },
    }
  }

  throw new Error("Missing database connection. Set DATABASE_URL or SUPABASE_DB_URL.")
}

function normalizeText(value) {
  return String(value ?? "").trim()
}

function nullableText(value) {
  const text = normalizeText(value)
  return text ? text : null
}

function parseDate(value) {
  const text = normalizeText(value)
  if (!text || /place holder/i.test(text)) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

function readWorkbook(filePath) {
  const workbook = XLSX.readFile(filePath)
  const employees = XLSX.utils.sheet_to_json(workbook.Sheets.Employees, { defval: "", raw: false })
  const fleet = XLSX.utils.sheet_to_json(workbook.Sheets.Fleet, { defval: "", raw: false })
  return { employees, fleet }
}

async function upsertEmployee(client, row) {
  const employeeNumber = normalizeText(row["Employee Number"])
  const firstName = normalizeText(row["First Name"])
  const lastName = normalizeText(row["Last Name"])
  const displayName = normalizeText(row["NR for displayu"])

  if (!employeeNumber || !firstName) return { skipped: true }

  const payload = {
    employee_number: employeeNumber,
    driver_code: employeeNumber,
    display_name: displayName || `${employeeNumber} - ${firstName}`,
    first_name: firstName,
    surname: lastName,
    license_expiry_date: parseDate(row["License expires"]),
    pdp_expiry_date: parseDate(row["PDP expires"]),
    training_last_done: nullableText(row["Training last done"]),
  }

  const existing = await client.query(
    `
      select id
      from public.drivers
      where lower(coalesce(employee_number, '')) = lower($1)
         or lower(driver_code) = lower($1)
      limit 1
    `,
    [employeeNumber]
  )

  let driverId
  let action

  if (existing.rowCount) {
    driverId = existing.rows[0].id
    action = "updated"
    await client.query(
      `
        update public.drivers
        set
          employee_number = $2,
          driver_code = $2,
          display_name = $3,
          first_name = $4,
          surname = $5,
          license_expiry_date = $6,
          pdp_expiry_date = $7,
          training_last_done = $8,
          updated_at = timezone('utc', now())
        where id = $1
      `,
      [
        driverId,
        payload.employee_number,
        payload.display_name,
        payload.first_name,
        payload.surname,
        payload.license_expiry_date,
        payload.pdp_expiry_date,
        payload.training_last_done,
      ]
    )
  } else {
    action = "created"
    const inserted = await client.query(
      `
        insert into public.drivers (
          employee_number,
          driver_code,
          display_name,
          first_name,
          surname,
          license_expiry_date,
          pdp_expiry_date,
          training_last_done,
          status,
          available,
          current_state,
          state_started_on,
          current_state_days,
          warning_level,
          is_allocatable,
          roster_status
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, 'OFF', true, 'off', current_date, 0, 'normal', true, 'unknown')
        returning id
      `,
      [
        payload.employee_number,
        payload.driver_code,
        payload.display_name,
        payload.first_name,
        payload.surname,
        payload.license_expiry_date,
        payload.pdp_expiry_date,
        payload.training_last_done,
      ]
    )
    driverId = inserted.rows[0].id
  }

  await client.query(
    `
      insert into public.driver_state_history (driver_id, state, effective_from, source, reason_code)
      select $1, 'off', current_date, 'import', 'employee_workbook_import'
      where not exists (
        select 1
        from public.driver_state_history
        where driver_id = $1
          and effective_to is null
      )
    `,
    [driverId]
  )

  await client.query(`select public.refresh_driver_snapshot($1, null)`, [driverId])

  return { skipped: false, action, id: driverId }
}

async function upsertVehicle(client, row) {
  const assetNumber = normalizeText(row["Asset nr"])
  const registrationNumber = normalizeText(row["reg number"])
  const displayLabel = normalizeText(row["Display nr"])

  if (!assetNumber || !registrationNumber) return { skipped: true }

  const payload = {
    vehicle_number: assetNumber,
    registration_number: registrationNumber,
    display_label: displayLabel || `${assetNumber} - ${registrationNumber}`,
    make: nullableText(row["Type"]),
    model: nullableText(row["Display nr"]),
    vehicle_type: nullableText(row["Type"]),
    vin_number: nullableText(row["Vin number"]),
    trailer_1_registration: nullableText(row["Trailer 1"]),
    trailer_2_registration: nullableText(row["Trailer 2"]),
    dekra_service_status: nullableText(row["Dekra service"]),
  }

  const existing = await client.query(
    `
      select id
      from public.vehiclesc
      where lower(coalesce(registration_number, '')) = lower($1)
         or lower(coalesce(vehicle_number, '')) = lower($2)
      limit 1
    `,
    [registrationNumber, assetNumber]
  )

  let vehicleId
  let action

  if (existing.rowCount) {
    vehicleId = existing.rows[0].id
    action = "updated"
    await client.query(
      `
        update public.vehiclesc
        set
          vehicle_number = $2,
          registration_number = $3,
          display_label = $4,
          make = $5,
          model = $6,
          vehicle_type = $7,
          vin_number = $8,
          trailer_1_registration = $9,
          trailer_2_registration = $10,
          dekra_service_status = $11,
          status = coalesce(status, 'active'),
          updated_at = timezone('utc', now())
        where id = $1
      `,
      [
        vehicleId,
        payload.vehicle_number,
        payload.registration_number,
        payload.display_label,
        payload.make,
        payload.model,
        payload.vehicle_type,
        payload.vin_number,
        payload.trailer_1_registration,
        payload.trailer_2_registration,
        payload.dekra_service_status,
      ]
    )
  } else {
    action = "created"
    const inserted = await client.query(
      `
        insert into public.vehiclesc (
          vehicle_number,
          registration_number,
          display_label,
          make,
          model,
          vehicle_type,
          vin_number,
          trailer_1_registration,
          trailer_2_registration,
          dekra_service_status,
          status,
          needs_allocation,
          allocation_locked,
          veh_allocated_flag
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'active', true, false, false)
        returning id
      `,
      [
        payload.vehicle_number,
        payload.registration_number,
        payload.display_label,
        payload.make,
        payload.model,
        payload.vehicle_type,
        payload.vin_number,
        payload.trailer_1_registration,
        payload.trailer_2_registration,
        payload.dekra_service_status,
      ]
    )
    vehicleId = inserted.rows[0].id
  }

  await client.query(`select public.refresh_vehicle_snapshot($1)`, [vehicleId])

  return { skipped: false, action, id: vehicleId }
}

async function main() {
  const workbookPath = process.argv[2] || "basis/UPDATED FLEET LIST 2025 - MetaLoads.xlsx"
  const client = new Client(requireConnectionConfig())

  console.log("Reading workbook:", workbookPath)
  const { employees, fleet } = readWorkbook(workbookPath)

  console.log("Connecting to database...")
  await client.connect()

  try {
    await client.query("begin")
    await client.query("set local statement_timeout = 0")

    let createdDrivers = 0
    let updatedDrivers = 0
    let skippedDrivers = 0

    for (const row of employees) {
      const result = await upsertEmployee(client, row)
      if (result.skipped) skippedDrivers++
      else if (result.action === "created") createdDrivers++
      else updatedDrivers++
    }

    let createdVehicles = 0
    let updatedVehicles = 0
    let skippedVehicles = 0

    for (const row of fleet) {
      const result = await upsertVehicle(client, row)
      if (result.skipped) skippedVehicles++
      else if (result.action === "created") createdVehicles++
      else updatedVehicles++
    }

    await client.query("commit")

    console.log("Import completed.")
    console.log(`Drivers: created=${createdDrivers}, updated=${updatedDrivers}, skipped=${skippedDrivers}`)
    console.log(`Vehicles: created=${createdVehicles}, updated=${updatedVehicles}, skipped=${skippedVehicles}`)
  } catch (error) {
    await client.query("rollback").catch(() => {})
    console.error("Import failed.")
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
