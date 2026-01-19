-- Fix function search paths
CREATE OR REPLACE FUNCTION public.calculate_next_run(
    p_frequency schedule_frequency,
    p_day_of_week INTEGER,
    p_time_of_day TIME
)
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
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

CREATE OR REPLACE FUNCTION public.update_scheduled_job_next_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
    NEW.next_run_at := public.calculate_next_run(NEW.frequency, NEW.day_of_week, NEW.time_of_day);
    NEW.updated_at := now();
    RETURN NEW;
END;
$$;