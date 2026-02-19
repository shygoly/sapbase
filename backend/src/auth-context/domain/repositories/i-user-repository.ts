/**
 * Port for user lookup (implemented in infrastructure).
 * User entity stays in users/ module, this is just a lookup port.
 */
export interface User {
  id: string
  email: string
  name: string
  role: string
  permissions: string[]
  passwordHash: string
}

/**
 * Port for user persistence (implemented in infrastructure).
 */
export interface IUserRepository {
  findByEmail(email: string): Promise<User | null>
  findById(id: string): Promise<User | null>
}
