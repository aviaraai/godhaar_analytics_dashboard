import { AuthClient } from "@supabase/auth-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
console.log(import.meta.env);
if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — see .env.example.",
  );
}

export const auth = new AuthClient({
  url: `${url}/auth/v1`,
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
  },
  storageKey: "godhaar.admin.auth",
  persistSession: true,
  autoRefreshToken: true,
  detectSessionInUrl: false,
});
