import { render, screen, waitFor } from '@testing-library/react'
import { useAuth } from '@/core/auth/context'
import { AuthProvider } from '@/components/auth-provider'
import { authService } from '@/lib/auth-service'

// Mock auth service
jest.mock('@/lib/auth-service')

const TestComponent = () => {
  const { user, isLoading, login, logout } = useAuth()

  return (
    <div>
      {isLoading && <div>Loading...</div>}
      {user && <div>User: {user.email}</div>}
      {!user && !isLoading && <div>Not authenticated</div>}
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('useAuth', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      expect(() => {
        render(<TestComponent />)
      }).toThrow('useAuth must be used within AuthProvider')

      consoleSpy.mockRestore()
    })

    it('should return auth context when used inside provider', () => {
      ;(authService.getProfile as jest.Mock).mockResolvedValue(null)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByText('Not authenticated')).toBeInTheDocument()
    })
  })

  describe('AuthProvider', () => {
    it('should initialize with loading state', () => {
      ;(authService.getProfile as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(null), 100))
      )

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('should load user profile on mount', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      }

      ;(authService.getProfile as jest.Mock).mockResolvedValue(mockUser)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('User: test@example.com')).toBeInTheDocument()
      })
    })

    it('should update state after successful login', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      }

      ;(authService.getProfile as jest.Mock).mockResolvedValue(null)
      ;(authService.login as jest.Mock).mockResolvedValue({
        access_token: 'test-token',
        user: mockUser,
      })

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      const loginButton = screen.getByText('Login')
      loginButton.click()

      await waitFor(() => {
        expect(screen.getByText('User: test@example.com')).toBeInTheDocument()
      })
    })

    it('should clear state after logout', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      }

      ;(authService.getProfile as jest.Mock).mockResolvedValue(mockUser)
      ;(authService.logout as jest.Mock).mockResolvedValue(undefined)

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('User: test@example.com')).toBeInTheDocument()
      })

      const logoutButton = screen.getByText('Logout')
      logoutButton.click()

      await waitFor(() => {
        expect(screen.getByText('Not authenticated')).toBeInTheDocument()
      })
    })

    it('should handle login errors', async () => {
      ;(authService.getProfile as jest.Mock).mockResolvedValue(null)
      ;(authService.login as jest.Mock).mockRejectedValue(
        new Error('Invalid credentials')
      )

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      const loginButton = screen.getByText('Login')
      loginButton.click()

      await waitFor(() => {
        expect(screen.getByText('Not authenticated')).toBeInTheDocument()
      })
    })

    it('should handle logout errors', async () => {
      const mockUser = {
        id: '1',
        email: 'test@example.com',
        name: 'Test User',
      }

      ;(authService.getProfile as jest.Mock).mockResolvedValue(mockUser)
      ;(authService.logout as jest.Mock).mockRejectedValue(
        new Error('Logout failed')
      )

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      )

      await waitFor(() => {
        expect(screen.getByText('User: test@example.com')).toBeInTheDocument()
      })

      const logoutButton = screen.getByText('Logout')
      logoutButton.click()

      // User should still be logged in after failed logout
      await waitFor(() => {
        expect(screen.getByText('User: test@example.com')).toBeInTheDocument()
      })
    })
  })
})
