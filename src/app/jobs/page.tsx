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
  sent_status?: string
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterApplied, setFilterApplied] = useState(false)
  const [editingJob, setEditingJob] = useState<Job | null>(null)
  const [editForm, setEditForm] = useState({
    vertical: '',
    job_function: '',
    location: '',
    mail_send_date: '',
    mail_send_time: '09:00',
  })
  const [savingEdit, setSavingEdit] = useState(false)

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

  async function deleteJob(id: string) {
    if (!confirm('Delete this job?')) return
    const res = await fetch(`/api/jobs?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      setJobs(jobs.filter(j => j.id !== id))
    }
  }

  function openEditModal(job: Job) {
    setEditingJob(job)
    let dateStr = ''
    let timeStr = '09:00'
    if (job.mail_send_date) {
      const mailDate = new Date(job.mail_send_date)
      const istDate = new Date(mailDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
      dateStr = istDate.toISOString().split('T')[0]
      const hours = istDate.getHours().toString().padStart(2, '0')
      const minutes = istDate.getMinutes().toString().padStart(2, '0')
      timeStr = `${hours}:${minutes}`
    }
    setEditForm({
      vertical: job.vertical,
      job_function: job.job_function,
      location: job.location,
      mail_send_date: dateStr,
      mail_send_time: timeStr,
    })
  }

  function closeEditModal() {
    setEditingJob(null)
  }

  async function saveEdit() {
    if (!editingJob) return
    setSavingEdit(true)
    
    const updateData = {
      id: editingJob.id,
      vertical: editForm.vertical,
      job_function: editForm.job_function,
      location: editForm.location,
      mail_send_date: editForm.mail_send_date ? `${editForm.mail_send_date} ${editForm.mail_send_time}:00` : null,
    }

    try {
      const res = await fetch('/api/jobs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })
      
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to update')
      }

      const updatedJob = await res.json()
      setJobs(jobs.map(j => j.id === editingJob.id ? { ...j, ...updatedJob } : j))
      closeEditModal()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      alert(message)
    } finally {
      setSavingEdit(false)
    }
  }

  async function sendEmails() {
    setSending(true)
    const res = await fetch('/api/send-mail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        jobIds: selectedJobs.length > 0 ? selectedJobs : undefined,
        includeScheduled: true
      }),
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
            <Link href="/" className="text-black hover:text-indigo-600">
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
                <label className="block text-xs font-medium text-black mb-1">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="px-3 py-1.5 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-black mb-1">To Date</label>
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
              <span className="ml-auto text-black text-sm">{jobs.length} positions</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <span className="text-gray-900 font-medium">{jobs.length} positions</span>
            <button
              onClick={sendEmails}
              disabled={sending}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {sending ? 'Sending...' : `Send Email${selectedJobs.length > 0 ? ` (${selectedJobs.length})` : ''}`}
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-black">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="p-8 text-center text-black">
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">Vertical</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">Function</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">Location</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">Date Added</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">Mail Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">Creative</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-black uppercase">Actions</th>
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
                      <td className="px-4 py-3 text-black">
                        {job.mail_send_date 
                          ? (() => {
                              const mailDate = new Date(job.mail_send_date)
                              const istDate = new Date(mailDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }))
                              const day = istDate.getDate().toString().padStart(2, '0')
                              const month = (istDate.getMonth() + 1).toString().padStart(2, '0')
                              const year = istDate.getFullYear()
                              const hour = istDate.getHours()
                              const minutes = istDate.getMinutes().toString().padStart(2, '0')
                              const ampm = hour >= 12 ? 'PM' : 'AM'
                              const hour12 = hour % 12 || 12
                              return `${day}/${month}/${year} ${hour12}:${minutes} ${ampm}`;
                            })()
                          : '-'}
                      </td>
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
                          <span className="text-black">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openEditModal(job)}
                          className="text-black hover:text-indigo-600 text-sm mr-3"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => deleteJob(job.id)}
                          className="text-black hover:text-red-800 text-sm"
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

      {editingJob && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-black mb-4">Edit Job</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-black mb-1">Vertical *</label>
                <input
                  type="text"
                  value={editForm.vertical}
                  onChange={e => setEditForm({ ...editForm, vertical: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-black"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-black mb-1">Job Function *</label>
                <input
                  type="text"
                  value={editForm.job_function}
                  onChange={e => setEditForm({ ...editForm, job_function: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-black"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-black mb-1">Location *</label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg text-black"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-black mb-1">Mail Send Date</label>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={editForm.mail_send_date}
                    onChange={e => setEditForm({ ...editForm, mail_send_date: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg text-black"
                  />
                  <input
                    type="time"
                    value={editForm.mail_send_time}
                    onChange={e => setEditForm({ ...editForm, mail_send_time: e.target.value })}
                    className="w-32 px-3 py-2 border rounded-lg text-black"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={closeEditModal}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-black hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {savingEdit ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
