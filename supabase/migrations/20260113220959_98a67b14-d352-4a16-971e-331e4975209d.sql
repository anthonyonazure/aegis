-- Add retry tracking columns to webhook_logs
ALTER TABLE public.webhook_logs 
ADD COLUMN retry_count integer NOT NULL DEFAULT 0,
ADD COLUMN max_retries integer NOT NULL DEFAULT 3,
ADD COLUMN next_retry_at timestamp with time zone,
ADD COLUMN original_log_id uuid REFERENCES public.webhook_logs(id);