'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useCollaboration } from '@/hooks/use-collaboration'
import { Textarea } from '@/components/ui/textarea'
import { CollaboratorsList } from './collaborators-list'

interface CollaborativeEditorProps {
  resourceType: string
  resourceId: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * Collaborative text editor component with real-time synchronization.
 * 
 * Usage:
 * ```tsx
 * <CollaborativeEditor
 *   resourceType="workflow"
 *   resourceId={workflowId}
 *   value={content}
 *   onChange={setContent}
 * />
 * ```
 */
export function CollaborativeEditor({
  resourceType,
  resourceId,
  value,
  onChange,
  placeholder,
  className,
}: CollaborativeEditorProps) {
  const [localValue, setLocalValue] = useState(value)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastCursorRef = useRef<{ line: number; column: number }>({ line: 0, column: 0 })
  const isApplyingRemoteChangeRef = useRef(false)

  const { sendUpdate, sendCursorUpdate } = useCollaboration({
    resourceType,
    resourceId,
    autoJoin: true,
    onUpdate: (update) => {
      // Apply remote changes
      if (!isApplyingRemoteChangeRef.current) {
        isApplyingRemoteChangeRef.current = true
        setLocalValue((prev) => {
          // Simple merge strategy - in production, use operational transforms or CRDTs
          // For now, we'll just apply the changes
          return update.changes.content || prev
        })
        setTimeout(() => {
          isApplyingRemoteChangeRef.current = false
        }, 100)
      }
    },
  })

  // Sync local value with parent
  useEffect(() => {
    if (localValue !== value && !isApplyingRemoteChangeRef.current) {
      onChange(localValue)
    }
  }, [localValue, value, onChange])

  // Sync parent value to local
  useEffect(() => {
    if (value !== localValue && !isApplyingRemoteChangeRef.current) {
      setLocalValue(value)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid syncing loop with localValue
  }, [value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      setLocalValue(newValue)

      // Get cursor position
      const textarea = e.target
      const cursorPosition = textarea.selectionStart
      const textBeforeCursor = newValue.substring(0, cursorPosition)
      const lines = textBeforeCursor.split('\n')
      const line = lines.length - 1
      const column = lines[lines.length - 1].length

      const cursor = { line, column }
      lastCursorRef.current = cursor

      // Send update to other collaborators
      sendUpdate(
        {
          content: newValue,
          operation: 'edit',
        },
        cursor,
      )
    },
    [sendUpdate],
  )

  const handleSelectionChange = useCallback(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current
      const cursorPosition = textarea.selectionStart
      const textBeforeCursor = localValue.substring(0, cursorPosition)
      const lines = textBeforeCursor.split('\n')
      const line = lines.length - 1
      const column = lines[lines.length - 1].length

      const cursor = { line, column }
      if (
        cursor.line !== lastCursorRef.current.line ||
        cursor.column !== lastCursorRef.current.column
      ) {
        lastCursorRef.current = cursor
        sendCursorUpdate(cursor)
      }
    }
  }, [localValue, sendCursorUpdate])

  return (
    <div className={className}>
      <CollaboratorsList resourceType={resourceType} resourceId={resourceId} />
      <Textarea
        ref={textareaRef}
        value={localValue}
        onChange={handleChange}
        onSelect={handleSelectionChange}
        placeholder={placeholder}
        className="mt-2 font-mono"
      />
    </div>
  )
}
