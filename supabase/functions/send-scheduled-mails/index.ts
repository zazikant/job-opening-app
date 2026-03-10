import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import nodemailer from "npm:nodemailer@6"

interface Job {
  id: string
  vertical: string
  job_function: string
  location: string
  mail_send_date: string
  creative_url: string | null
}

function toIST(date: Date): Date {
  return new Date(date.getTime() + (5.5 * 60 * 60 * 1000))
}

function formatIST(date: Date): string {
  const ist = toIST(date)
  return ist.toISOString().replace('T', ' ').substring(0, 16)
}

Deno.serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const now = new Date()
    const nowIST = toIST(now)
    const currentDateIST = nowIST.toISOString().split('T')[0]
    const currentTimeIST = `${nowIST.getHours().toString().padStart(2, '0')}:${nowIST.getMinutes().toString().padStart(2, '0')}`

    const jobsRes = await fetch(`${supabaseUrl}/rest/v1/job_openings?sent_status=eq.pending&mail_send_date=not.is.null&select=*`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
      }
    })

    const allJobs: Job[] = await jobsRes.json()

    const jobsToSend = allJobs.filter(job => {
      if (!job.mail_send_date) return false
      const [datePart, timePart] = job.mail_send_date.split(' ')
      return datePart === currentDateIST && timePart && timePart <= currentTimeIST
    })

    if (jobsToSend.length === 0) {
      return new Response(JSON.stringify({
        message: 'No jobs scheduled to send',
        currentTime: formatIST(now),
        jobsFound: 0
      }), { headers: { 'Content-Type': 'application/json' } })
    }

    const transporter = nodemailer.createTransport({
      host: Deno.env.get('SMTP_HOST'),
      port: Number(Deno.env.get('SMTP_PORT') || 587),
      secure: false,
      auth: {
        user: Deno.env.get('SMTP_USER'),
        pass: Deno.env.get('SMTP_PASS'),
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
      <p>Sent at: ${formatIST(now)} IST</p>
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
      from: Deno.env.get('SMTP_FROM'),
      to: Deno.env.get('MAIL_TO'),
      subject: `Job Openings - ${jobsToSend.length} Positions Available`,
      text: textBody,
      html: htmlBody,
    }

    await transporter.sendMail(mailOptions)

    const jobIds = jobsToSend.map(j => j.id)

    for (const id of jobIds) {
      await fetch(`${supabaseUrl}/rest/v1/job_openings?id=eq.${id}`, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({
          sent_status: 'sent',
          mail_send_date: null,
          updated_at: new Date().toISOString()
        })
      })
    }

    return new Response(JSON.stringify({
      success: true,
      sent_count: jobsToSend.length,
      jobs: jobIds,
      sentAt: formatIST(now)
    }), { headers: { 'Content-Type': 'application/json' } })

  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return new Response(JSON.stringify({
      error: `Failed to send scheduled emails: ${message}`
    }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
})
