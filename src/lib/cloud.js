// Optional cloud layer (accounts, sync, sharing, photo backup) via Supabase.
// If no keys are configured the app runs happily in local-only mode.

import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";

export const cloudEnabled = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
export const supabase = cloudEnabled
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;

// Always returns a valid, fresh session or null — refreshing if needed.
// Use this right before any authenticated call (e.g. uploads) so we never
// fire a request while the token is missing or stale.
export async function requireSession() {
  if (!supabase) return null;
  let { data } = await supabase.auth.getSession();
  if (!data.session) {
    // Try a refresh in case the stored token just needs reviving.
    const r = await supabase.auth.refreshSession();
    data = r.data;
  }
  return data.session || null;
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

export function onAuthChange(cb) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export function signInWithEmail(email) {
  return supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname },
  });
}

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
}

export function signOut() { return supabase.auth.signOut(); }

export async function ensureProfile() {
  const session = await getSession();
  if (!session) return null;
  const uid = session.user.id;
  const { data } = await supabase.from("profiles")
    .select("share_id, display_name, on_leaderboard").eq("user_id", uid).maybeSingle();
  if (data && data.share_id) return data;
  const ins = await supabase.from("profiles").insert({ user_id: uid })
    .select("share_id, display_name, on_leaderboard").single();
  return ins.data || null;
}

export async function updateProfile({ display_name, on_leaderboard }) {
  const session = await getSession();
  if (!session) return;
  const patch = {};
  if (display_name !== undefined) patch.display_name = display_name;
  if (on_leaderboard !== undefined) patch.on_leaderboard = on_leaderboard;
  const { error } = await supabase.from("profiles").update(patch).eq("user_id", session.user.id);
  if (error) throw error;
}

export async function fetchLeaderboard() {
  const { data, error } = await supabase.rpc("get_leaderboard");
  if (error) throw error;
  return data || [];
}

export async function fetchMyScore() {
  const { data, error } = await supabase.rpc("my_score");
  if (error) throw error;
  return (data && data[0]) || { visited_pts: 0, tag_pts: 0, photo_pts: 0, total: 0 };
}

export async function pullAll() {
  const { data, error } = await supabase.from("progress").select("place_id,state,tags,updated_at");
  if (error) throw error;
  return data || [];
}

export async function pushPlaces(rows) {
  const session = await getSession();
  if (!session || !rows.length) return;
  const uid = session.user.id;
  const payload = rows.map((r) => ({ ...r, user_id: uid }));
  const { error } = await supabase.from("progress").upsert(payload);
  if (error) throw error;
}

export async function fetchShared(shareId) {
  const { data, error } = await supabase.rpc("get_shared_map", { p_share_id: shareId });
  if (error) throw error;
  return data || [];
}

const photoKey = (uid, placeId) => `${uid}/${placeId.replace(":", "_")}.jpg`;

export function publicPhotoUrl(ownerId, placeId) {
  return `${SUPABASE_URL}/storage/v1/object/public/photos/${photoKey(ownerId, placeId)}`;
}

export async function uploadPhoto(placeId, dataUrl) {
  const session = await requireSession();
  if (!session) throw new Error("Not signed in — please sign in again to save photos to the cloud.");
  const blob = await (await fetch(dataUrl)).blob();
  const { error } = await supabase.storage
    .from("photos")
    .upload(photoKey(session.user.id, placeId), blob, { upsert: true, contentType: "image/jpeg" });
  if (error) throw error;
  await supabase.from("photos_meta").upsert({ user_id: session.user.id, place_id: placeId }).then(() => {}, () => {});
  return publicPhotoUrl(session.user.id, placeId);
}

export async function removeCloudPhoto(placeId) {
  const session = await getSession();
  if (!session) return;
  await supabase.storage.from("photos").remove([photoKey(session.user.id, placeId)]);
  await supabase.from("photos_meta").delete().eq("user_id", session.user.id).eq("place_id", placeId).then(() => {}, () => {});
}
