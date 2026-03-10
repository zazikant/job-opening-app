import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import nodemailer from 'nodemailer'

const TIMEZONE = 'Asia/Kolkata'

function getISTDate(): { date: string; time: string } {
  const now = new Date()
  const istDate = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }))
  const date = istDate.toISOString().split('T')[0]
  const hours = istDate.getHours().toString().padStart(2, '0')
  const minutes = istDate.getMinutes().toString().padStart(2, '0')
  return {
    date,
    time: `${hours}:${minutes}`
  }
}

function formatISTDisplay(date: Date): string {
  const istDate = new Date(date.toLocaleString('en-US', { timeZone: TIMEZONE }))
  return istDate.toISOString().replace('T', ' ').substring(0, 16) + ' IST'
}

export async function POST() {
  try {
    const supabase = createClient()

    const { date: currentDateIST, time: currentTimeIST } = getISTDate()

    const { data: pendingJobs, error: queryError } = await supabase
      .from('job_openings')
      .select('*')
      .eq('sent_status', 'pending')
      .not('mail_send_date', 'is', null)

    if (queryError) {
      return NextResponse.json({ error: queryError.message }, { status: 500 })
    }

    const jobsToSend = (pendingJobs || []).filter(job => {
      if (!job.mail_send_date) return false
      
      const mailDate = new Date(job.mail_send_date)
      const mailDateIST = new Date(mailDate.toLocaleString('en-US', { timeZone: TIMEZONE }))
      const mailDateStr = mailDateIST.toISOString().split('T')[0]
      const mailHours = mailDateIST.getHours().toString().padStart(2, '0')
      const mailMinutes = mailDateIST.getMinutes().toString().padStart(2, '0')
      const mailTime = `${mailHours}:${mailMinutes}`
      
      return mailDateStr === currentDateIST && mailTime <= currentTimeIST
    })

    if (jobsToSend.length === 0) {
      return NextResponse.json({ 
        message: 'No jobs scheduled to send',
        currentTime: `${currentDateIST} ${currentTimeIST} IST`,
        jobsFound: 0
      })
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
      <p>Sent at: ${formatISTDisplay(new Date())}</p>
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

    const jobIds = jobsToSend.map(j => j.id)
    await supabase
      .from('job_openings')
      .update({ 
        sent_status: 'sent', 
        mail_send_date: null,
        updated_at: new Date().toISOString() 
      })
      .in('id', jobIds)

    return NextResponse.json({ 
      success: true, 
      sent_count: jobsToSend.length,
      jobs: jobIds,
      sentAt: formatISTDisplay(new Date())
    })

  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ 
      error: `Failed to send scheduled emails: ${message}` 
    }, { status: 500 })
  }
}
