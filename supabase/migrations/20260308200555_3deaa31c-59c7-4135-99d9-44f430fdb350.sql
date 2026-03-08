
-- Allow encrypted_secret to be nullable (vault-based credentials don't need it)
ALTER TABLE public.tenant_credentials ALTER COLUMN encrypted_secret DROP NOT NULL;

-- Recreate the function to accept a user_id parameter for edge function usage
CREATE OR REPLACE FUNCTION public.store_encrypted_credential(
  p_tenant_connection_id uuid,
  p_client_id text,
  p_client_secret text,
  p_user_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_credential_id UUID;
  v_existing_vault_id UUID;
  v_vault_secret_id UUID;
BEGIN
  -- Use provided user_id or fall back to auth.uid()
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user owns the tenant connection
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_connections
    WHERE id = p_tenant_connection_id AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- Check if there's an existing credential with a vault secret
  SELECT vault_secret_id INTO v_existing_vault_id
  FROM public.tenant_credentials
  WHERE tenant_connection_id = p_tenant_connection_id;

  -- Delete old vault secret if it exists
  IF v_existing_vault_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = v_existing_vault_id;
  END IF;

  -- Store secret in Supabase Vault with proper encryption
  INSERT INTO vault.secrets (secret, name, description)
  VALUES (
    p_client_secret,
    'tenant_credential_' || p_tenant_connection_id::text,
    'Service principal client secret for tenant connection'
  )
  RETURNING id INTO v_vault_secret_id;

  -- Upsert credential with vault reference (encryption_version = 2)
  INSERT INTO public.tenant_credentials (
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
    NULL,
    v_vault_secret_id,
    2
  )
  ON CONFLICT (tenant_connection_id)
  DO UPDATE SET
    client_id = EXCLUDED.client_id,
    encrypted_secret = NULL,
    vault_secret_id = v_vault_secret_id,
    encryption_version = 2,
    updated_at = now()
  RETURNING id INTO v_credential_id;

  RETURN v_credential_id;
END;
$$;
