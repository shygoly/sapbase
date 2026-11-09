/**
 * 会话校验端口：JwtStrategy 只依赖“能校验 sid”，不直接依赖 identity 模块，
 * 避免 auth ↔ identity 的循环装配。
 */
export interface AuthSessionService {
  assertActive(sid: string): Promise<unknown>
}
