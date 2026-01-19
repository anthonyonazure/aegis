-- Create enum for schedule frequency (if not exists)
DO $$ BEGIN
    CREATE TYPE public.schedule_frequency AS ENUM ('daily', 'weekly');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for notification channel type
DO $$ BEGIN
    CREATE TYPE public.notification_channel_type AS ENUM ('slack', 'teams', 'email');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create notification channels table
CREATE TABLE IF NOT EXISTS public.notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    channel_type notification_channel_type NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scheduled AI jobs table
CREATE TABLE IF NOT EXISTS public.ai_scheduled_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
    service_type TEXT NOT NULL,
    name TEXT NOT NULL,
    frequency schedule_frequency NOT NULL,
    day_of_week INTEGER,
    time_of_day TIME NOT NULL DEFAULT '09:00:00',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    notification_channel_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add scheduled_job_id to existing ai_analysis_results if not exists
DO $$ BEGIN
    ALTER TABLE public.ai_analysis_results ADD COLUMN scheduled_job_id UUID REFERENCES public.ai_scheduled_jobs(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Enable RLS
ALTER TABLE public.notification_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_scheduled_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_channels
DROP POLICY IF EXISTS "Users can manage their own notification channels" ON public.notification_channels;
CREATE POLICY "Users can manage their own notification channels"
ON public.notification_channels
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS policies for ai_scheduled_jobs
DROP POLICY IF EXISTS "Users can manage their own scheduled jobs" ON public.ai_scheduled_jobs;
CREATE POLICY "Users can manage their own scheduled jobs"
ON public.ai_scheduled_jobs
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_ai_scheduled_jobs_next_run ON public.ai_scheduled_jobs(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_ai_analysis_results_type_date ON public.ai_analysis_results(analysis_type, created_at DESC);

-- Function to calculate next run time
CREATE OR REPLACE FUNCTION public.calculate_next_run(
    p_frequency schedule_frequency,
    p_day_of_week INTEGER,
    p_time_of_day TIME
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
AS $$
DECLARE
    v_next_run TIMESTAMP WITH TIME ZONE;
    v_today DATE := CURRENT_DATE;
    v_now TIMESTAMP WITH TIME ZONE := now();
    v_today_run TIMESTAMP WITH TIME ZONE;
BEGIN
    v_today_run := v_today + p_time_of_day;
    
    IF p_frequency = 'daily' THEN
        IF v_now > v_today_run THEN
            v_next_run := (v_today + INTERVAL '1 day') + p_time_of_day;
        ELSE
            v_next_run := v_today_run;
        END IF;
    ELSIF p_frequency = 'weekly' THEN
        v_next_run := v_today + ((p_day_of_week - EXTRACT(DOW FROM v_today)::INTEGER + 7) % 7) * INTERVAL '1 day' + p_time_of_day;
        IF v_next_run <= v_now THEN
            v_next_run := v_next_run + INTERVAL '7 days';
        END IF;
    END IF;
    
    RETURN v_next_run;
END;
$$;

-- Trigger to auto-update next_run_at
CREATE OR REPLACE FUNCTION public.update_scheduled_job_next_run()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.next_run_at := public.calculate_next_run(NEW.frequency, NEW.day_of_week, NEW.time_of_day);
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_job_next_run ON public.ai_scheduled_jobs;
CREATE TRIGGER trigger_update_job_next_run
BEFORE INSERT OR UPDATE OF frequency, day_of_week, time_of_day, is_active ON public.ai_scheduled_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_scheduled_job_next_run();