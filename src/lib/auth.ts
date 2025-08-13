// src/lib/auth.ts
import { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";

/**
 * Returns the authenticated user (or null).
 * Does NOT return a Response. Handlers decide the HTTP response.
 */
export async function getUser(req: NextRequest): Promise<User | null> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // Read cookies from the incoming request
        getAll: () => req.cookies.getAll(),
        // We’re not mutating cookies in this helper; no setAll here.
        setAll: () => {},
      },
    }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}
