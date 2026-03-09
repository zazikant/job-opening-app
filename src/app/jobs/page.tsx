'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Job {
  id: string
  vertical: string
  job_function: string
  location: string
  date_added: string
  creative_url: string | null
  mail_send_date: string | null
  created_at: string
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterApplied, setFilterApplied] = useState(false)

  async function loadJobs(from?: string, to?: string) {
    setLoading(true)
    let url = '/api/jobs'
    if (from || to) {
      const params = new URLSearchParams()
      if (from) params.set('date_from', from)
      if (to) params.set('date_to', to)
      url += `?${params.toString()}`
    }
    const res = await fetch(url)
    const data: Job[] | { error: string } = await res.json()
    if (!('error' in data)) {
      setJobs(data)
    } else {
      setJobs([])
    }
    setLoading(false)
  }

  useEffect(() => {
    let ignore = false

    async function fetchJobs() {
      setLoading(true)
      const res = await fetch('/api/jobs')
      const data: Job[] | { error: string } = await res.json()
      if (!ignore) {
        if (!('error' in data)) {
          setJobs(data)
        } else {
          setJobs([])
        }
        setLoading(false)
      }
    }

    fetchJobs()

    return () => {
      ignore = true
    }
  }, [])

  function applyFilter() {
    setFilterApplied(true)
    setLoading(true)
    let url = '/api/jobs'
    const params = new URLSearchParams()
    if (dateFrom) params.set('date_from', dateFrom)
    if (dateTo) params.set('date_to', dateTo)
    url += `?${params.toString()}`
    fetch(url).then(res => res.json()).then((data: Job[] | { error: string }) => {
      if (!('error' in data)) {
        setJobs(data)
      } else {
        setJobs([])
      }
      setLoading(false)
    })
  }

  function clearFilter() {
    setFilterApplied(false)
    setDateFrom('')
    setDateTo('')
    setLoading(true)
    fetch('/api/jobs').then(res => res.json()).then((data: Job[] | { error: string }) => {
      if (!('error' in data)) {
        setJobs(data)
      } else {
        setJobs([])
      }
      setLoading(false)
    })
  }

  function clearFilter() {
    setFilterApplied(false)
    setDateFrom('')
    setDateTo('')
    loadJobs()
  }

  async function deleteJob(id: string) {
    if (!confirm('Delete this job?')) return
    const res = await fetch(`/api/jobs?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setJobs(jobs.filter(j => j.id !== id))
    }
  }

  async function sendEmails() {
    if (selectedJobs.length === 0) {
      alert('Select jobs to send')
      return
    }
    setSending(true)
    const res = await fetch('/api/send-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobIds: selectedJobs }),
    })
    const data = await res.json()
    setSending(false)
    
    if (data.error) {
      alert(data.error)
    } else {
      alert(`Sent ${data.sent_count} jobs successfully!`)
      setSelectedJobs([])
    }
  }

  function toggleSelect(id: string) {
    setSelectedJobs(prev => 
      prev.includes(id) 
        ? prev.filter(j => j !== id)
        : [...prev, id]
    )
  }

  function toggleSelectAll() {
    if (selectedJobs.length === jobs.length) {
      setSelectedJobs([])
    } else {
      setSelectedJobs(jobs.map(j => j.id))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-600 hover:text-indigo-600">
              ← Back
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Job Openings</h1>
          </div>
          <div className="flex gap-3">
            <Link 
              href="/query" 
              className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
            >
              AI Query
            </Link>
            <Link 
              href="/jobs/add" 
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Add Job
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
          <div className="p-4 border-b">
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="px-3 py-1.5 border rounded text-sm"
                />
              </div>
              <button
                onClick={applyFilter}
                className="px-4 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
              >
                Filter
              </button>
              {filterApplied && (
                <button
                  onClick={clearFilter}
                  className="px-4 py-1.5 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                >
                  Clear
                </button>
              )}
              <span className="ml-auto text-gray-600 text-sm">{jobs.length} positions</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <span className="text-gray-900 font-medium">{jobs.length} positions</span>
            <button
              onClick={sendEmails}
              disabled={sending || selectedJobs.length === 0}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {sending ? 'Sending...' : `Send Email (${selectedJobs.length})`}
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No jobs yet. <Link href="/jobs/add" className="text-indigo-600">Add one</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input 
                        type="checkbox" 
                        checked={selectedJobs.length === jobs.length && jobs.length > 0}
                        onChange={toggleSelectAll}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Vertical</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Function</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date Added</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Mail Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Creative</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {jobs.map((job, idx) => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <input 
                          type="checkbox" 
                          checked={selectedJobs.includes(job.id)}
                          onChange={() => toggleSelect(job.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">{idx + 1}</td>
                      <td className="px-4 py-3 font-medium text-black">{job.vertical}</td>
                      <td className="px-4 py-3 text-black">{job.job_function}</td>
                      <td className="px-4 py-3 text-black">{job.location}</td>
                      <td className="px-4 py-3 text-black">{job.date_added}</td>
                      <td className="px-4 py-3 text-black">{job.mail_send_date || '-'}</td>
                      <td className="px-4 py-3">
                        {job.creative_url ? (
                          <a 
                            href={job.creative_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline"
                          >
                            View
                          </a>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteJob(job.id)}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
