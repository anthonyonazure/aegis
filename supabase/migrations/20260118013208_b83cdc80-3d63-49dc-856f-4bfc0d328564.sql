-- Add unique constraint on tenant_connection_id for upsert support
ALTER TABLE public.tenant_secure_scores 
ADD CONSTRAINT tenant_secure_scores_tenant_connection_id_key UNIQUE (tenant_connection_id);