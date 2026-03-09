'use client'

import { useState } from 'react'
import Link from 'next/link'

interface QueryResult {
  query: string
  sql: string | null
  results: Record<string, unknown>[] | null
  error: string | null
  steps?: string[]
}

function downloadCSV(results: Record<string, unknown>[], filename?: string) {
  if (!results.length) return
  
  const headers = Object.keys(results[0])
  const csvRows = [
    headers.join(','),
    ...results.map(row => 
      headers.map(h => {
        const val = row[h]
        if (typeof val === 'string' && (val.includes(',') || val.includes('"'))) {
          return `"${val.replace(/"/g, '""')}"`
        }
        return val ?? ''
      }).join(',')
    )
  ].join('\n')

  const blob = new Blob([csvRows], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename || `jobs-${new Date().toISOString().split('T')[0]}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function QueryPage() {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResult | null>(null)

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return

    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setResult({ query, sql: null, results: null, error: message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-black hover:text-indigo-600">
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">AI Query</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <form onSubmit={handleQuery} className="mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g., Show me all jobs in Mumbai"
              className="flex-1 px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Querying...' : 'Search'}
            </button>
          </div>
          <p className="text-sm text-black mt-2">
            Try: &quot;jobs in Bangalore&quot;, &quot;count by vertical&quot;, &quot;all positions from last month&quot;
          </p>
        </form>

        {result && (
          <div className="bg-white rounded-lg shadow">
            {result.error ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 font-medium">Error</p>
                <p className="text-red-600">{result.error}</p>
              </div>
            ) : (
              <>
                {result.steps && result.steps.length > 0 && (
                  <div className="p-4 border-b bg-blue-50">
                    <p className="text-sm font-medium text-black mb-2">AI Processing Steps:</p>
                    <ul className="text-xs text-black space-y-1">
                      {result.steps.map((step, idx) => (
                        <li key={idx}>• {step}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="p-4 border-b bg-gray-50">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-black">
                      {result.results?.length || 0} results
                    </span>
                    {result.results && result.results.length > 0 && (
                      <button
                        onClick={() => downloadCSV(result.results!)}
                        className="text-sm bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
                      >
                        Download CSV
                      </button>
                    )}
                  </div>
                  {result.sql && (
                    <code className="text-xs bg-gray-200 px-2 py-1 rounded block">
                      {result.sql}
                    </code>
                  )}
                </div>

                {result.results && result.results.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          {Object.keys(result.results[0]).map(key => (
                            <th 
                              key={key} 
                              className="px-4 py-3 text-left text-xs font-medium text-black uppercase"
                            >
                              {key.replace(/_/g, ' ')}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                          {result.results.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            {Object.values(row).map((val, i) => {
                              const strVal = typeof val === 'string' ? val : String(val ?? '')
                              return (
                              <td key={i} className="px-4 py-3 text-sm">
                                {strVal.startsWith('http') ? (
                                  <a 
                                    href={strVal} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:underline"
                                  >
                                    Link
                                  </a>
                                ) : (
                                  strVal || '-'
                                )}
                              </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-black">
                    No results found
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
