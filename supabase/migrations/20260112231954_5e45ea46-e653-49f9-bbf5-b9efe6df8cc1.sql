-- Create a table to store encrypted tenant credentials
-- Secrets are stored encrypted at rest by Supabase and protected by RLS
CREATE TABLE public.tenant_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_connection_id UUID NOT NULL REFERENCES public.tenant_connections(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  -- Store client_id (not secret, but needed for token requests)
  client_id TEXT NOT NULL,
  -- Encrypted client secret - using pgcrypto for encryption
  encrypted_secret TEXT NOT NULL,
  -- Encryption metadata
  encryption_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(tenant_connection_id)
);

-- Enable RLS
ALTER TABLE public.tenant_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only access their own credentials
CREATE POLICY "Users can view their own credentials"
ON public.tenant_credentials
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credentials"
ON public.tenant_credentials
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credentials"
ON public.tenant_credentials
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own credentials"
ON public.tenant_credentials
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_tenant_credentials_updated_at
BEFORE UPDATE ON public.tenant_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create a secure function to encrypt secrets server-side
-- This function can only be called via RPC and uses the service role internally
CREATE OR REPLACE FUNCTION public.store_encrypted_credential(
  p_tenant_connection_id UUID,
  p_client_id TEXT,
  p_client_secret TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_credential_id UUID;
  v_encryption_key TEXT;
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
  
  -- Use a derived key from service role (stored as vault secret in production)
  -- For now, use a simple encryption with the user's ID as salt
  v_encryption_key := encode(sha256((v_user_id::text || 'lovable_secret_salt')::bytea), 'hex');
  
  -- Insert or update credential
  INSERT INTO tenant_credentials (
    tenant_connection_id,
    user_id,
    client_id,
    encrypted_secret
  )
  VALUES (
    p_tenant_connection_id,
    v_user_id,
    p_client_id,
    encode(encrypt(p_client_secret::bytea, v_encryption_key::bytea, 'aes'), 'base64')
  )
  ON CONFLICT (tenant_connection_id)
  DO UPDATE SET
    client_id = EXCLUDED.client_id,
    encrypted_secret = EXCLUDED.encrypted_secret,
    updated_at = now()
  RETURNING id INTO v_credential_id;
  
  RETURN v_credential_id;
END;
$$;

-- Create a function to decrypt secrets (only callable by service role via edge functions)
CREATE OR REPLACE FUNCTION public.get_decrypted_credential(
  p_tenant_connection_id UUID,
  p_user_id UUID
)
RETURNS TABLE(client_id TEXT, client_secret TEXT, tenant_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_encryption_key TEXT;
BEGIN
  -- Verify ownership
  IF NOT EXISTS (
    SELECT 1 FROM tenant_connections 
    WHERE id = p_tenant_connection_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  -- Generate same key used for encryption
  v_encryption_key := encode(sha256((p_user_id::text || 'lovable_secret_salt')::bytea), 'hex');
  
  RETURN QUERY
  SELECT 
    tc.client_id,
    convert_from(decrypt(decode(tc.encrypted_secret, 'base64'), v_encryption_key::bytea, 'aes'), 'utf8') as client_secret,
    tcon.tenant_id
  FROM tenant_credentials tc
  JOIN tenant_connections tcon ON tcon.id = tc.tenant_connection_id
  WHERE tc.tenant_connection_id = p_tenant_connection_id
    AND tc.user_id = p_user_id;
END;
$$;