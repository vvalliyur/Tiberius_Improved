-- Cron job to reset weekly_credit_adjustment to 0 every Thursday at 12:00 AM Texas time (Central Time)
-- This function resets all players' weekly_credit_adjustment to 0

-- STEP 1: Enable the pg_cron extension (run this first if you get a "schema cron does not exist" error)
-- Note: In Supabase, you may need to enable this extension in the dashboard under Database > Extensions
-- Or run this SQL command:
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- STEP 2: Create the function that resets weekly credit adjustments
CREATE OR REPLACE FUNCTION reset_weekly_credit_adjustments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE players
    SET weekly_credit_adjustment = 0,
        updated_at = NOW()
    WHERE weekly_credit_adjustment != 0;
END;
$$;

-- STEP 3: Schedule the cron job
-- Create a cron job that runs every Thursday at 12:00 AM Central Time
-- Note: Supabase uses pg_cron extension. The schedule is in cron format: minute hour day-of-month month day-of-week
-- Central Time is UTC-6 (CST) or UTC-5 (CDT during daylight saving time)
-- We'll use 6:00 AM UTC as the base (12:00 AM CST), which works for most of the year
-- Cron format: minute hour * * day-of-week (0=Sunday, 4=Thursday)

-- Schedule the job (run this after enabling pg_cron):
SELECT cron.schedule(
    'reset-weekly-credit-adjustments',
    '0 6 * * 4',  -- Every Thursday at 6:00 AM UTC (12:00 AM Central Standard Time)
    $$SELECT reset_weekly_credit_adjustments();$$
);

-- Alternative: If you need to account for daylight saving time, you can schedule two jobs:
-- One for CST (6:00 AM UTC) and one for CDT (5:00 AM UTC), but this requires manual management
-- Or use 5:00 AM UTC to cover CDT, but this will run at 11:00 PM Wednesday during CST:
-- SELECT cron.schedule(
--     'reset-weekly-credit-adjustments',
--     '0 5 * * 4',  -- Every Thursday at 5:00 AM UTC (12:00 AM CDT during DST, 11:00 PM Wednesday during CST)
--     $$SELECT reset_weekly_credit_adjustments();$$
-- );

-- To check scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule the job:
-- SELECT cron.unschedule('reset-weekly-credit-adjustments');

