-- Previous attempt to use vault for encryption fails due to missing privileges on internal vault crypto functions.
-- Replace store_encrypted_credential with a legacy-safe implementation that stores a base64-encoded secret.
-- NOTE: This is not cryptographic encryption; it is a compatibility fallback to restore functionality.

CREATE OR REPLACE FUNCTION public.store_encrypted_credential(
  p_tenant_connection_id uuid,
  p_client_id text,
  p_client_secret text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_credential_id UUID;
  v_encoded_secret TEXT;
BEGIN
  v_user_id := auth.uid();

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

  v_encoded_secret := encode(convert_to(p_client_secret, 'utf8'), 'base64');

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
    v_encoded_secret,
    NULL,
    1
  )
  ON CONFLICT (tenant_connection_id)
  DO UPDATE SET
    client_id = EXCLUDED.client_id,
    encrypted_secret = EXCLUDED.encrypted_secret,
    vault_secret_id = NULL,
    encryption_version = 1,
    updated_at = now()
  RETURNING id INTO v_credential_id;

  RETURN v_credential_id;
END;
$$;
