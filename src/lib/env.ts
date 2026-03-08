import { z } from 'zod';

const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL must be a valid URL'),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1, 'VITE_SUPABASE_PUBLISHABLE_KEY is required'),
});

function validateEnv() {
  const result = envSchema.safeParse({
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });

  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    console.error('❌ Environment validation failed:', errors);
    throw new Error(`Missing or invalid environment variables: ${Object.keys(errors).join(', ')}`);
  }

  return result.data;
}

export const env = validateEnv();
