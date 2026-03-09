import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import nodemailer from 'nodemailer'

function toIST(date: Date): Date {
  return new Date(date.getTime() + (5.5 * 60 * 60 * 1000))
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { jobIds, includeScheduled } = body

    const supabase = createClient()

    let jobsToSend: Record<string, unknown>[] = []

    if (jobIds && jobIds.length > 0) {
      const { data: selectedJobs, error: selectedError } = await supabase
        .from('job_openings')
        .select('*')
        .in('id', jobIds)
      
      if (selectedError) {
        return NextResponse.json({ error: selectedError.message }, { status: 500 })
      }
      
      if (selectedJobs) {
        jobsToSend = [...selectedJobs]
      }
    }

    if (includeScheduled) {
      const now = new Date()
      const nowIST = toIST(now)
      const currentDateTime = nowIST.toISOString().replace('T', ' ').substring(0, 16)

      const { data: scheduledJobs, error: scheduledError } = await supabase
        .from('job_openings')
        .select('*')
        .not('mail_send_date', 'is', null)
        .eq('sent_status', 'pending')
        .lte('mail_send_date', currentDateTime)

      if (scheduledError) {
        return NextResponse.json({ error: scheduledError.message }, { status: 500 })
      }

      if (scheduledJobs) {
        const existingIds = new Set(jobsToSend.map(j => j.id))
        const newScheduled = scheduledJobs.filter(j => !existingIds.has(j.id))
        jobsToSend = [...jobsToSend, ...newScheduled]
      }
    }

    if (jobsToSend.length === 0) {
      const { data: allPending } = await supabase
        .from('job_openings')
        .select('id')
        .eq('sent_status', 'pending')
      
      if (!allPending || allPending.length === 0) {
        return NextResponse.json({ error: 'No jobs to send. Select jobs or set a scheduled date.' }, { status: 400 })
      }
      return NextResponse.json({ error: 'No jobs ready to send. Scheduled jobs will be sent when time arrives.' }, { status: 400 })
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

    const jobList = jobsToSend.map((job, idx) => {
      const creativeLink = job.creative_url 
        ? `<a href="${job.creative_url}" target="_blank">View Creative</a>`
        : 'No creative'
      
      return `${idx + 1}. <strong>${job.vertical}</strong> | ${job.job_function} | ${job.location} | ${creativeLink}`
    }).join('<br/>')

    const htmlBody = `
      <h2>Job Vacancies</h2>
      <p>Total Positions: ${jobsToSend.length}</p>
      <hr/>
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        ${jobList}
      </div>
      <hr/>
      <p style="color: #666; font-size: 12px;">
        This is an automated job vacancy notification.
      </p>
    `

    const textBody = jobsToSend.map((job, idx) => {
      const creativeLink = job.creative_url || 'No creative'
      return `${idx + 1}. Vertical: ${job.vertical} | Function: ${job.job_function} | Location: ${job.location} | Creative: ${creativeLink}`
    }).join('\n')

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: process.env.MAIL_TO,
      subject: `Job Openings - ${jobsToSend.length} Positions Available`,
      text: textBody,
      html: htmlBody,
    }

    await transporter.sendMail(mailOptions)

    const sentJobIds = jobsToSend.map(j => j.id)
    await supabase
      .from('job_openings')
      .update({ 
        sent_status: 'sent', 
        mail_send_date: null,
        updated_at: new Date().toISOString() 
      })
      .in('id', sentJobIds)

    return NextResponse.json({ 
      success: true, 
      sent_count: jobsToSend.length,
      jobs: sentJobIds
    })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ 
      error: `Failed to send email: ${message}` 
    }, { status: 500 })
  }
}
