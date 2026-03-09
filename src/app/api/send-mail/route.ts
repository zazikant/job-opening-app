import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import nodemailer from 'nodemailer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { jobIds } = body

    const supabase = createClient()

    let query = supabase.from('job_openings').select('*')
    
    if (jobIds && jobIds.length > 0) {
      query = query.in('id', jobIds)
    }
    
    const { data: jobs, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!jobs || jobs.length === 0) {
      return NextResponse.json({ error: 'No jobs found' }, { status: 400 })
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    const jobList = jobs.map((job, idx) => {
      const creativeLink = job.creative_url 
        ? `<a href="${job.creative_url}" target="_blank">View Creative</a>`
        : 'No creative'
      
      return `${idx + 1}. <strong>${job.vertical}</strong> | ${job.job_function} | ${job.location} | ${creativeLink}`
    }).join('<br/>')

    const htmlBody = `
      <h2>Job Vacancies</h2>
      <p>Total Positions: ${jobs.length}</p>
      <hr/>
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        ${jobList}
      </div>
      <hr/>
      <p style="color: #666; font-size: 12px;">
        This is an automated job vacancy notification.
      </p>
    `

    const textBody = jobs.map((job, idx) => {
      const creativeLink = job.creative_url || 'No creative'
      return `${idx + 1}. Vertical: ${job.vertical} | Function: ${job.job_function} | Location: ${job.location} | Creative: ${creativeLink}`
    }).join('\n')

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: process.env.MAIL_TO,
      subject: `Job Openings - ${jobs.length} Positions Available`,
      text: textBody,
      html: htmlBody,
    }

    await transporter.sendMail(mailOptions)

    return NextResponse.json({ 
      success: true, 
      sent_count: jobs.length,
      jobs: jobs.map(j => j.id)
    })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ 
      error: `Failed to send email: ${message}` 
    }, { status: 500 })
  }
}
