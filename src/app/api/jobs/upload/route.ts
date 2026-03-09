import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  
  const formData = await request.formData()
  const file = formData.get('file') as File
  const jobData = formData.get('jobData') as string

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const fileExt = file.name.split('.').pop()
  const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`

  const { error: uploadError } = await supabase.storage
    .from('job-creatives')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage
    .from('job-creatives')
    .getPublicUrl(fileName)

  const parsedJobData = jobData ? JSON.parse(jobData) : {}
  
  const { data, error } = await supabase
    .from('job_openings')
    .insert([{
      ...parsedJobData,
      creative_url: publicUrl,
    }])
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
