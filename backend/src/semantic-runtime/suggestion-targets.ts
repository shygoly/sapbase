/**
 * 夜间建议的准入：哪些记录该被 cron 扫到。
 * 不碰 IO。调用方负责读包与读表。
 */

export interface AutoSuggestEntity {
  name: string
  autoSuggest?: boolean
  states?: Array<{ name: string; final?: boolean }>
}

export interface AutoSuggestRecord {
  id: string
  blueprintId: string
  entity: string
  organizationId: string
  state?: string | null
}

export interface AutoSuggestPackage {
  packageId: string
  blueprintId: string
  entities: AutoSuggestEntity[]
}

export interface AutoSuggestTarget {
  packageId: string
  blueprintId: string
  entity: string
  recordId: string
  organizationId: string
}

/** `autoSuggest === true` 且当前状态不是终态。缺省关闭，终态与空租户跳过。 */
export function selectAutoSuggestTargets(
  packages: AutoSuggestPackage[],
  records: AutoSuggestRecord[],
): AutoSuggestTarget[] {
  const targets: AutoSuggestTarget[] = []
  for (const pkg of packages) {
    for (const entity of pkg.entities) {
      if (entity.autoSuggest !== true) continue
      const finals = new Set(
        (entity.states ?? []).filter((state) => state.final === true).map((state) => state.name),
      )
      for (const row of records) {
        if (row.blueprintId !== pkg.blueprintId || row.entity !== entity.name) continue
        if (!row.organizationId) continue
        if (row.state && finals.has(row.state)) continue
        targets.push({
          packageId: pkg.packageId,
          blueprintId: pkg.blueprintId,
          entity: entity.name,
          recordId: row.id,
          organizationId: row.organizationId,
        })
      }
    }
  }
  return targets
}
