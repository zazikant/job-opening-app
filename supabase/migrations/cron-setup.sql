-- Enable required extensions
-- Run this in Supabase SQL Editor

-- Enable pg_cron for scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net for HTTP requests (needed to call Edge Function)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Schedule the Edge Function to run every 15 minutes
-- Adjust the cron expression as needed:
-- '*/15 * * * *' = every 15 minutes
-- '0 * * * *' = every hour
-- '0 9 * * *' = every day at 9 AM

SELECT cron.schedule(
  'send-scheduled-job-emails',
  '*/15 * * * *', -- runs every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/send-scheduled-mails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'triggered_by', 'cron',
      'cron_job', 'send-scheduled-job-emails'
    )
  );
  $$
);

-- To unschedule, run:
-- SELECT cron.unschedule('send-scheduled-job-emails');

-- To view scheduled jobs:
-- SELECT * FROM cron.job;
