import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { TenantTransactionInterceptor } from './tenant-transaction.interceptor'

@Module({
  providers: [
    TenantTransactionInterceptor,
    {
      provide: APP_INTERCEPTOR,
      useExisting: TenantTransactionInterceptor,
    },
  ],
})
export class TenantTransactionModule {}
