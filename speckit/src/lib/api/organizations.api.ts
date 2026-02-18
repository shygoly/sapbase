/**
 * Organizations API Service
 * Handles organization-related endpoints
 */

import { httpClient } from './client'

export interface Organization {
  id: string
  name: string
  slug: string
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  planName?: string
  subscriptionStatus: string
  createdAt: string
  updatedAt: string
}

export interface OrganizationMember {
  id: string
  organizationId: string
  userId: string
  role: 'owner' | 'member'
  joinedAt: string
  user?: {
    id: string
    name: string
    email: string
  }
}

export interface Invitation {
  id: string
  organizationId: string
  email: string
  role: 'owner' | 'member'
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  token: string
  expiresAt?: string
  invitedAt: string
}

export const organizationsApi = {
  /**
   * Get all organizations for current user
   */
  async findAll(): Promise<Organization[]> {
    const response = await httpClient.get<any>('/api/organizations')
    return response.data.data || response.data || []
  },

  /**
   * Get organization by ID
   */
  async findOne(id: string): Promise<Organization> {
    const response = await httpClient.get<any>(`/api/organizations/${id}`)
    return response.data.data || response.data
  },

  /**
   * Create new organization
   */
  async create(name: string): Promise<Organization> {
    const response = await httpClient.post<any>('/api/organizations', { name })
    return response.data.data || response.data
  },

  /**
   * Update organization
   */
  async update(id: string, updates: Partial<Organization>): Promise<Organization> {
    const response = await httpClient.patch<any>(`/api/organizations/${id}`, updates)
    return response.data.data || response.data
  },

  /**
   * Get organization members
   */
  async getMembers(organizationId: string): Promise<OrganizationMember[]> {
    const response = await httpClient.get<any>(`/api/organizations/${organizationId}/members`)
    return response.data.data || response.data || []
  },

  /**
   * Add member to organization
   */
  async addMember(organizationId: string, userId: string, role: 'owner' | 'member'): Promise<OrganizationMember> {
    const response = await httpClient.post<any>(`/api/organizations/${organizationId}/members`, {
      userId,
      role,
    })
    return response.data.data || response.data
  },

  /**
   * Remove member from organization
   */
  async removeMember(organizationId: string, userId: string): Promise<void> {
    await httpClient.delete(`/api/organizations/${organizationId}/members/${userId}`)
  },

  /**
   * Update member role
   */
  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: 'owner' | 'member',
  ): Promise<OrganizationMember> {
    const response = await httpClient.patch<any>(`/api/organizations/${organizationId}/members/${userId}/role`, {
      role,
    })
    return response.data.data || response.data
  },

  /**
   * Get invitations for organization
   */
  async getInvitations(organizationId: string): Promise<Invitation[]> {
    const response = await httpClient.get<any>(`/api/organizations/${organizationId}/invitations`)
    return response.data.data || response.data || []
  },

  /**
   * Create invitation
   */
  async createInvitation(
    organizationId: string,
    email: string,
    role: 'owner' | 'member',
  ): Promise<Invitation> {
    const response = await httpClient.post<any>(`/api/organizations/${organizationId}/invitations`, {
      email,
      role,
    })
    return response.data.data || response.data
  },

  /**
   * Get invitation by token (public endpoint)
   */
  async getInvitationByToken(token: string): Promise<Invitation> {
    const response = await httpClient.get<any>(`/api/invitations/token/${token}`)
    return response.data.data || response.data
  },

  /**
   * Accept invitation
   */
  async acceptInvitation(token: string): Promise<OrganizationMember> {
    const response = await httpClient.post<any>(`/api/organizations/invitations/accept/${token}`)
    return response.data.data || response.data
  },

  /**
   * Cancel invitation
   */
  async cancelInvitation(organizationId: string, invitationId: string): Promise<void> {
    await httpClient.delete(`/api/organizations/${organizationId}/invitations/${invitationId}`)
  },
}
