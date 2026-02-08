import { authService } from '@/lib/auth-service'

// Mock fetch
global.fetch = jest.fn()

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    localStorage.clear()
  })

  describe('login', () => {
    it('should call API with correct credentials', async () => {
      const mockResponse = {
        access_token: 'test-token',
        user: { id: '1', email: 'test@example.com', name: 'Test User' },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await authService.login('test@example.com', 'password123')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/login'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123',
          }),
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should store token in localStorage', async () => {
      const mockResponse = {
        access_token: 'test-token',
        user: { id: '1', email: 'test@example.com' },
      }

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      await authService.login('test@example.com', 'password123')

      expect(localStorage.getItem('auth_token')).toBe('test-token')
    })

    it('should throw error on invalid credentials', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      })

      await expect(
        authService.login('test@example.com', 'wrongpassword')
      ).rejects.toThrow()
    })

    it('should handle network errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network error')
      )

      await expect(
        authService.login('test@example.com', 'password123')
      ).rejects.toThrow('Network error')
    })
  })

  describe('logout', () => {
    it('should call logout API endpoint', async () => {
      localStorage.setItem('auth_token', 'test-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await authService.logout()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/logout'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
    })

    it('should clear token from localStorage', async () => {
      localStorage.setItem('auth_token', 'test-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      await authService.logout()

      expect(localStorage.getItem('auth_token')).toBeNull()
    })

    it('should handle API errors gracefully', async () => {
      localStorage.setItem('auth_token', 'test-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      await expect(authService.logout()).rejects.toThrow()
    })
  })

  describe('getProfile', () => {
    it('should fetch user profile with token', async () => {
      const mockUser = { id: '1', email: 'test@example.com', name: 'Test User' }
      localStorage.setItem('auth_token', 'test-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockUser,
      })

      const result = await authService.getProfile()

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/profile'),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      )
      expect(result).toEqual(mockUser)
    })

    it('should return null without token', async () => {
      const result = await authService.getProfile()
      expect(result).toBeNull()
    })

    it('should return null on 401 response', async () => {
      localStorage.setItem('auth_token', 'test-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      const result = await authService.getProfile()
      expect(result).toBeNull()
    })

    it('should clear token on authentication failure', async () => {
      localStorage.setItem('auth_token', 'test-token')

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 401,
      })

      await authService.getProfile()
      expect(localStorage.getItem('auth_token')).toBeNull()
    })
  })

  describe('token management', () => {
    it('should get token from localStorage', () => {
      localStorage.setItem('auth_token', 'test-token')
      const token = authService.getToken()
      expect(token).toBe('test-token')
    })

    it('should set token in localStorage', () => {
      authService.setToken('new-token')
      expect(localStorage.getItem('auth_token')).toBe('new-token')
    })

    it('should clear token from localStorage', () => {
      localStorage.setItem('auth_token', 'test-token')
      authService.clearToken()
      expect(localStorage.getItem('auth_token')).toBeNull()
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when token exists', () => {
      localStorage.setItem('auth_token', 'test-token')
      expect(authService.isAuthenticated()).toBe(true)
    })

    it('should return false when token is missing', () => {
      localStorage.clear()
      expect(authService.isAuthenticated()).toBe(false)
    })
  })
})
