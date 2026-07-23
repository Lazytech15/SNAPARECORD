// EDIT ME: set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in your .env.
//
// This is the ONE Supabase client for the whole app — auth, database, and
// storage all go through it. `authApi.ts` wraps it in a request()-shaped
// adapter so the rest of snaparecord (AuthDataClient's caching/polling)
// never has to know it's talking to Supabase instead of a REST server.
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
