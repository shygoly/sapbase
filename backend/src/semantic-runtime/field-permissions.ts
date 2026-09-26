/**
 * 字段级读省略 / 写拒绝 / 单据级 ownership 过滤。
 *
 * 纯逻辑，不碰 IO。默认（未声明 permissions / ownership）行为不变：
 * 声明了才加严。空归属对所有人可见 —— 升级后无主历史数据不能被藏起来。
 */

export const DOTTED_PERMISSION = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/
export const ISO_CURRENCY = /^[A-Z]{3}$/
export const STAMPED_CURRENCY_KEY = '__currency'

export interface FieldPermissionDecl {
  read?: string
  write?: string
}

export interface OwnershipDecl {
  field: string
  readAllPermission: string
}

export interface PermissionField {
  name: string
  permissions?: FieldPermissionDecl
}

export interface OwnershipEntity {
  name: string
  fields: PermissionField[]
  ownership?: OwnershipDecl
}

export interface RuntimeActor {
  id?: string
  userId?: string
  permissions?: string[]
}

export function actorPermissions(actor?: RuntimeActor): string[] {
  return Array.isArray(actor?.permissions) ? actor.permissions : []
}

export function actorId(actor?: RuntimeActor): string | undefined {
  if (typeof actor?.id === 'string' && actor.id.length > 0) return actor.id
  if (typeof actor?.userId === 'string' && actor.userId.length > 0) return actor.userId
  return undefined
}

export function hasPermission(granted: readonly string[], required?: string): boolean {
  if (!required) return true
  return granted.includes(required)
}

/** 缺少 permissions.read 的字段从 data 省略，字段名进 omittedFields（可观察）。 */
export function omitRestrictedFields(
  entity: OwnershipEntity,
  data: Record<string, unknown>,
  granted: readonly string[],
): { data: Record<string, unknown>; omittedFields: string[] } {
  const next: Record<string, unknown> = { ...data }
  delete next[STAMPED_CURRENCY_KEY]
  const omittedFields: string[] = []
  for (const field of entity.fields) {
    const required = field.permissions?.read
    if (!required) continue
    if (hasPermission(granted, required)) continue
    if (Object.prototype.hasOwnProperty.call(next, field.name)) {
      delete next[field.name]
      omittedFields.push(field.name)
    }
  }
  return { data: next, omittedFields }
}

/**
 * payload 里出现缺少 permissions.write 的字段 → 返回字段名。
 * 未声明 write 的字段不受限。`children` 是保留键，不在这里判。
 */
export function forbiddenWriteFields(
  entity: OwnershipEntity,
  data: Record<string, unknown>,
  granted: readonly string[],
): string[] {
  const declared = new Map(entity.fields.map((field) => [field.name, field]))
  const forbidden: string[] = []
  for (const key of Object.keys(data)) {
    if (key === 'children' || key === STAMPED_CURRENCY_KEY) continue
    const field = declared.get(key)
    const required = field?.permissions?.write
    if (!required) continue
    if (!hasPermission(granted, required)) forbidden.push(key)
  }
  return forbidden
}

export function canReadAllOwned(entity: OwnershipEntity, granted: readonly string[]): boolean {
  const required = entity.ownership?.readAllPermission
  if (!required) return false
  return hasPermission(granted, required)
}

/**
 * 空 / 缺失归属字段对所有人可见（有意：升级后无主历史数据不能被藏起来）。
 * 未声明 ownership → 不筛。
 */
export function isOwnedVisible(
  entity: OwnershipEntity,
  data: Record<string, unknown>,
  actor?: RuntimeActor,
): boolean {
  const ownership = entity.ownership
  if (!ownership) return true
  if (canReadAllOwned(entity, actorPermissions(actor))) return true
  const raw = data[ownership.field]
  if (raw === undefined || raw === null || raw === '') return true
  const who = actorId(actor)
  return typeof raw === 'string' && who !== undefined && raw === who
}

export function filterOwnedRows<T extends { data: Record<string, unknown> }>(
  entity: OwnershipEntity,
  rows: T[],
  actor?: RuntimeActor,
): T[] {
  if (!entity.ownership) return rows
  if (canReadAllOwned(entity, actorPermissions(actor))) return rows
  return rows.filter((row) => isOwnedVisible(entity, row.data, actor))
}

/** 声明了 money 的字段上取第一个 currency，供写入时盖章。 */
export function declaredMoneyCurrency(
  fields: Array<{ money?: boolean; currency?: string }>,
): string | undefined {
  for (const field of fields) {
    if (field.money === true && typeof field.currency === 'string' && ISO_CURRENCY.test(field.currency)) {
      return field.currency
    }
  }
  return undefined
}
