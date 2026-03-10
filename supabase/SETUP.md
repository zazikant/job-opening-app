# Supabase Cron Setup for Scheduled Emails

This document explains how to set up automatic scheduled email sending using Supabase's pg_cron.

## Prerequisites

1. **Supabase Project** - You need a Supabase project
2. **SMTP Credentials** - Configure in Supabase Edge Function secrets
3. **Supabase CLI** - Install from https://github.com/supabase/cli

## Step 1: Configure Edge Function Secrets

Set the following secrets in your Supabase project:

```bash
supabase secrets set SMTP_HOST=your-smtp-host
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=your-email
supabase secrets set SMTP_PASS=your-password
supabase secrets set SMTP_FROM=your-email@domain.com
supabase secrets set MAIL_TO=recipient@example.com
```

## Step 2: Deploy the Edge Function

```bash
cd supabase
supabase functions deploy send-scheduled-mails
```

## Step 3: Enable Extensions & Schedule Cron

1. Go to your Supabase Dashboard
2. Open the **SQL Editor**
3. Run the SQL from `supabase/migrations/cron-setup.sql`

**Important**: Update the URL in the SQL to match your project:
```sql
url := 'https://your-project-ref.supabase.co/functions/v1/send-scheduled-mails'
```

Replace `your-project-ref` with your actual Supabase project reference.

## Cron Schedule Options

| Expression | Runs |
|------------|------|
| `*/15 * * * *` | Every 15 minutes |
| `*/30 * * * *` | Every 30 minutes |
| `0 * * * *` | Every hour |
| `0 9 * * *` | Every day at 9 AM |
| `0 9 * * 1-5` | Weekdays at 9 AM |

## Verify Setup

Check scheduled jobs:
```sql
SELECT * FROM cron.job;
```

View job run history:
```sql
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;
```

## Troubleshooting

1. **Check Edge Function logs**: Supabase Dashboard → Edge Functions → send-scheduled-mails → Logs
2. **pg_net not working**: Make sure pg_net extension is enabled
3. **Emails not sending**: Verify SMTP credentials and MAIL_TO address
