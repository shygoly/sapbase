# 船舶与租期数据库Schema

## 概述

本文档详细说明船舶(Vessel)和租期(CharterPeriod)实体的数据库设计，支持多租户场景下同一IMO在不同组织的独立管理。

---

## 核心设计原则

### 1. 多租户隔离
- 每个组织可以独立管理同一IMO的船舶
- 通过 `organizationId` + `imo` 的复合唯一索引实现组织级隔离
- 不同组织可以对同一物理船舶有不同的命名和配置

### 2. 时间段控制
- 使用 `CharterPeriod` 控制数据的时间有效性
- 同一IMO在全库范围内，租期时间段不得重叠
- 在Service层进行时间段重叠校验

### 3. 数据归属
- 每条记录都明确属于某个组织
- 支持跨组织的物理船舶共享，但数据完全隔离

---

## 实体设计

### Vessel (船舶表)

#### 表名: `vessels`

#### 继承关系
```
BaseEntity (基础字段)
  ├── id (UUID, PK)
  ├── createdAt (TIMESTAMP)
  └── updatedAt (TIMESTAMP)

TenantAwareEntity (租户字段)
  ├── organizationId (UUID, FK)
  └── organization (ManyToOne)
```

#### 字段详解

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | UUID | PK | 主键，每个租户下独立 |
| `createdAt` | TIMESTAMP | DEFAULT: now() | 创建时间 |
| `updatedAt` | TIMESTAMP | DEFAULT: now() | 更新时间 |
| `organizationId` | UUID | FK, NOT NULL | 所属组织 |
| `organization` | Organization | ManyToOne | 组织关系 |
| `imo` | VARCHAR(7) | NOT NULL | 国际海事组织编号（物理船号） |
| `name` | VARCHAR(255) | NOT NULL | 船舶名称（租户自定义） |
| `vesselType` | VARCHAR(50) | NOT NULL | 船舶类型 (e.g., "Bulk Carrier", "Container Ship", "Tanker") |
| `gt` | DECIMAL(10,2) | NOT NULL | 总吨位 (Gross Tonnage) |
| `dwt` | DECIMAL(10,2) | NOT NULL | 载重吨 (Deadweight Tonnage) |
| `hasWindAssist` | BOOLEAN | DEFAULT: false | 是否配备风力辅助系统 |
| `windRewardFactor` | DECIMAL(5,4) | DEFAULT: 1.0 | 风力奖励系数 (1.0=无奖励, 0.99/0.95等=有奖励) |
| `windDeviceType` | VARCHAR(50) | NULLABLE | 风力设备类型 ("Rotor Sails", "Wing Sails", "Kites") |

#### 索引设计

```sql
-- 复合唯一索引：保证组织内IMO唯一
CREATE UNIQUE INDEX idx_vessel_organization_imo
ON vessels(organizationId, imo);

-- 组织级查询索引
CREATE INDEX idx_vessel_organization
ON vessels(organizationId);

-- IMO全库查询（用于跨组织查询）
CREATE INDEX idx_vessel_imo
ON vessels(imo);

-- 船舶类型查询
CREATE INDEX idx_vessel_type
ON vessels(vesselType);
```

#### 关系定义

```typescript
// TypeORM Entity 示例
@Entity('vessels')
@Index('idx_vessel_organization_imo', ['organizationId', 'imo'], { unique: true })
@Index('idx_vessel_organization', ['organizationId'])
@Index('idx_vessel_imo', ['imo'])
@Index('idx_vessel_type', ['vesselType'])
export class Vessel extends TenantAwareEntity {
  @Column({ type: 'varchar', length: 7 })
  imo: string

  @Column({ type: 'varchar', length: 255 })
  name: string

  @Column({ type: 'varchar', length: 50 })
  vesselType: string

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  gt: number

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  dwt: number

  @Column({ type: 'boolean', default: false })
  hasWindAssist: boolean

  @Column({ type: 'decimal', precision: 5, scale: 4, default: 1.0 })
  windRewardFactor: number

  @Column({ type: 'varchar', length: 50, nullable: true })
  windDeviceType: string

  @OneToMany(() => CharterPeriod, (period) => period.vessel)
  charterPeriods: CharterPeriod[]

  @OneToMany(() => Voyage, (voyage) => voyage.vessel)
  voyages: Voyage[]
}
```

---

### CharterPeriod (租期表)

#### 表名: `charter_periods`

#### 继承关系
```
BaseEntity (基础字段)
  ├── id (UUID, PK)
  ├── createdAt (TIMESTAMP)
  └── updatedAt (TIMESTAMP)

TenantAwareEntity (租户字段)
  ├── organizationId (UUID, FK)
  └── organization (ManyToOne)
```

#### 字段详解

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | UUID | PK | 主键 |
| `createdAt` | TIMESTAMP | DEFAULT: now() | 创建时间 |
| `updatedAt` | TIMESTAMP | DEFAULT: now() | 更新时间 |
| `organizationId` | UUID | FK, NOT NULL | 所属组织 |
| `organization` | Organization | ManyToOne | 组织关系 |
| `vesselId` | UUID | FK, NOT NULL | 船舶ID |
| `vessel` | Vessel | ManyToOne | 船舶关系 |
| `startDate` | TIMESTAMP | NOT NULL | 租期开始日期 |
| `endDate` | TIMESTAMP | NOT NULL | 租期结束日期 |
| `charterType` | VARCHAR(50) | NULLABLE | 租赁类型 ("Time Charter", "Voyage Charter", "Bareboat") |
| `charterer` | VARCHAR(255) | NULLABLE | 承租人名称 |
| `dailyRate` | DECIMAL(12,2) | NULLABLE | 日费率 |
| `status` | VARCHAR(50) | DEFAULT: 'active' | 租期状态 ("active", "completed", "cancelled") |

#### 索引设计

```sql
-- 组织和船舶查询
CREATE INDEX idx_charter_period_organization
ON charter_periods(organizationId);

CREATE INDEX idx_charter_period_vessel
ON charter_periods(vesselId);

-- 时间范围查询
CREATE INDEX idx_charter_period_date_range
ON charter_periods(startDate, endDate);

-- 组织+船舶+时间范围（用于重叠检测）
CREATE INDEX idx_charter_period_organization_vessel_date
ON charter_periods(organizationId, vesselId, startDate, endDate);

-- 状态查询
CREATE INDEX idx_charter_period_status
ON charter_periods(status);
```

#### 关系定义

```typescript
// TypeORM Entity 示例
@Entity('charter_periods')
@Index('idx_charter_period_organization', ['organizationId'])
@Index('idx_charter_period_vessel', ['vesselId'])
@Index('idx_charter_period_date_range', ['startDate', 'endDate'])
@Index('idx_charter_period_organization_vessel_date', ['organizationId', 'vesselId', 'startDate', 'endDate'])
@Index('idx_charter_period_status', ['status'])
export class CharterPeriod extends TenantAwareEntity {
  @Column({ type: 'uuid' })
  vesselId: string

  @ManyToOne(() => Vessel, (vessel) => vessel.charterPeriods, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vesselId' })
  vessel: Vessel

  @Column({ type: 'timestamp' })
  startDate: Date

  @Column({ type: 'timestamp' })
  endDate: Date

  @Column({ type: 'varchar', length: 50, nullable: true })
  charterType: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  charterer: string

  @Column({ type: 'decimal', precision: 12, scale: 2, nullable: true })
  dailyRate: number

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: 'active' | 'completed' | 'cancelled'
}
```

---

## 业务规则

### 1. IMO唯一性规则

**规则**: 同一组织内，IMO必须唯一
```sql
-- 保证组织内IMO唯一
UNIQUE(organizationId, imo)
```

**示例**:
```
组织A: IMO=1234567, 名称="东方号"
组织B: IMO=1234567, 名称="西方号"  ✓ 允许（不同组织）

组织A: IMO=1234567, 名称="东方号"
组织A: IMO=1234567, 名称="东方号2" ✗ 不允许（同组织重复）
```

### 2. 租期时间段重叠检测

**规则**: 同一IMO在全库范围内，租期时间段不得重叠

**检测逻辑** (在Service层实现):
```typescript
// 检查是否存在重叠的租期
async checkCharterPeriodOverlap(
  imo: string,
  startDate: Date,
  endDate: Date,
  excludeId?: string
): Promise<boolean> {
  const overlappingPeriods = await this.charterPeriodRepository.find({
    where: {
      vessel: { imo },
      startDate: LessThan(endDate),
      endDate: GreaterThan(startDate),
      ...(excludeId && { id: Not(excludeId) })
    }
  })

  return overlappingPeriods.length > 0
}
```

**时间段重叠判断**:
```
新租期: [startDate, endDate]
现有租期: [existingStart, existingEnd]

重叠条件: startDate < existingEnd AND endDate > existingStart
```

### 3. 风力辅助配置

**规则**:
- `hasWindAssist = true` 时，必须设置 `windDeviceType`
- `windRewardFactor` 范围: 0.0 ~ 1.0
  - 1.0: 无奖励
  - < 1.0: 有奖励（如0.99表示1%奖励）

**验证逻辑**:
```typescript
if (vessel.hasWindAssist && !vessel.windDeviceType) {
  throw new Error('Wind device type is required when wind assist is enabled')
}

if (vessel.windRewardFactor < 0 || vessel.windRewardFactor > 1) {
  throw new Error('Wind reward factor must be between 0 and 1')
}
```

---

## 查询示例

### 1. 获取组织内的所有船舶

```sql
SELECT * FROM vessels
WHERE organizationId = $1
ORDER BY name;
```

### 2. 获取特定IMO的所有组织记录

```sql
SELECT v.*, o.name as organization_name
FROM vessels v
JOIN organizations o ON v.organizationId = o.id
WHERE v.imo = $1
ORDER BY o.name;
```

### 3. 检查租期重叠

```sql
SELECT * FROM charter_periods
WHERE vessel_id IN (
  SELECT id FROM vessels WHERE imo = $1
)
AND startDate < $2
AND endDate > $3
AND id != $4;  -- 排除当前记录
```

### 4. 获取活跃租期内的船舶

```sql
SELECT DISTINCT v.*
FROM vessels v
JOIN charter_periods cp ON v.id = cp.vesselId
WHERE v.organizationId = $1
AND cp.status = 'active'
AND cp.startDate <= NOW()
AND cp.endDate >= NOW();
```

### 5. 获取具有风力辅助的船舶

```sql
SELECT * FROM vessels
WHERE organizationId = $1
AND hasWindAssist = true
ORDER BY windRewardFactor DESC;
```

---

## 数据迁移

### 从现有系统迁移

如果从现有系统迁移，需要考虑:

1. **IMO映射**: 确保IMO格式正确（7位数字）
2. **组织映射**: 将现有数据映射到新的organizationId
3. **时间段处理**:
   - 如果没有租期数据，创建默认的全时间段租期
   - 检查并处理时间段重叠

### 迁移脚本示例

```sql
-- 1. 创建临时表
CREATE TABLE vessels_temp AS
SELECT
  uuid_generate_v4() as id,
  NOW() as createdAt,
  NOW() as updatedAt,
  $1 as organizationId,
  imo,
  name,
  vesselType,
  gt,
  dwt,
  false as hasWindAssist,
  1.0 as windRewardFactor,
  NULL as windDeviceType
FROM legacy_vessels
WHERE organizationId = $1;

-- 2. 检查重复IMO
SELECT imo, COUNT(*) as count
FROM vessels_temp
GROUP BY imo
HAVING COUNT(*) > 1;

-- 3. 插入数据
INSERT INTO vessels SELECT * FROM vessels_temp;

-- 4. 创建默认租期
INSERT INTO charter_periods (id, createdAt, updatedAt, organizationId, vesselId, startDate, endDate, status)
SELECT
  uuid_generate_v4(),
  NOW(),
  NOW(),
  v.organizationId,
  v.id,
  '2000-01-01'::timestamp,
  '2099-12-31'::timestamp,
  'active'
FROM vessels v
WHERE v.organizationId = $1;
```

---

## 性能考虑

### 1. 索引策略

| 索引 | 用途 | 优先级 |
|------|------|--------|
| `(organizationId, imo)` | 组织内IMO查询 | 高 |
| `(organizationId)` | 组织级查询 | 高 |
| `(imo)` | 全库IMO查询 | 中 |
| `(vesselType)` | 船舶类型过滤 | 中 |
| `(organizationId, vesselId, startDate, endDate)` | 租期重叠检测 | 高 |
| `(startDate, endDate)` | 时间范围查询 | 中 |

### 2. 查询优化建议

- 使用 `organizationId` 作为查询条件的首选
- 对于跨组织查询，使用 `imo` 索引
- 租期重叠检测使用复合索引
- 定期分析查询计划，调整索引

### 3. 分区策略（可选）

对于大规模数据，可考虑按 `organizationId` 分区:

```sql
CREATE TABLE vessels_partition (
  -- 字段定义
) PARTITION BY LIST (organizationId);

CREATE TABLE vessels_org_a PARTITION OF vessels_partition
  FOR VALUES IN ('org-a-uuid');
```

---

## 相关表关系

```
Organization (1)
    ↓
    ├── Vessel (N) [organizationId]
    │   ├── CharterPeriod (N) [vesselId]
    │   └── Voyage (N) [vesselId]
    │
    └── CharterPeriod (N) [organizationId]
```

---

## 版本历史

| 版本 | 日期 | 变更 |
|------|------|------|
| 1.0 | 2026-03-09 | 初始版本，包含Vessel和CharterPeriod实体 |
