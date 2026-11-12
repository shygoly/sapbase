/**
 * 登录异常：新设备/新 IP 成功登录。
 * 通知模块订阅后写站内通知并推送；不改变登录结果。
 */
export class AuthLoginAnomalyEvent {
  constructor(
    readonly organizationId: string,
    readonly userId: string | null,
    readonly email: string,
    readonly loginEventId: string,
    readonly ip: string | null,
    readonly userAgent: string | null,
    readonly newDevice: boolean,
    readonly newIp: boolean,
  ) {}
}
