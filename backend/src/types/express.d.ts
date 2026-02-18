import { Organization } from '../organizations/organization.entity'

declare global {
  namespace Express {
    interface Request {
      organizationId?: string
      organization?: Organization
      rawBody?: Buffer
    }
  }
}

export {}
