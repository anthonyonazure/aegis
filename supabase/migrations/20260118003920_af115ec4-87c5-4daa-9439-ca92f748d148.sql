-- Add columns for encrypted API credentials to PSA integrations
ALTER TABLE public.psa_integrations
  ADD COLUMN IF NOT EXISTS vault_secret_id UUID,
  ADD COLUMN IF NOT EXISTS last_connection_test TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS connection_status TEXT DEFAULT 'untested';

-- Create a function to store PSA credentials securely in vault
CREATE OR REPLACE FUNCTION public.store_psa_credential(
  p_integration_id UUID, 
  p_api_key TEXT,
  p_api_secret TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_existing_vault_id UUID;
  v_vault_secret_id UUID;
  v_secret_data TEXT;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Verify user owns the integration
  IF NOT EXISTS (
    SELECT 1 FROM psa_integrations 
    WHERE id = p_integration_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Check if there's an existing vault secret
  SELECT vault_secret_id INTO v_existing_vault_id
  FROM psa_integrations
  WHERE id = p_integration_id;
  
  -- Delete old vault secret if it exists
  IF v_existing_vault_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_existing_vault_id;
  END IF;
  
  -- Combine API key and secret into JSON
  v_secret_data := json_build_object(
    'api_key', p_api_key,
    'api_secret', COALESCE(p_api_secret, '')
  )::text;
  
  -- Store secret in Supabase Vault
  INSERT INTO vault.secrets (secret, name, description)
  VALUES (
    v_secret_data,
    'psa_integration_' || p_integration_id::text,
    'PSA integration API credentials'
  )
  RETURNING id INTO v_vault_secret_id;
  
  -- Update integration with vault reference
  UPDATE psa_integrations
  SET vault_secret_id = v_vault_secret_id
  WHERE id = p_integration_id;
  
  RETURN v_vault_secret_id;
END;
$$;

-- Create a function to retrieve decrypted PSA credentials
CREATE OR REPLACE FUNCTION public.get_psa_credential(p_integration_id UUID)
RETURNS TABLE(api_key TEXT, api_secret TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_vault_secret_id UUID;
  v_secret_data JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Get vault secret ID
  SELECT pi.vault_secret_id INTO v_vault_secret_id
  FROM psa_integrations pi
  WHERE pi.id = p_integration_id AND pi.user_id = v_user_id;
  
  IF v_vault_secret_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Get and parse the secret
  SELECT ds.decrypted_secret::jsonb INTO v_secret_data
  FROM vault.decrypted_secrets ds
  WHERE ds.id = v_vault_secret_id;
  
  RETURN QUERY SELECT 
    v_secret_data->>'api_key',
    v_secret_data->>'api_secret';
END;
$$;