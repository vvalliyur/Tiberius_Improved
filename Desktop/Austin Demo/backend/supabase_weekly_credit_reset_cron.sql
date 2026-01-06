-- Cron job to reset weekly_credit_adjustment to 0 every Thursday at 12:00 AM Texas time (Central Time)
-- This function resets all players' weekly_credit_adjustment to 0

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

-- Create a cron job that runs every Thursday at 12:00 AM Central Time (1:00 AM EST / 6:00 AM UTC during standard time, 5:00 AM UTC during daylight time)
-- Note: Supabase uses pg_cron extension. The schedule is in cron format: minute hour day-of-month month day-of-week
-- This runs at 6:00 AM UTC (which is 12:00 AM Central Standard Time)
-- During daylight saving time, Central Time is UTC-5, so we'd need 5:00 AM UTC
-- We'll use 6:00 AM UTC as the base (CST), and adjust if needed for DST
-- Cron format: minute hour * * day-of-week (0=Sunday, 4=Thursday)

-- To schedule this job, run in Supabase SQL editor:
-- SELECT cron.schedule(
--     'reset-weekly-credit-adjustments',
--     '0 6 * * 4',  -- Every Thursday at 6:00 AM UTC (12:00 AM CST)
--     $$SELECT reset_weekly_credit_adjustments();$$
-- );

-- Alternative: Use 5:00 AM UTC to account for daylight saving time (12:00 AM CDT)
-- SELECT cron.schedule(
--     'reset-weekly-credit-adjustments',
--     '0 5 * * 4',  -- Every Thursday at 5:00 AM UTC (12:00 AM CDT during DST)
--     $$SELECT reset_weekly_credit_adjustments();$$
-- );

-- To check scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule the job:
-- SELECT cron.unschedule('reset-weekly-credit-adjustments');

