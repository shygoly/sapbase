'use client'

import { useState } from 'react'

interface ApprovalFormProps {
  taskId: string
  onApprove: (taskId: string, comment?: string) => void
  onReject: (taskId: string, comment?: string) => void
  isLoading?: boolean
}

export function ApprovalForm({
  taskId,
  onApprove,
  onReject,
  isLoading = false,
}: ApprovalFormProps) {
  const [comment, setComment] = useState('')
  const [action, setAction] = useState<'approve' | 'reject' | null>(null)

  const handleSubmit = () => {
    if (action === 'approve') {
      onApprove(taskId, comment)
    } else if (action === 'reject') {
      onReject(taskId, comment)
    }
  }

  return (
    <div className="space-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div>
        <label className="block text-sm font-medium mb-2 text-gray-900 dark:text-gray-100">
          Comment
        </label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment..."
          disabled={isLoading}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          rows={4}
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            setAction('approve')
            handleSubmit()
          }}
          disabled={isLoading}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Approve
        </button>
        <button
          onClick={() => {
            setAction('reject')
            handleSubmit()
          }}
          disabled={isLoading}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reject
        </button>
      </div>
    </div>
  )
}
