import { Organization } from '../organizations/organization.entity'
import type { BusinessAppExecutionContext } from '@speckit/shared-schemas'

declare global {
  namespace Express {
    interface Request {
      organizationId?: string
      organization?: Organization
      appContext?: BusinessAppExecutionContext
      rawBody?: Buffer
    }
  }
}

export {}
