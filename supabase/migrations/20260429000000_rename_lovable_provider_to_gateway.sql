-- Rename built-in AI provider id from 'lovable' to 'gateway' as part of the Aegis rebrand.
-- Updates existing rows and changes column defaults so new rows pick up the new id.

-- Drop existing default before updating values to avoid coupling
ALTER TABLE public.ai_conversations ALTER COLUMN provider DROP DEFAULT;

-- Update existing rows to the new provider id
UPDATE public.ai_provider_settings SET provider = 'gateway' WHERE provider = 'lovable';
UPDATE public.ai_conversations    SET provider = 'gateway' WHERE provider = 'lovable';

-- Restore default with the new value
ALTER TABLE public.ai_conversations ALTER COLUMN provider SET DEFAULT 'gateway';
