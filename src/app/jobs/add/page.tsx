'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'

export default function AddJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [form, setForm] = useState({
    vertical: '',
    job_function: '',
    location: '',
    mail_send_date: '',
    mail_send_time: '09:00',
  })

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': ['.jpg', '.jpeg'] },
    maxFiles: 1,
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vertical || !form.job_function || !form.location) {
      alert('Please fill all required fields')
      return
    }

    setLoading(true)

    const jobData = {
      ...form,
      mail_send_date: form.mail_send_date ? `${form.mail_send_date} ${form.mail_send_time}:00` : null,
      sent_status: 'pending',
    }
    delete (jobData as Record<string, unknown>).mail_send_time

    try {
      if (file) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('jobData', JSON.stringify(jobData))

        const res = await fetch('/api/jobs/upload', {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Upload failed')
        }
      } else {
        const res = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        })

        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to create job')
        }
      }

      router.push('/jobs')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      alert(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Add Job Opening</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Vertical *
            </label>
            <input
              type="text"
              value={form.vertical}
              onChange={e => setForm({ ...form, vertical: e.target.value })}
              placeholder="e.g., Technology, Healthcare, Finance"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Job Function *
            </label>
            <input
              type="text"
              value={form.job_function}
              onChange={e => setForm({ ...form, job_function: e.target.value })}
              placeholder="e.g., Software Engineer, Designer, Manager"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Location *
            </label>
            <input
              type="text"
              value={form.location}
              onChange={e => setForm({ ...form, location: e.target.value })}
              placeholder="e.g., Mumbai, Bangalore, Remote"
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Mail Send Date
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={form.mail_send_date}
                onChange={e => setForm({ ...form, mail_send_date: e.target.value })}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              <input
                type="time"
                value={form.mail_send_time}
                onChange={e => setForm({ ...form, mail_send_time: e.target.value })}
                className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <p className="text-xs text-black mt-1">Email will auto-send at scheduled date/time (IST)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-black mb-1">
              Creative Image (JPG)
            </label>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition
                ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'}
              `}
            >
              <input {...getInputProps()} />
              {preview ? (
                <div className="relative inline-block">
                  <Image src={preview} alt="Preview" width={192} height={192} className="max-h-48 rounded" />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-sm"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div className="text-black">
                  {isDragActive ? (
                    <p>Drop the JPG here...</p>
                  ) : (
                    <p>Drag & drop a JPG here, or click to select</p>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-black hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Job'}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
