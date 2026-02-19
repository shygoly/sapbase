'use client'

import { useCollaboration } from '@/hooks/use-collaboration'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Users } from 'lucide-react'

interface CollaboratorsListProps {
  resourceType: string
  resourceId: string
}

/**
 * Component for displaying active collaborators.
 * 
 * Usage:
 * ```tsx
 * <CollaboratorsList resourceType="workflow" resourceId={workflowId} />
 * ```
 */
export function CollaboratorsList({
  resourceType,
  resourceId,
}: CollaboratorsListProps) {
  const { collaborators, joined } = useCollaboration({
    resourceType,
    resourceId,
    autoJoin: true,
  })

  if (!joined || collaborators.length === 0) {
    return null
  }

  const getInitials = (email?: string) => {
    if (!email) return '?'
    return email
      .split('@')[0]
      .split('.')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  return (
    <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
      <Users className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">
        {collaborators.length} collaborator{collaborators.length !== 1 ? 's' : ''}
      </span>
      <div className="flex items-center gap-1">
        {collaborators.map((collaborator) => (
          <Avatar key={collaborator.id} className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {getInitials(collaborator.email)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
    </div>
  )
}
