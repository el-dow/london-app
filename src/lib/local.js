// Local persistence: progress + tags in localStorage (with migration from the
// old single-file app's keys), your photos in IndexedDB.

const V2_KEY = "lof-v2";
const LEGACY_STATES = "london-explorer-v1";
const LEGACY_TAGS = "london-explorer-tags";
const LEGACY_CUSTOM = "london-explorer-custom-tags";

export function loadLocal() {
  try {
    const raw = localStorage.getItem(V2_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { states: p.states || {}, tags: p.tags || {}, meta: p.meta || {}, customTags: p.customTags || [] };
    }
  } catch (e) { /* fall through to migration */ }
  const out = { states: {}, tags: {}, meta: {}, customTags: [] };
  try {
    const s = JSON.parse(localStorage.getItem(LEGACY_STATES) || "{}");
    if (s && typeof s === "object") out.states = s;
  } catch (e) {}
  try {
    const t = JSON.parse(localStorage.getItem(LEGACY_TAGS) || "{}");
    if (t && typeof t === "object") out.tags = t;
  } catch (e) {}
  try {
    const c = JSON.parse(localStorage.getItem(LEGACY_CUSTOM) || "[]");
    if (Array.isArray(c)) out.customTags = c;
  } catch (e) {}
  const now = Date.now();
  for (const id of new Set([...Object.keys(out.states), ...Object.keys(out.tags)])) out.meta[id] = now;
  return out;
}

export function saveLocal(data) {
  try { localStorage.setItem(V2_KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
}

export const photoDB = {
  _p: null,
  open() {
    if (this._p) return this._p;
    this._p = new Promise((res, rej) => {
      const r = indexedDB.open("london-on-foot", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("photos");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return this._p;
  },
  async get(id) {
    try {
      const db = await this.open();
      return await new Promise((res) => {
        const t = db.transaction("photos").objectStore("photos").get(id);
        t.onsuccess = () => res(t.result || null);
        t.onerror = () => res(null);
      });
    } catch (e) { return null; }
  },
  async set(id, val) {
    const db = await this.open();
    return new Promise((res, rej) => {
      const t = db.transaction("photos", "readwrite").objectStore("photos").put(val, id);
      t.onsuccess = () => res();
      t.onerror = () => rej(t.error);
    });
  },
  async del(id) {
    try {
      const db = await this.open();
      return await new Promise((res) => {
        const t = db.transaction("photos", "readwrite").objectStore("photos").delete(id);
        t.onsuccess = () => res();
        t.onerror = () => res();
      });
    } catch (e) {}
  },
};

export const fileToDataUrl = (file) => new Promise((res, rej) => {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const MAX = 900;
    const sc = Math.min(1, MAX / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * sc);
    c.height = Math.round(img.height * sc);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    res(c.toDataURL("image/jpeg", 0.78));
  };
  img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("bad image")); };
  img.src = url;
});
