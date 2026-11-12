'use client'

import { useCallback, useEffect, useState } from 'react'
import PageContainer from '@sap/app-shared/components/layout/page-container'
import { Badge } from '@sap/app-shared/components/ui/badge'
import { Button } from '@sap/app-shared/components/ui/button'
import { Input } from '@sap/app-shared/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@sap/app-shared/components/ui/select'
import { useOrganizationStore } from '@sap/app-shared/core/store/organization.store'
import {
  organizationsApi,
  type Invitation,
  type OrganizationMember,
} from '@sap/api-client'

export default function TeamPage() {
  const currentOrganization = useOrganizationStore((state) => state.currentOrganization)
  const organizationId = currentOrganization?.id ?? ''
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [activities, setActivities] = useState<any[]>([])
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'member' | 'owner'>('member')
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!organizationId) return
    try {
      const [memberList, invitationList, activityList] = await Promise.all([
        organizationsApi.getMembers(organizationId),
        organizationsApi.getInvitations(organizationId),
        organizationsApi.getActivities(organizationId, 30),
      ])
      setMembers(memberList)
      setInvitations(invitationList)
      setActivities(activityList)
      setMessage(null)
    } catch (error) {
      setMessage((error as Error).message || '加载团队失败')
    }
  }, [organizationId])

  useEffect(() => {
    void load()
  }, [load])

  const invite = async () => {
    try {
      await organizationsApi.createInvitation(organizationId, email, role)
      setMessage(`已邀请 ${email}`)
      setEmail('')
      await load()
    } catch (error) {
      setMessage((error as Error).message || '邀请失败')
    }
  }

  if (!organizationId) {
    return (
      <PageContainer pageTitle='团队管理' pageDescription='请先选择组织。'>
        <p className='text-muted-foreground text-sm'>当前没有选中的组织。</p>
      </PageContainer>
    )
  }

  return (
    <PageContainer
      pageTitle='团队管理'
      pageDescription='成员、邀请与组织活动；角色只有 Owner/Member，业务权限仍走组织角色绑定。'
    >
      <div className='space-y-4'>
        <div className='flex flex-wrap items-end gap-2 rounded-lg border bg-card p-4'>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>邀请邮箱</span>
            <Input
              className='w-72'
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder='member@example.com'
            />
          </div>
          <div className='space-y-1'>
            <span className='text-xs text-muted-foreground'>角色</span>
            <Select value={role} onValueChange={(value) => setRole(value as typeof role)}>
              <SelectTrigger className='w-36'><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value='member'>Member</SelectItem>
                <SelectItem value='owner'>Owner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button disabled={!email} onClick={() => void invite()}>
            发送邀请
          </Button>
          {message ? <span className='text-muted-foreground text-sm'>{message}</span> : null}
        </div>

        <section className='space-y-2 rounded-lg border bg-card p-4'>
          <h3 className='font-medium'>成员</h3>
          {members.map((member) => (
            <div key={member.id} className='flex flex-wrap items-center gap-2 rounded border p-2 text-sm'>
              <span className='font-medium'>{member.user?.name ?? member.userId}</span>
              <span className='text-muted-foreground'>{member.user?.email ?? ''}</span>
              <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                {member.role}
              </Badge>
              <Select
                value={member.role}
                onValueChange={(value) =>
                  void organizationsApi
                    .updateMemberRole(organizationId, member.userId, value as 'owner' | 'member')
                    .then(load)
                }
              >
                <SelectTrigger className='h-7 w-28'><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value='member'>Member</SelectItem>
                  <SelectItem value='owner'>Owner</SelectItem>
                </SelectContent>
              </Select>
              <Button
                size='sm'
                variant='destructive'
                onClick={() =>
                  void organizationsApi.removeMember(organizationId, member.userId).then(load)
                }
              >
                移除
              </Button>
            </div>
          ))}
          {members.length === 0 ? <p className='text-muted-foreground text-sm'>暂无成员</p> : null}
        </section>

        <section className='space-y-2 rounded-lg border bg-card p-4'>
          <h3 className='font-medium'>待处理邀请</h3>
          {invitations.filter((item) => item.status === 'pending').map((invitation) => (
            <div key={invitation.id} className='flex flex-wrap items-center gap-2 rounded border p-2 text-sm'>
              <span>{invitation.email}</span>
              <Badge variant='secondary'>{invitation.role}</Badge>
              <span className='text-muted-foreground'>
                到期 {invitation.expiresAt ? new Date(invitation.expiresAt).toLocaleString() : '-'}
              </span>
              <Button
                size='sm'
                variant='outline'
                onClick={() =>
                  void organizationsApi
                    .cancelInvitation(organizationId, invitation.id)
                    .then(load)
                }
              >
                取消
              </Button>
            </div>
          ))}
          {invitations.filter((item) => item.status === 'pending').length === 0 ? (
            <p className='text-muted-foreground text-sm'>暂无待处理邀请</p>
          ) : null}
        </section>

        <section className='space-y-2 rounded-lg border bg-card p-4'>
          <h3 className='font-medium'>组织活动</h3>
          {activities.map((activity) => (
            <div key={activity.id} className='flex flex-wrap items-center gap-2 rounded border p-2 text-sm'>
              <Badge variant='secondary'>{activity.action}</Badge>
              <span>{activity.description ?? '-'}</span>
              <span className='text-muted-foreground'>
                {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : ''}
              </span>
            </div>
          ))}
          {activities.length === 0 ? (
            <p className='text-muted-foreground text-sm'>暂无活动</p>
          ) : null}
        </section>
      </div>
    </PageContainer>
  )
}
