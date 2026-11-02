'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { releasesApi, type ProposalView } from '@/lib/api/releases.api'

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id as string
  const [proposal, setProposal] = useState<ProposalView | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    try {
      setProposal(await releasesApi.getProposal(id))
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  const validate = async () => {
    try {
      setProposal(await releasesApi.validateProposal(id))
      setMessage('Validation finished')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const approve = async () => {
    try {
      setProposal(await releasesApi.approveProposal(id, 'owner', 'approved in UI'))
      setMessage('Approved')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  const reject = async () => {
    const reason = window.prompt('Rejection reason')
    if (!reason) return
    try {
      setProposal(await releasesApi.rejectProposal(id, 'owner', reason))
      setMessage('Rejected')
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Proposal {proposal?.title ?? id}</h1>
      {message ? <div className="text-sm">{message}</div> : null}
      <div className="flex gap-2">
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void validate()}>
          Validate
        </button>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void approve()}>
          Approve
        </button>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void reject()}>
          Reject
        </button>
      </div>
      <section>
        <h2 className="mb-2 text-lg font-medium">Risk & Gates</h2>
        <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-3 text-xs">
          {JSON.stringify(proposal?.risk ?? {}, null, 2)}
        </pre>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-medium">Diff</h2>
        <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-3 text-xs">
          {JSON.stringify(proposal?.diff ?? {}, null, 2)}
        </pre>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-medium">Evidence</h2>
        <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-3 text-xs">
          {JSON.stringify(proposal?.evidence ?? [], null, 2)}
        </pre>
      </section>
      <section>
        <h2 className="mb-2 text-lg font-medium">Rollback Plan</h2>
        <pre className="max-h-64 overflow-auto rounded border bg-muted/30 p-3 text-xs">
          {JSON.stringify(proposal?.rollbackPlan ?? {}, null, 2)}
        </pre>
      </section>
    </div>
  )
}
