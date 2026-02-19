/**
 * Port for password hashing service (implemented in infrastructure).
 */
export interface IPasswordService {
  hash(password: string): Promise<string>
  compare(password: string, hash: string): Promise<boolean>
}
