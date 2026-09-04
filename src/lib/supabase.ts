import { createClient } from '@supabase/supabase-js';

// This key is Supabase's "publishable" key (successor to the legacy `anon` key).
// It is explicitly designed to be embedded in public, client-side code — it has
// no privileged access and is safe to ship in the browser bundle. Never put a
// `service_role` / "secret" key here.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vcsbitkftcnyywfodrue.supabase.co';
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_KEY || 'sb_publishable_x2rTn8wapImzr707MT7wxw_qOs9U40s';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
