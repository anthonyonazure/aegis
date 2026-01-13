-- Create table for custom resource templates
CREATE TABLE public.resource_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  resource_ids TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.resource_templates ENABLE ROW LEVEL SECURITY;

-- Users can only view their own templates
CREATE POLICY "Users can view their own templates"
ON public.resource_templates
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own templates
CREATE POLICY "Users can create their own templates"
ON public.resource_templates
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own templates
CREATE POLICY "Users can update their own templates"
ON public.resource_templates
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete their own templates"
ON public.resource_templates
FOR DELETE
USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_resource_templates_updated_at
BEFORE UPDATE ON public.resource_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();