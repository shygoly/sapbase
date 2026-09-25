// `semver` 的最小类型声明。
//
// 为什么手写而不是装 `@types/semver`：本仓库依赖尚未干净安装（见
// docs/PACKAGE_MANAGER.md 的遗留项），而 `src/plugins/.../dependency-resolver.service.ts`
// 早就有同一个类型报错 —— 这里补一份最小声明，同时消掉那处既有错误。
// 只声明实际用到的 API；需要更多时优先装 @types/semver 并删掉本文件。
declare module 'semver' {
  export function maxSatisfying(
    versions: readonly string[],
    range: string,
    optionsOrLoose?: unknown,
  ): string | null

  export function satisfies(version: string, range: string): boolean

  export function valid(version: string): string | null

  export function compare(a: string, b: string): number
}
