'use client'

import { useEffect, useState } from 'react'
import { knowledgeApi } from '@sap/app-shared/lib/api/agent-governance.api'

interface KnowledgeRow {
  id: string
  title: string
  knowledgeKey?: string
  scope?: string
  version?: number
  status?: string
}

export default function KnowledgePage() {
  const [rows, setRows] = useState<KnowledgeRow[]>([])
  const [title, setTitle] = useState('税率怎么填')
  const [body, setBody] = useState('在采购单新建页填写税率，范围 0-100。')
  const [key, setKey] = useState('purchase-order-tax')
  const [message, setMessage] = useState<string | null>(null)

  const load = async () => {
    try {
      setRows((await knowledgeApi.published()) as KnowledgeRow[])
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const create = async () => {
    try {
      await knowledgeApi.createDraft({
        scope: 'organization',
        knowledgeKey: key,
        title,
        body,
      })
      setMessage('Draft created')
      await load()
    } catch (error) {
      setMessage((error as Error).message)
    }
  }

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Knowledge</h1>
      {message ? <div className="text-sm">{message}</div> : null}
      <div className="flex flex-wrap gap-2">
        <input className="rounded border px-3 py-1 text-sm" value={key} onChange={(e) => setKey(e.target.value)} />
        <input className="rounded border px-3 py-1 text-sm" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="rounded border px-3 py-1 text-sm" value={body} onChange={(e) => setBody(e.target.value)} />
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void create()}>
          Create Draft
        </button>
        <button className="rounded border px-3 py-1 text-sm" onClick={() => void load()}>
          Refresh
        </button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-left">Key</th>
            <th className="p-2 text-left">Title</th>
            <th className="p-2 text-left">Scope</th>
            <th className="p-2 text-left">Version</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t">
              <td className="p-2">{row.knowledgeKey}</td>
              <td className="p-2">{row.title}</td>
              <td className="p-2">{row.scope}</td>
              <td className="p-2">{row.version}</td>
              <td className="p-2">{row.status}</td>
              <td className="p-2">
                <button
                  className="mr-2 rounded border px-2 py-0.5 text-xs"
                  onClick={() => void knowledgeApi.publish(row.id, true).then(load)}
                >
                  Publish
                </button>
                <button
                  className="rounded border px-2 py-0.5 text-xs"
                  onClick={() => void knowledgeApi.rollback(row.id).then(load)}
                >
                  Rollback
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
