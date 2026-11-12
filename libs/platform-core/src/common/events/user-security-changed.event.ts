/**
 * 用户安全状态变化：密码、角色、账号状态或删除。
 * 身份模块订阅后吊销全部会话；权限版本由写入方递增。
 */
export class UserSecurityChangedEvent {
  constructor(
    readonly userId: string,
    readonly reason:
      | 'password-changed'
      | 'role-changed'
      | 'account-disabled'
      | 'account-deleted',
    readonly organizationId?: string,
  ) {}
}
