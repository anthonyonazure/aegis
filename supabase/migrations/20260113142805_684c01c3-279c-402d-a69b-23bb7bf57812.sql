-- Fix credential encryption: Use Supabase Vault for secure secret storage
-- This replaces the insecure base64 encoding with proper encryption

-- Add vault_secret_id column to tenant_credentials to reference vault secrets
ALTER TABLE public.tenant_credentials 
ADD COLUMN IF NOT EXISTS vault_secret_id uuid;

-- Create or replace the store_encrypted_credential function to use Vault
CREATE OR REPLACE FUNCTION public.store_encrypted_credential(
  p_tenant_connection_id uuid, 
  p_client_id text, 
  p_client_secret text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_credential_id UUID;
  v_vault_secret_id UUID;
  v_existing_vault_id UUID;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Verify user owns the tenant connection
  IF NOT EXISTS (
    SELECT 1 FROM tenant_connections 
    WHERE id = p_tenant_connection_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Check if there's an existing credential with a vault secret
  SELECT tc.vault_secret_id INTO v_existing_vault_id
  FROM tenant_credentials tc
  WHERE tc.tenant_connection_id = p_tenant_connection_id;
  
  -- Delete old vault secret if it exists
  IF v_existing_vault_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_existing_vault_id;
  END IF;
  
  -- Store secret in Supabase Vault (properly encrypted)
  INSERT INTO vault.secrets (secret, name, description)
  VALUES (
    p_client_secret,
    'tenant_credential_' || p_tenant_connection_id::text,
    'Microsoft 365 client secret for tenant connection'
  )
  RETURNING id INTO v_vault_secret_id;
  
  -- Store credential with vault reference (no longer storing the secret itself)
  INSERT INTO tenant_credentials (
    tenant_connection_id,
    user_id,
    client_id,
    encrypted_secret,
    vault_secret_id,
    encryption_version
  )
  VALUES (
    p_tenant_connection_id,
    v_user_id,
    p_client_id,
    'VAULT_ENCRYPTED', -- Placeholder to maintain NOT NULL constraint
    v_vault_secret_id,
    2 -- Version 2 indicates vault encryption
  )
  ON CONFLICT (tenant_connection_id)
  DO UPDATE SET
    client_id = EXCLUDED.client_id,
    encrypted_secret = 'VAULT_ENCRYPTED',
    vault_secret_id = v_vault_secret_id,
    encryption_version = 2,
    updated_at = now()
  RETURNING id INTO v_credential_id;
  
  RETURN v_credential_id;
END;
$$;

-- Create or replace get_decrypted_credential to retrieve from Vault
CREATE OR REPLACE FUNCTION public.get_decrypted_credential(
  p_tenant_connection_id uuid, 
  p_user_id uuid
)
RETURNS TABLE(client_id text, client_secret text, tenant_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_version integer;
  v_vault_secret_id uuid;
  v_encrypted_secret text;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM tenant_connections 
    WHERE id = p_tenant_connection_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Get encryption version to handle migration
  SELECT tc.encryption_version, tc.vault_secret_id, tc.encrypted_secret
  INTO v_encryption_version, v_vault_secret_id, v_encrypted_secret
  FROM tenant_credentials tc
  WHERE tc.tenant_connection_id = p_tenant_connection_id
    AND tc.user_id = p_user_id;
  
  -- Handle based on encryption version
  IF v_encryption_version = 2 AND v_vault_secret_id IS NOT NULL THEN
    -- Version 2: Retrieve from Vault
    RETURN QUERY
    SELECT 
      tc.client_id,
      vs.decrypted_secret as client_secret,
      tcon.tenant_id
    FROM tenant_credentials tc
    JOIN vault.decrypted_secrets vs ON vs.id = tc.vault_secret_id
    JOIN tenant_connections tcon ON tcon.id = tc.tenant_connection_id
    WHERE tc.tenant_connection_id = p_tenant_connection_id
      AND tc.user_id = p_user_id;
  ELSE
    -- Version 1 (legacy base64): Decode and return
    -- Users should re-authenticate to upgrade to vault encryption
    RETURN QUERY
    SELECT 
      tc.client_id,
      convert_from(decode(tc.encrypted_secret, 'base64'), 'utf8') as client_secret,
      tcon.tenant_id
    FROM tenant_credentials tc
    JOIN tenant_connections tcon ON tcon.id = tc.tenant_connection_id
    WHERE tc.tenant_connection_id = p_tenant_connection_id
      AND tc.user_id = p_user_id;
  END IF;
END;
$$;

-- Grant necessary permissions for vault access to the functions
GRANT USAGE ON SCHEMA vault TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON vault.secrets TO postgres, service_role;