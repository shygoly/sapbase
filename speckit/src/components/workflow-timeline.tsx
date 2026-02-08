'use client'

import type { WorkflowHistoryEntry } from '@/core/state-machine/types'

interface WorkflowTimelineProps {
  history: WorkflowHistoryEntry[]
}

export function WorkflowTimeline({ history }: WorkflowTimelineProps) {
  if (history.length === 0) {
    return <div className="text-sm text-gray-500">No workflow history</div>
  }

  return (
    <div className="space-y-4">
      {history.map((entry, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full" />
            {index < history.length - 1 && <div className="w-0.5 h-12 bg-gray-200" />}
          </div>
          <div className="flex-1 pb-4">
            <div className="font-medium">
              {entry.from} → {entry.to}
            </div>
            <div className="text-sm text-gray-600">
              Event: {entry.event}
            </div>
            <div className="text-sm text-gray-500">
              By {entry.actor} on {entry.timestamp.toLocaleString()}
            </div>
            {entry.comment && (
              <div className="text-sm text-gray-700 mt-2 p-2 bg-gray-50 rounded">
                {entry.comment}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
