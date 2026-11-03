# Shipping MySQL→PostgreSQL Comparison Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 对 `tests/route_carbon_analyzer_backup.sql` 中的 MySQL 航运碳分析数据，与当前 PostgreSQL `carbon` 库的 shipping 结构和内容做一次可执行、可复用的差异比对，并为后续迁移提供落地顺序。

**Architecture:** 方案分成两层：先做 schema mapping（表/字段/语义映射），再做 data profiling（行数、主键映射、关键字段空值/重复值、样例抽样）。对能重算的结果表只做存在性和口径说明，不做逐行迁移对比。对基础字典和业务主数据做强校验，最终产出导入脚本所需的字段转换规则。

**Tech Stack:** `psql`、`rg`、MySQL dump SQL、PostgreSQL `information_schema`、现有 TypeORM 实体

---

### 当前已确认事实

- MySQL 备份核心表位置：
  - `tests/route_carbon_analyzer_backup.sql:24` `annual_configuration`
  - `tests/route_carbon_analyzer_backup.sql:72` `cii_config`
  - `tests/route_carbon_analyzer_backup.sql:1118` `eu_port`
  - `tests/route_carbon_analyzer_backup.sql:54827` `fuel_type`
  - `tests/route_carbon_analyzer_backup.sql:60083` `ship_charter_info`
  - `tests/route_carbon_analyzer_backup.sql:60164` `ship_info`
  - `tests/route_carbon_analyzer_backup.sql:60286` `ship_voyage`
  - `tests/route_carbon_analyzer_backup.sql:130` `cii_evaluation_detail`
  - `tests/route_carbon_analyzer_backup.sql:212` `eu_ets_detail`
  - `tests/route_carbon_analyzer_backup.sql:54738` `fuel_eu_calculation_result`
- MySQL 行数（按 dump 中 `INSERT INTO` 行数统计）：
  - `eu_port=53600`
  - `fuel_type=67`
  - `annual_configuration=21`
  - `cii_config=23`
- PostgreSQL 当前实际数据量：
  - `shipping_ports=0`
  - `shipping_system_fuel_types=0`
  - `shipping_tenant_fuel_types=0`
  - `shipping_year_parameters=0`
  - `shipping_regulation_parameters=0`
  - `shipping_cii_ship_type_parameters=0`
  - `shipping_gwp_values=0`
  - `shipping_csf_values=0`
  - `shipping_fuel_prices=0`
  - `shipping_ships=2`
  - `shipping_charters=3`
  - `shipping_voyages=3`
  - `shipping_voyage_fuels=0`
- PostgreSQL 当前模型关键实现：
  - `backend/src/shipping-carbon/infrastructure/persistence/entities/ship.entity.ts:6`
  - `backend/src/shipping-carbon/infrastructure/persistence/entities/voyage.entity.ts:6`
  - `backend/src/shipping-carbon/infrastructure/persistence/entities/system-fuel-type.entity.ts:4`
  - `backend/src/shipping-carbon/infrastructure/persistence/entities/port.entity.ts:4`
  - `backend/src/shipping-carbon/infrastructure/persistence/entities/year-parameter.entity.ts:4`
  - `backend/src/shipping-carbon/infrastructure/persistence/entities/regulation-parameter.entity.ts:4`
  - `backend/src/shipping-carbon/infrastructure/persistence/entities/cii-ship-type-parameter.entity.ts:4`

### MySQL → PostgreSQL 表映射

- `eu_port` → `shipping_ports`
  - 状态：部分兼容
  - 说明：MySQL 只有 `port_code`，PG 需要 `code/name/country/isEu`，导入时必须补 `name`，否则无法落库。
- `fuel_type` → `shipping_system_fuel_types` + `shipping_gwp_values` + `shipping_csf_values` + `shipping_fuel_prices` + `shipping_tenant_fuel_types`
  - 状态：拆表映射
  - 说明：MySQL 是单表宽模型，PG 是参数拆分模型。
- `annual_configuration` → `shipping_year_parameters` + `shipping_regulation_parameters`
  - 状态：可映射
  - 说明：同一年度记录需拆成两张参数表。
- `cii_config` → `shipping_cii_ship_type_parameters`
  - 状态：部分兼容
  - 说明：MySQL 支持区间/标准/阈值，PG 当前仅保留 `shipType/referenceCii/requiredCii/correctionFactor`，信息损失明显。
- `ship_info` → `shipping_ships`
  - 状态：部分兼容
  - 说明：MySQL 字段比 PG 丰富，且 `ship_type_id` 在 MySQL 中是外键语义，PG 当前退化成 `type` 字符串。
- `ship_charter_info` → `shipping_charters`
  - 状态：部分兼容
  - 说明：需要确认 PG `shipping_charters` 是否保留主/辅燃料、岸电、附件路径等字段；如果没有，应补迁移前扩表。
- `ship_voyage` → `shipping_voyages` + `shipping_voyage_fuels`
  - 状态：部分兼容
  - 说明：MySQL 在 voyage 上直接存主/辅燃料与岸电；PG 更适合拆到 `shipping_voyage_fuels`，但当前表和数据都还没承接。
- `cii_evaluation_detail` / `eu_ets_detail` / `fuel_eu_calculation_result`
  - 状态：建议不直接迁移
  - 说明：作为 P2 计算结果，优先保留重算能力，仅做抽样核对公式和结果口径。

### 关键字段差异

- `ship_info` 相对 `shipping_ships` 缺口
  - MySQL 有：`gross_tonnage`、`ship_type_id`、`cii_measure_standard`、`wind_assisted_propulsion`、`main_engine_power`、`auxiliary_engine_power`、`is_wind_power_applicable`、`wind_equipment_installation_time`、`cii_applicable`、`flag_state`
  - PG 当前只有：`name/imo/type/status/ciiRating/dwt/speed`
  - 结论：`GT`、CII适用性、风力辅助、机舱功率、船旗国都缺，无法完整承接 CII/FuelEU 口径。
- `ship_voyage` 相对 `shipping_voyages` 缺口
  - MySQL 有：`start_port_code/end_port_code`、`fuel_type/fuel_consumption`、`auxiliary_fuel_type/auxiliary_fuel_consumption`、`shore_power_consumption`、`charter_info_id`、`charterer_name`
  - PG 当前只有：`departurePort/arrivalPort` 字符串、`charterId`、`distanceNm`、`emissions`、`throughIce`
  - 结论：港口代码、燃料明细、岸电口径目前都没有完整承接。
- `fuel_type` 相对 PG 拆表模型
  - MySQL 有：`co2eq_wtt/co2eq_ttw/co2eq_wtw/cf_co2/cf_ch4/cf_n2o/cslip/gwp_*/csf_*/year/price/cf_co2eq`
  - PG `shipping_system_fuel_types` 只有：`lcv/wellToTankFactor/tankToWakeFactor/co2Factor/slipFactor/defaultPrice`
  - 结论：需要明确每个字段落到哪张 PG 参数表，否则无法保持计算一致性。
- `cii_config` 相对 `shipping_cii_ship_type_parameters`
  - MySQL 有：`applicable_standard/range_min/range_max/constant_a/constant_c/d1/d2/d3/d4/constant_capacity/use_max`
  - PG 当前过于简化，无法一对一承接 23 条区间配置。

### Task 1: 生成结构比对基线

**Files:**
- Read: `tests/route_carbon_analyzer_backup.sql`
- Read: `backend/src/shipping-carbon/infrastructure/persistence/entities/ship.entity.ts`
- Read: `backend/src/shipping-carbon/infrastructure/persistence/entities/voyage.entity.ts`
- Read: `backend/src/shipping-carbon/infrastructure/persistence/entities/system-fuel-type.entity.ts`
- Read: `backend/src/shipping-carbon/infrastructure/persistence/entities/port.entity.ts`
- Read: `backend/src/shipping-carbon/infrastructure/persistence/entities/year-parameter.entity.ts`
- Read: `backend/src/shipping-carbon/infrastructure/persistence/entities/regulation-parameter.entity.ts`
- Read: `backend/src/shipping-carbon/infrastructure/persistence/entities/cii-ship-type-parameter.entity.ts`

**Step 1: 导出 MySQL dump 的目标表结构**

Run:
```bash
rg -n "CREATE TABLE|INSERT INTO" tests/route_carbon_analyzer_backup.sql | rg "annual_configuration|cii_config|eu_port|fuel_type|ship_info|ship_charter_info|ship_voyage|cii_evaluation_detail|eu_ets_detail|fuel_eu_calculation_result"
```
Expected: 能看到 10 张核心表的 DDL/数据段入口行号。

**Step 2: 导出 PostgreSQL shipping 表结构**

Run:
```bash
psql -h localhost -U mac -d carbon -c "
SELECT table_name, column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema='public' AND table_name LIKE 'shipping_%'
ORDER BY table_name, ordinal_position;"
```
Expected: 得到当前 PG shipping 相关表的完整列清单。

**Step 3: 手工建立映射矩阵**

产出列：
- `mysql_table`
- `pg_table`
- `status`（direct/partial/split/recompute/missing）
- `key_transform`
- `blocking_gap`

**Step 4: 验证关键缺口是否必须扩表**

判定标准：
- 影响监管计算口径的一律视为必须扩表
- 仅影响审计追踪的可作为二级补充字段
- 可由既有规则表推导的可不落业务主表

### Task 2: 做数据量与内容侧比对

**Files:**
- Read: `tests/route_carbon_analyzer_backup.sql`

**Step 1: 统计 MySQL dump 行数**

Run:
```bash
for t in eu_port fuel_type annual_configuration cii_config ship_info ship_charter_info ship_voyage cii_evaluation_detail eu_ets_detail fuel_eu_calculation_result; do
  echo "$t $(grep -c "INSERT INTO \`$t\`" tests/route_carbon_analyzer_backup.sql)";
done
```
Expected: 得到每张源表的大致记录数。

**Step 2: 统计 PostgreSQL 当前表行数**

Run:
```bash
psql -h localhost -U mac -d carbon -c "
select 'shipping_ports' as table_name,count(*) from shipping_ports
union all select 'shipping_system_fuel_types',count(*) from shipping_system_fuel_types
union all select 'shipping_year_parameters',count(*) from shipping_year_parameters
union all select 'shipping_regulation_parameters',count(*) from shipping_regulation_parameters
union all select 'shipping_cii_ship_type_parameters',count(*) from shipping_cii_ship_type_parameters
union all select 'shipping_ships',count(*) from shipping_ships
union all select 'shipping_charters',count(*) from shipping_charters
union all select 'shipping_voyages',count(*) from shipping_voyages;
"
```
Expected: 快速确认 P0/P1 数据是否为空或仅有 demo 数据。

**Step 3: 加抽样比对规则**

对每类表至少抽 5 条样本，检查：
- 主键/唯一键是否可映射
- 必填列是否为空
- 枚举值是否需要字典转换
- 数值单位是否变化（特别是 `shore_power_consumption` kWh→MJ）
- 港口代码是否能补足名称

**Step 4: 输出差异报告**

报告字段建议：
- `source_count`
- `target_count`
- `count_gap`
- `sample_pass_rate`
- `blocking_reason`
- `recommended_action`

### Task 3: 明确字段转换规则

**Files:**
- Modify later: `backend/src/shipping-carbon/infrastructure/persistence/entities/*.entity.ts`
- Create later: `backend/src/shipping-carbon/infrastructure/persistence/seeds/*`
- Create later: `backend/src/migrations/*`

**Step 1: 字典类转换**

- `annual_configuration.config_year` → `shipping_year_parameters.year` + `shipping_regulation_parameters.year`
- `annual_configuration.ghg_intensity_target` → `shipping_year_parameters.fuelEuTarget` + `shipping_regulation_parameters.ghgTarget`
- `annual_configuration.cii_reduction_rate` → `shipping_regulation_parameters.reductionRatio`
- `annual_configuration.fuel_eu_penalty` → `shipping_regulation_parameters.excessPenaltyPerTon`
- `annual_configuration.eua_price` → `shipping_year_parameters.euaPrice` + `shipping_regulation_parameters.euaPriceEur`

**Step 2: 燃料类拆表**

- `fuel_type.tenant_id=1` → `shipping_system_fuel_types`
- `fuel_type.tenant_id!=1` → `shipping_tenant_fuel_types`
- `fuel_type.gwp_*` → `shipping_gwp_values`
- `fuel_type.csf_*` → `shipping_csf_values`
- `fuel_type.year/price` → `shipping_fuel_prices`
- `fuel_type.co2eq_* / cf_* / cslip` → 保留在系统燃料表或补新参数表，避免信息丢失

**Step 3: 船舶类转换**

- `gross_tonnage` 建议新增 PG 列 `gt`
- `ship_type_id` 不建议继续退化成字符串，至少需要字典映射表
- `cii_applicable`、`flag_state`、`wind_assisted_propulsion`、`main_engine_power`、`auxiliary_engine_power` 建议补列

**Step 4: 航次类转换**

- `start_port_code/end_port_code` 建议新增 PG 列，或改成真正的 `portId` 关系
- 主/辅燃料与消耗量迁移到 `shipping_voyage_fuels`
- `shore_power_consumption` 导入前做单位转换：`kWh * 3.6 = MJ`
- `through_ice` MySQL 若为字符串，导入时标准化成布尔值

### Task 4: 制定迁移顺序

**Step 1: 先迁 P0 基础字典**

顺序：
1. `eu_port`
2. `fuel_type`
3. `annual_configuration`
4. `cii_config`

验收：
- `shipping_ports` 非空且唯一索引通过
- 燃料参数拆分后可拼回 MySQL 原语义
- 年度参数 2025–2045 全部可查
- CII 参数能覆盖 MySQL 23 条规则

**Step 2: 再迁 P1 主数据**

顺序：
1. `ship_info`
2. `ship_charter_info`
3. `ship_voyage`

验收：
- 船舶、租期、航次主外键可联通
- 航次可回溯到租期与港口
- 每条航次的燃料明细可重新参与计算

**Step 3: 最后处理 P2 结果表**

策略：
- 默认不直接导入
- 用同一输入数据在 PG 引擎重算
- 与 MySQL 抽样对比 `cii_evaluation_detail`、`eu_ets_detail`、`fuel_eu_calculation_result`
- 若偏差超阈值，再决定是否保留历史结果迁移通道

### 风险与阻塞

- PG 当前 P0 字典表全部为空，说明对比前必须先确定导入口径。
- `shipping_ships`、`shipping_voyages` 当前字段不足，直接迁移会丢监管关键字段。
- `shipping_cii_ship_type_parameters` 当前模型过于扁平，无法完整表示 MySQL 的区间规则。
- MySQL dump 是业务全量导出，PG 当前只有少量 demo 数据，内容侧差异结论不能只看计数。
- 现有 migration 链已知存在旧迁移非幂等问题，建议先修正迁移执行稳定性，再做正式导入。

### 建议的最小实施路径

1. 先补 PG schema，使其至少能无损承接 `ship_info` / `ship_voyage` / `fuel_type` / `cii_config` 的监管关键字段。
2. 写一个一次性 comparison script：解析 MySQL dump 元数据 + 查询 PG `information_schema` + 输出 markdown/csv diff。
3. 在 comparison script 通过后，再写分阶段 seed/import 脚本。
4. 最后用同一批迁移后的 P1 数据重跑 FuelEU / ETS / CII，与 MySQL P2 抽样核对。

### 建议输出物

- `docs/reports/shipping-mysql-pg-gap-report.md`
- `scripts/shipping/compare-mysql-dump-to-pg.ts`
- `scripts/shipping/import-foundation-from-mysql-dump.ts`
- `scripts/shipping/import-master-data-from-mysql-dump.ts`
- 对应 migration 文件若干
