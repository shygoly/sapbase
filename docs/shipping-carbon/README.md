# Shipping Carbon Management - Developer Guide

## Overview

The shipping carbon module implements DDD architecture under `apps/api/src/shipping-carbon/` with:

- **Domain layer**: pure calculation engines (CII, FuelEU, EU ETS, Fuel Cost), value objects, aggregates
- **Application layer**: services, commands, contracts
- **Infrastructure layer**: TypeORM entities/repositories, Excel parser, file storage, schedulers
- **API layer**: NestJS controllers per feature

---

## API Endpoints

All routes are prefixed `/api/shipping` and require JWT auth + organization header `x-organization-id`.

| Method | Path | Controller | Description |
|--------|------|-----------|-------------|
| GET | `/ships` | ShipsController | List vessels |
| POST | `/ships` | ShipsController | Create vessel |
| GET | `/charters` | ChartersController | List charter periods |
| POST | `/charters` | ChartersController | Create charter period |
| GET | `/voyages` | VoyagesController | List voyages |
| POST | `/voyages/import` | VoyagesController | Import xlsx |
| GET | `/constants/years` | ReportsController | Available report years |
| GET | `/reports/cii` | ReportsController | CII annual report |
| GET | `/reports/fueleu` | ReportsController | FuelEU annual report |
| GET | `/reports/eu-ets` | ReportsController | EU ETS annual report |
| GET | `/reports/fuel-cost` | FuelCostController | Fuel cost scenario analysis |
| GET | `/reports/home-overview` | ReportsController | Dashboard overview |
| GET | `/reports/scenario-analysis` | ReportsController | Scenario analysis |
| POST | `/reports/export` | ReportExportController | Export report to xlsx + archive |
| POST | `/recalculate` | RecalculateController | Force recalculate + snapshot |
| GET | `/report-center` | ReportCenterController | List archived reports |
| GET | `/report-center/:id/download` | ReportCenterController | Download archived report |

---

## Voyage Import Template

Excel file with the following columns (row 1 = header):

| Column | Field | Required | Notes |
|--------|-------|----------|-------|
| A | voyage_number | Yes | Unique per vessel |
| B | departure_port | Yes | UN/LOCODE (e.g. CNSHA) |
| C | arrival_port | Yes | UN/LOCODE |
| D | departure_date | Yes | YYYY-MM-DD |
| E | arrival_date | Yes | YYYY-MM-DD |
| F | distance_nm | Yes | Nautical miles |
| G | cargo_tonnes | No | Metric tonnes |
| H | fuel_type | Yes | Must match system fuel type code |
| I | fuel_consumed_mt | Yes | Metric tonnes consumed |

Rows with validation errors are skipped; the response includes per-row error details.

---

## Report Field Dictionary

### Common fields (all report types)

| Field | Type | Description |
|-------|------|-------------|
| `metrics` | `Array<{label, value, trend?}>` | KPI cards for dashboard |
| `rows` | `Array<object>` | Tabular data rows |

### CII Report rows

| Field | Description |
|-------|-------------|
| `year` | Reporting year |
| `attainedCii` | Attained CII value |
| `requiredCii` | Required CII value |
| `rating` | A/B/C/D/E rating |
| `voyageCount` | Number of voyages included |

### FuelEU Report rows

| Field | Description |
|-------|-------------|
| `year` | Reporting year |
| `ghgIntensity` | GHG intensity (gCO2eq/MJ) |
| `targetIntensity` | Regulatory target |
| `compliance` | `compliant` \| `non-compliant` |
| `penaltyMultiplier` | From compliance history (manual input) |

### EU ETS Report rows

| Field | Description |
|-------|-------------|
| `year` | Reporting year |
| `co2Tonnes` | Total CO2 emissions |
| `allowancesRequired` | ETS allowances needed |
| `phase` | ETS phase (50%/70%/100%) |

### Fuel Cost Report rows

| Field | Description |
|-------|-------------|
| `year` | Projection year |
| `scenario` | `baseline` \| `moderate` \| `aggressive` |
| `fuelCostUsd` | Estimated fuel cost (USD) |
| `fuelBasis` | `system` \| `tenant` |

---

## Report Basis (fuelBasis parameter)

The `fuelBasis` query parameter controls which fuel price data source is used:

- `system` (default): uses `system_fuel_types` + `fuel_prices` master data
- `tenant`: uses `tenant_fuel_types` with tenant-specific prices

When `fuelBasis` is set, snapshots are bypassed and the report is always recomputed live.

---

## Report Center

Every call to `POST /api/shipping/reports/export` performs a **dual-write**:
1. Generates an xlsx workbook buffer
2. Writes the file to `SHIPPING_REPORTS_DIR` (default: `./uploads/shipping-reports/`)
3. Creates a `report_center_records` row with `fileUrl` pointing to the stored file

The report center (`GET /api/shipping/report-center`) lists all archived exports for the organization. Download via `GET /api/shipping/report-center/:id/download`.

### Environment variables

```env
SHIPPING_REPORTS_DIR=./uploads/shipping-reports   # Storage directory
APP_URL=http://localhost:3051                       # Public base URL for download links
```

---

## Snapshot & Recalculation

Reports are cached as snapshots in `calculation_snapshots`. On first request, a snapshot is created automatically. To force a fresh calculation:

```
POST /api/shipping/recalculate
{
  "shipId": "uuid",
  "year": 2024,
  "framework": "cii",
  "fuelBasis": "system"
}
```

The nightly reconciliation job (`NightlyReconciliationJob`) runs at 02:00 UTC to:
1. Claim unclaimed voyages against active charter periods
2. Mark stale snapshots for recalculation
