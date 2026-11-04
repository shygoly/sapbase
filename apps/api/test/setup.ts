/**
 * Global test setup file.
 * Runs before all tests.
 */

// Mock environment variables
process.env.NODE_ENV = 'test'
process.env.DB_HOST = 'localhost'
process.env.DB_PORT = '5432'
process.env.DB_USERNAME = 'test'
process.env.DB_PASSWORD = 'test'
process.env.DB_NAME = 'test_db'
process.env.JWT_SECRET = 'test-secret-key'
process.env.CORS_ORIGIN = 'http://localhost:3050'

// Increase timeout for integration tests
jest.setTimeout(30000)

// Global test utilities
global.console = {
  ...console,
  // Suppress console.log in tests unless DEBUG is set
  log: process.env.DEBUG ? console.log : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
  info: process.env.DEBUG ? console.info : jest.fn(),
  warn: console.warn,
  error: console.error,
}
