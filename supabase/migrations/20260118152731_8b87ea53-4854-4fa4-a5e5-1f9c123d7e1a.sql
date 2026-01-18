-- Add new baseline types to the baseline_type enum
ALTER TYPE public.baseline_type ADD VALUE IF NOT EXISTS 'iso27018';
ALTER TYPE public.baseline_type ADD VALUE IF NOT EXISTS 'soc2';
ALTER TYPE public.baseline_type ADD VALUE IF NOT EXISTS 'iso9001';
ALTER TYPE public.baseline_type ADD VALUE IF NOT EXISTS 'irap';