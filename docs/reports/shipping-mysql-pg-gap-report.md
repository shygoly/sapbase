# Shipping MySQL Dump vs PostgreSQL Gap Report

| MySQL Table | PostgreSQL Table | Status | Source Rows | Missing Fields | Blocking Gaps |
| --- | --- | --- | ---: | --- | --- |
| eu_port | shipping_ports | partial | 53600 | create_by, create_time, update_by, update_time, remark | - |
| fuel_type | shipping_system_fuel_types + shipping_tenant_fuel_types + shipping_gwp_values + shipping_csf_values + shipping_fuel_prices | split | 67 | tenant_id, fuel_class, cf_co2, cf_ch4, cf_n2o, status, create_by, create_time, update_by, update_time, remark, csf_co2, csf_ch4, csf_n2o, cf_co2eq | - |
| annual_configuration | shipping_year_parameters + shipping_regulation_parameters | split | 21 | status, create_by, create_time, update_by, update_time, remark | - |
| cii_config | shipping_cii_ship_type_parameters | partial | 23 | ship_type_id, status, create_by, create_time, update_by, update_time, remark | - |
| ship_info | shipping_ships | partial | 37 | tenant_id, create_by, create_time, update_by, update_time, remark | - |
| ship_charter_info | shipping_charters | partial | 43 | tenant_id, create_by, create_time, update_by, update_time, remark | - |
| ship_voyage | shipping_voyages + shipping_voyage_fuels | partial | 56 | tenant_id, create_by, create_time, update_by, update_time, remark | - |
| cii_evaluation_detail | - | recompute | 48 | id, tenant_id, ship_id, year, start_time, end_time, emission_value, benchmark_value, cii_required, score, rating, status, create_by, create_time, update_by, update_time, remark | - |
| eu_ets_detail | - | recompute | 834 | id, tenant_id, ship_id, voyage_id, emission_value, penalty, create_by, create_time, update_by, update_time, remark, forecast_value | - |
| fuel_eu_calculation_result | - | recompute | 50 | id, tenant_id, ship_id, assessment_year, start_time, end_time, well_to_tank_ship, tank_to_wake_ship, co2eq_emitted_ttw, co2eq_emitted_wtt, ghg_actual_value, calculation_status, remark, create_by, create_time, update_by, update_time, energy_used_on_board, shore_power_input, base_penalty_amount, excess_penalty_amount, total_penalty_amount | - |

## eu_port

- PostgreSQL: shipping_ports
- Status: partial
- Source Rows: 53600
- Mapped Fields: port_code→code
- Missing Fields: create_by, create_time, update_by, update_time, remark
- Extra PG Fields: createdAt, updatedAt, name, country, isEu
- Blocking Gaps: -

## fuel_type

- PostgreSQL: shipping_system_fuel_types + shipping_tenant_fuel_types + shipping_gwp_values + shipping_csf_values + shipping_fuel_prices
- Status: split
- Source Rows: 67
- Mapped Fields: fuel→name, lcv→lcv, co2eq_wtt→wellToTankFactor, co2eq_ttw→tankToWakeFactor, co2eq_wtw→co2eqWtw, cslip→slipFactor, gwp_co2→gwpCo2, gwp_ch4→gwpCh4, gwp_n2o→gwpN2o, price→defaultPrice
- Missing Fields: tenant_id, fuel_class, cf_co2, cf_ch4, cf_n2o, status, create_by, create_time, update_by, update_time, remark, csf_co2, csf_ch4, csf_n2o, cf_co2eq
- Extra PG Fields: createdAt, updatedAt, code, co2Factor, organizationId, gas, gwp, csf, fuelCode, priceUsdPerTon
- Blocking Gaps: -

## annual_configuration

- PostgreSQL: shipping_year_parameters + shipping_regulation_parameters
- Status: split
- Source Rows: 21
- Mapped Fields: config_year→year, ghg_intensity_target→fuelEuTarget, cii_reduction_rate→reductionRatio, fuel_eu_penalty→excessPenaltyPerTon, eua_price→euaPrice
- Missing Fields: status, create_by, create_time, update_by, update_time, remark
- Extra PG Fields: createdAt, updatedAt, etsCoverageRatio, ghgTarget, euaPriceEur
- Blocking Gaps: -

## cii_config

- PostgreSQL: shipping_cii_ship_type_parameters
- Status: partial
- Source Rows: 23
- Mapped Fields: applicable_standard→applicableStandard, range_min→rangeMin, range_max→rangeMax, constant_a→referenceCii, constant_c→requiredCii, d1→d1, d2→d2, d3→d3, d4→d4, constant_capacity→constantCapacity, use_max→useMax
- Missing Fields: ship_type_id, status, create_by, create_time, update_by, update_time, remark
- Extra PG Fields: createdAt, updatedAt, shipType, correctionFactor
- Blocking Gaps: -

## ship_info

- PostgreSQL: shipping_ships
- Status: partial
- Source Rows: 37
- Mapped Fields: ship_name→name, imo_number→imo, ship_type_id→shipTypeId, gross_tonnage→gt, dead_weight→dwt, status→status, cii_measure_standard→ciiMeasureStandard, cii_applicable→ciiApplicable, wind_assisted_propulsion→windAssistedPropulsion, flag_state→flagState, main_engine_power→mainEnginePower, auxiliary_engine_power→auxiliaryEnginePower, is_wind_power_applicable→isWindPowerApplicable, wind_equipment_installation_time→windEquipmentInstallationTime, constant_a→constantA, constant_capacity→constantCapacity, constant_c→constantC
- Missing Fields: tenant_id, create_by, create_time, update_by, update_time, remark
- Extra PG Fields: createdAt, updatedAt, organizationId, type, ciiRating, speed
- Blocking Gaps: -

## ship_charter_info

- PostgreSQL: shipping_charters
- Status: partial
- Source Rows: 43
- Mapped Fields: ship_id→shipId, contract_no→contractNo, charterer_name→charterer, lease_start_date→startDate, lease_end_date→endDate, lease_type→allocation, contract_path→contractPath, main_fuel_type→mainFuelType, auxiliary_fuel_type→auxiliaryFuelType, main_fuel_consumption→mainFuelConsumption, auxiliary_fuel_consumption→auxiliaryFuelConsumption, shore_electricity→shoreElectricityKwh, bdn_path→bdnPath, is_auto_generated→isAutoGenerated
- Missing Fields: tenant_id, create_by, create_time, update_by, update_time, remark
- Extra PG Fields: createdAt, updatedAt, organizationId, status
- Blocking Gaps: -

## ship_voyage

- PostgreSQL: shipping_voyages + shipping_voyage_fuels
- Status: partial
- Source Rows: 56
- Mapped Fields: ship_id→shipId, start_port→departurePort, start_port_code→departurePortCode, end_port→arrivalPort, end_port_code→arrivalPortCode, departure_time→departureTime, arrival_time→arrivalTime, arrival_purpose→arrivalPurpose, route_distance→distanceNm, total_eu_ets→totalEuEts, charter_info_id→charterId, charterer_name→chartererName, through_ice→throughIce, fuel_type→fuelCode, fuel_consumption→consumption, auxiliary_fuel_type→fuelCode, auxiliary_fuel_consumption→consumption, shore_power_consumption→shorePowerConsumptionMj, bdn_path→bdnPath
- Missing Fields: tenant_id, create_by, create_time, update_by, update_time, remark
- Extra PG Fields: createdAt, updatedAt, organizationId, voyageNo, departureDate, arrivalDate, emissions, status, voyageId, isMain
- Blocking Gaps: -

## cii_evaluation_detail

- PostgreSQL: N/A
- Status: recompute
- Source Rows: 48
- Mapped Fields: -
- Missing Fields: id, tenant_id, ship_id, year, start_time, end_time, emission_value, benchmark_value, cii_required, score, rating, status, create_by, create_time, update_by, update_time, remark
- Extra PG Fields: -
- Blocking Gaps: -

## eu_ets_detail

- PostgreSQL: N/A
- Status: recompute
- Source Rows: 834
- Mapped Fields: -
- Missing Fields: id, tenant_id, ship_id, voyage_id, emission_value, penalty, create_by, create_time, update_by, update_time, remark, forecast_value
- Extra PG Fields: -
- Blocking Gaps: -

## fuel_eu_calculation_result

- PostgreSQL: N/A
- Status: recompute
- Source Rows: 50
- Mapped Fields: -
- Missing Fields: id, tenant_id, ship_id, assessment_year, start_time, end_time, well_to_tank_ship, tank_to_wake_ship, co2eq_emitted_ttw, co2eq_emitted_wtt, ghg_actual_value, calculation_status, remark, create_by, create_time, update_by, update_time, energy_used_on_board, shore_power_input, base_penalty_amount, excess_penalty_amount, total_penalty_amount
- Extra PG Fields: -
- Blocking Gaps: -
