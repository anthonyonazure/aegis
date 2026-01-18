-- Add tenant_connection_id to audit_logs for customer/tenant filtering
ALTER TABLE public.audit_logs 
ADD COLUMN tenant_connection_id UUID REFERENCES public.tenant_connections(id) ON DELETE SET NULL;

-- Add index for efficient filtering
CREATE INDEX idx_audit_logs_tenant_connection_id ON public.audit_logs(tenant_connection_id);