-- job-kit billing schedules. Run once in the Supabase SQL editor AFTER billing.sql, with the
-- pg_cron extension turned on (Database > Extensions). Not exercised by the pglite tests.
-- Re-running replaces a job of the same name.

-- Refund generations whose function died before settling (every 5 minutes).
select cron.schedule('reap-reserved', '*/5 * * * *', 'select public.reap_reserved()');

-- Zero balances past their expiry (17:15 UTC = 00:15 WIB).
select cron.schedule('expire-credits', '15 17 * * *', 'select public.expire_credits()');
