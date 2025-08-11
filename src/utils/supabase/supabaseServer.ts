// For server-side calls (e.g. in route handlers), include the service role key:
// lib/supabaseServer.ts
import { createClient } from '@supabase/supabase-js'
export const supabaseServer = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)
