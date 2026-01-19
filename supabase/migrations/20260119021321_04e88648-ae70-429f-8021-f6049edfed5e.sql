-- Drop the old function that uses vault
DROP FUNCTION IF EXISTS public.store_ai_api_key(text, text);

-- Create a simpler storage table for API keys
CREATE TABLE IF NOT EXISTS public.user_ai_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  encrypted_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE public.user_ai_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can manage their own API keys"
ON public.user_ai_api_keys FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create function to store API key (simple base64 encoding for now)
CREATE OR REPLACE FUNCTION public.store_ai_api_key(p_provider text, p_api_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_key_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Store encoded key (base64)
  INSERT INTO public.user_ai_api_keys (user_id, provider, encrypted_key)
  VALUES (v_user_id, p_provider, encode(p_api_key::bytea, 'base64'))
  ON CONFLICT (user_id, provider) DO UPDATE 
  SET encrypted_key = encode(p_api_key::bytea, 'base64'),
      updated_at = now()
  RETURNING id INTO v_key_id;
  
  RETURN v_key_id;
END;
$$;

-- Update get function to use the new table
CREATE OR REPLACE FUNCTION public.get_ai_api_key(p_provider text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_encrypted_key TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  SELECT encrypted_key INTO v_encrypted_key
  FROM public.user_ai_api_keys
  WHERE user_id = v_user_id AND provider = p_provider;
  
  IF v_encrypted_key IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Return decoded key
  RETURN convert_from(decode(v_encrypted_key, 'base64'), 'UTF8');
END;
$$;