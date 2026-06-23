# London, on foot

A personal map of every London neighbourhood (~170) and green space (~70). Mark places as *want to go* or *visited*, tag your impressions, add your own photos, and watch the city fill with colour. Real street map with a hand-drawn fallback, installable as an app, and — once you flip the cloud switch — synced across devices with shareable read-only links.

## Run it locally

```bash
npm install
npm run dev      # opens at http://localhost:5173
npm run build    # production build into dist/
```

A prebuilt `dist/` is already included, so you can deploy without installing anything.

## Deploy in 5 minutes (free)

**Netlify Drop** (easiest): go to https://app.netlify.com/drop and drag the `dist/` folder onto the page. You get a live URL immediately. On your phone, open it and use "Add to Home Screen" — because it's a PWA, it installs with an icon and works offline (the drawn map always works; street tiles and Wikipedia photos cache as you use them).

**GitHub Pages**: push this folder to a repo, then either commit `dist/` and point Pages at it, or add a standard Vite GitHub Action. The app uses relative paths (`base: "./"`) so it works from any subdirectory.

Without any further setup the app runs in **local mode**: everything saves to the browser you're using. That's fully functional for one person on one device.

## Turn on accounts, sync & sharing (~15 minutes)

This makes it a real multi-user app: anyone who visits gets their own map, progress follows people across devices, photos back up to the cloud, and everyone gets a "Share my map" link.

1. Create a free project at https://supabase.com.
2. In the SQL editor, paste and run the whole of `supabase/schema.sql`.
3. In Storage, create a bucket named `photos` and set it to **Public**.
4. In Authentication → Providers, make sure **Email** is enabled (magic links are the default).
5. In Project Settings → API, copy the **Project URL** and **anon public** key.
6. Open `public/config.js` (or `dist/config.js` on an already-deployed site — it's plain text, no rebuild needed) and paste them in:

```js
window.LOF_CONFIG = {
  SUPABASE_URL: "https://yourproject.supabase.co",
  SUPABASE_ANON_KEY: "eyJ...",
};
```

7. Redeploy (or just save the file on your host). A "Sign in to sync" button appears in the header.

### How sync behaves
Local-first: every change saves to the browser instantly, then pushes to the cloud when signed in. On sign-in, local and cloud are merged — whichever side touched a place most recently wins. Working offline is fine; it reconciles next time.

### Sharing
Signed-in users get a **Share my map** button that copies a link like `yoursite.com/?share=ab12cd34ef56`. Anyone opening it sees a read-only view of that person's map — colours, tags, even their photos — with a "start your own" prompt. Notes on privacy: a share link exposes that map (including photos, which live in a public bucket) to anyone holding the link; the link contains a random id, not the email.

## Project structure

```
index.html              entry page (loads config.js before the app)
public/config.js        runtime config — Supabase keys go here
public/pwa-*.png        app icons
src/main.jsx            bootstrap
src/App.jsx             the whole UI (deliberately one component for now)
src/data/core.jsx       all place data, blurbs, geometry, drawn basemap, Postcard art
src/lib/local.js        localStorage + IndexedDB persistence, legacy migration
src/lib/cloud.js        Supabase: auth, sync, share links, photo storage
src/config.js           reads window.LOF_CONFIG
supabase/schema.sql     database schema + RLS policies + share function
vite.config.js          build + PWA (manifest, offline caching)
```

`App.jsx` is intentionally one big component while the feature set settles; the natural next refactor is splitting MapView / ListView / PlaceCard out.

## Ideas for later

- Real neighbourhood boundary polygons (hand-drawn GeoJSON or open data) instead of the voronoi approximation
- A communal layer: aggregate everyone's tags into a "what London thinks is vibey" heatmap
- Display names on shared maps, friends/compare view
- Native wrapper via Capacitor if app stores ever matter

## Credits

Map tiles © OpenStreetMap contributors, © CARTO. Place photos via the Wikipedia REST API. Everything else hand-made.
