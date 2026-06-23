// Runtime configuration. Values come from public/config.js (copied to the site
// root at build time), so you can add your Supabase keys by editing that file
// with a text editor — no rebuild needed.
const c = (typeof window !== "undefined" && window.LOF_CONFIG) || {};
export const SUPABASE_URL = c.SUPABASE_URL || "";
export const SUPABASE_ANON_KEY = c.SUPABASE_ANON_KEY || "";
