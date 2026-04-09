# Fleet backend implementation

## Added structure

- `supabase/sql/fleet_backend_full.sql`
- `lib/supabase/*`
- `lib/auth/*`
- `lib/validators/*`
- `lib/repositories/*`
- `lib/services/*`
- `lib/actions/*`
- `app/api/cron/*`
- `app/api/imports/roster/route.ts`
- `app/api/imports/fleet-master/route.ts`
- `app/api/imports/schedule-template/route.ts`
- `app/api/dashboard/summary/route.ts`

## Required env

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
SUPABASE_STORAGE_BUCKET_ROSTER=roster-imports
```

## Apply SQL

Run the full SQL file in Supabase SQL Editor.

Before production rollout:

1. Confirm `drivers.id` and `vehiclesc.id` are `uuid`.
2. Clean any duplicate `driver_code`, `employee_number`, `vehicle_number`, or `registration_number` rows.
3. Create the `roster-imports` bucket if you will use file imports.

## Workbook usage

Use the files in `basis/` like this:

- `UPDATED FLEET LIST 2025 - MetaLoads.xlsx`
  - Import this as master data.
  - `Fleet` sheet populates and updates `vehiclesc`.
  - `Employees` sheet populates and updates `drivers`.
- `Scheduling sample.xlsx`
  - Use this as the scheduling and rotation template.
  - `Truck` sheet feeds `vehicle_rotation_plan_items`.
  - Auto-allocation now checks due rotation items first and uses the imported `Next driver` where a mapped vehicle and driver exist.
  - If no usable mapped rotation exists, auto-allocation falls back to the generic available-driver search.

## Cron endpoints

- `POST /api/cron/monitor`
- `POST /api/cron/auto-allocate`

Headers:

```http
Authorization: Bearer <CRON_SECRET>
```

## Import endpoints

- `POST /api/imports/fleet-master`
- `POST /api/imports/schedule-template`
- `POST /api/imports/roster`
