'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import Image from 'next/image'
import { toJpeg } from 'html-to-image'

export default function AddJobPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [converting, setConverting] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)
  const [adPrompt, setAdPrompt] = useState('')
  const [customHtml, setCustomHtml] = useState('')
  const [showCustomHtml, setShowCustomHtml] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const adPreviewRef = useRef<HTMLDivElement>(null)
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

  async function generateAd() {
    if (!adPrompt.trim()) {
      alert('Please enter a prompt for the ad')
      return
    }
    if (!form.vertical || !form.job_function || !form.location) {
      alert('Please fill in Vertical, Job Function, and Location first')
      return
    }

    setGenerating(true)
    setGenerationError(null)
    setGeneratedHtml(null)
    setGeneratedImage(null)

    try {
      const res = await fetch('/api/generate-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: adPrompt,
          vertical: form.vertical,
          jobFunction: form.job_function,
          location: form.location,
          customHtml: showCustomHtml && customHtml.trim() ? customHtml : null,
        }),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to generate ad')
      }

      setGeneratedHtml(data.html)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setGenerationError(message)
    } finally {
      setGenerating(false)
    }
  }

  async function convertToImage() {
    if (!adPreviewRef.current) return

    setConverting(true)
    try {
      const imageDataUrl = await toJpeg(adPreviewRef.current, {
        quality: 0.95,
        backgroundColor: '#667eea',
        pixelRatio: 2, // Equivalent to scale: 2 in html2canvas
      })

      setGeneratedImage(imageDataUrl)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      alert(`Failed to convert: ${message}`)
    } finally {
      setConverting(false)
    }
  }

  function downloadImage() {
    if (!generatedImage) return
    const link = document.createElement('a')
    link.href = generatedImage
    link.download = `job-ad-${form.job_function.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.jpg`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.vertical || !form.job_function || !form.location) {
      alert('Please fill all required fields')
      return
    }

    setLoading(true)

    const jobData: Record<string, unknown> = {
      ...form,
      mail_send_date: form.mail_send_date ? `${form.mail_send_date} ${form.mail_send_time}:00` : null,
      sent_status: 'pending',
    }
    delete jobData.mail_send_time

    try {
      let uploadRes: Response

      if (generatedImage) {
        const blob = await fetch(generatedImage).then(r => r.blob())
        const imageFile = new File([blob], 'ad-creative.jpg', { type: 'image/jpeg' })
        
        const formData = new FormData()
        formData.append('file', imageFile)
        formData.append('jobData', JSON.stringify(jobData))

        uploadRes = await fetch('/api/jobs/upload', {
          method: 'POST',
          body: formData,
        })
      } else if (file) {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('jobData', JSON.stringify(jobData))

        uploadRes = await fetch('/api/jobs/upload', {
          method: 'POST',
          body: formData,
        })
      } else {
        uploadRes = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jobData),
        })
      }

      if (!uploadRes.ok) {
        const err = await uploadRes.json()
        throw new Error(err.error || 'Failed to create job')
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

      <main className="max-w-6xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-6">
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
                  AI Ad Generator Prompt
                </label>
                <textarea
                  value={adPrompt}
                  onChange={e => setAdPrompt(e.target.value)}
                  placeholder="e.g., Write an exciting promotion for a senior software engineer position focusing on remote work and benefits"
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-24 resize-none"
                />
                
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowCustomHtml(!showCustomHtml)}
                    className="text-sm text-indigo-600 hover:underline"
                  >
                    {showCustomHtml ? '▼ Hide Custom HTML' : '▶ Use Custom HTML Template'}
                  </button>
                  
                  {showCustomHtml && (
                    <div className="mt-2">
                      <textarea
                        value={customHtml}
                        onChange={e => setCustomHtml(e.target.value)}
                        placeholder={`<div style="width:600px; background:linear-gradient(135deg,#667eea,#764ba2);padding:30px;font-family:sans-serif;box-sizing:border-box;">
  <div style="background:white;border-radius:16px;padding:30px;box-sizing:border-box;">
    <div style="text-align:center;margin-bottom:20px;box-sizing:border-box;">
      <img src="https://gemengserv.com/wp-content/uploads/2021/04/GEM-Engserv-Pvt-Ltd-logo-updated.png" alt="Logo" style="max-height:50px;width:auto;object-fit:contain;" />
    </div>
    <div style="text-align:center;margin-bottom:15px;box-sizing:border-box;">
      <div style="display:inline-block;background:#667eea;color:white;padding:4px 12px;border-radius:15px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;box-sizing:border-box;">Vertical: {{VERTICAL}}</div>
    </div>
    <h1 style="color:#333;font-size:28px;font-weight:800;text-align:center;margin:0 0 10px 0;line-height:1.3;box-sizing:border-box;text-transform:capitalize;"><span style="font-size:16px;color:#666;font-weight:600;display:block;margin-bottom:4px;text-transform:none;">Job Title:</span> {{JOB_TITLE}}</h1>
    <div style="color:#666;font-size:14px;text-align:center;margin-bottom:20px;font-weight:500;box-sizing:border-box;">📍 Location: {{LOCATION}}</div>
    <div style="color:#444;font-size:15px;line-height:1.6;text-align:center;margin-bottom:30px;box-sizing:border-box;word-wrap:break-word;">{{DESCRIPTION}}</div>
    <div style="text-align:center;box-sizing:border-box;margin-bottom:15px;">
      <div style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;padding:12px 35px;border-radius:25px;font-size:15px;font-weight:bold;display:inline-block;box-sizing:border-box;box-shadow:0 4px 15px rgba(102,126,234,0.4);">
        Apply Now, send CV to Ms. Harshala Kadave at <br/> harshala.kadave@gemengserv.com
      </div>
    </div>
  </div>
</div>`}
                        className="w-full px-3 py-2 border rounded-lg font-mono text-xs h-48 resize-none"
                      />
                      <p className="text-xs text-black mt-1">
                        Required placeholders: {'{{VERTICAL}}'}, {'{{JOB_TITLE}}'}, {'{{LOCATION}}'}, {'{{DESCRIPTION}}'}
                      </p>
                    </div>
                  )}
                </div>
                
                <p className="text-xs text-black mt-1">
                  Kimi K2.5 fills {'{{DESCRIPTION}}'} in your HTML template
                </p>
                <button
                  type="button"
                  onClick={generateAd}
                  disabled={generating || !adPrompt.trim()}
                  className="mt-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-sm"
                >
                  {generating ? 'Generating...' : '✨ Generate Ad Content'}
                </button>
                {generationError && (
                  <p className="text-red-500 text-sm mt-2">{generationError}</p>
                )}
              </div>

              {generatedHtml && (
                <div>
                  <label className="block text-sm font-medium text-black mb-1">
                    Generated Ad Preview
                  </label>
                  <div className="flex gap-2 mb-2">
                    <button
                      type="button"
                      onClick={convertToImage}
                      disabled={converting}
                      className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700 disabled:opacity-50"
                    >
                      {converting ? 'Converting...' : '📷 Convert to JPG'}
                    </button>
                    {generatedImage && (
                      <button
                        type="button"
                        onClick={downloadImage}
                        className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                      >
                        ⬇️ Download
                      </button>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-black mb-1">
                  Or Upload Creative (JPG)
                </label>
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition
                    ${isDragActive ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300 hover:border-gray-400'}
                  `}
                >
                  <input {...getInputProps()} />
                  {preview ? (
                    <div className="relative inline-block">
                      <Image src={preview} alt="Preview" width={160} height={160} className="max-h-40 rounded" />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 text-sm"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="text-black text-sm">
                      {isDragActive ? (
                        <p>Drop the JPG here...</p>
                      ) : (
                        <p>Drag & drop a JPG here, or click to select</p>
                      )}
                    </div>
                  )}
                </div>
                <p className="text-xs text-black mt-1">
                  Use AI generator OR upload your own image
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-black mb-1">
                Live Preview
              </label>
              <div className="border rounded-lg overflow-auto bg-gray-100 p-2 max-h-[500px]">
                {generatedHtml ? (
                  <div className="flex justify-center">
                    <div 
                      ref={adPreviewRef}
                      dangerouslySetInnerHTML={{ __html: generatedHtml }}
                      className="flex-shrink-0"
                    />
                  </div>
                ) : generatedImage ? (
                  <div ref={adPreviewRef}>
                    <img src={generatedImage} alt="Generated Ad" className="max-w-full rounded" />
                  </div>
                ) : preview ? (
                  <div className="flex items-center justify-center h-full">
                    <Image src={preview} alt="Uploaded preview" width={300} height={400} className="max-h-80 rounded" />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                    Preview will appear here
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4 border-t">
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
