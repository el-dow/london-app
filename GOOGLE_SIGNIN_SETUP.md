# Enabling Google sign-in — setup guide

The app now has a "Continue with Google" button. To make it work, you need to
create Google OAuth credentials and paste them into Supabase. ~10 minutes, one time.

## Part 1 — Google Cloud Console

1. Go to https://console.cloud.google.com and sign in.
2. Top bar: create a new project (name it "Patch Map London"), or pick an existing one.
3. Left menu → **APIs & Services** → **OAuth consent screen**.
   - User type: **External** → Create.
   - App name: Patch Map London. Add your email where asked. Save through the steps.
   - You can leave it in "Testing" mode to start; that limits sign-in to test
     users you list. To let *anyone* sign in, click **Publish app** when ready.
4. Left menu → **APIs & Services** → **Credentials** → **Create credentials** →
   **OAuth client ID**.
   - Application type: **Web application**.
   - Name: Patch Map London Web.
   - **Authorised JavaScript origins** — add your live site:
       https://YOUR-SITE.netlify.app
   - **Authorised redirect URIs** — add your Supabase callback URL. It looks like:
       https://lzlqcolhvzjlgtcqtqio.supabase.co/auth/v1/callback
     (Your Supabase project URL + /auth/v1/callback. You can copy the exact value
      from Supabase in Part 2, step 1 — it's shown right there.)
   - Create. Google shows you a **Client ID** and **Client secret** — keep them.

## Part 2 — Supabase

1. Supabase → **Authentication** → **Providers** → **Google**.
2. Toggle it **on**. It displays the exact **callback URL** to use — make sure that
   same URL is in your Google "Authorised redirect URIs" above.
3. Paste the **Client ID** and **Client secret** from Google into the Google
   provider fields here. Save.

## Part 3 — check redirect URLs (you likely did this already)

Authentication → **URL Configuration**:
- Site URL: https://YOUR-SITE.netlify.app
- Redirect URLs: https://YOUR-SITE.netlify.app/**

## Done

Deploy the new app build, open the site, click **Sign in to sync → Continue with
Google**. No emails, no rate limits.

Notes:
- While the Google consent screen is in "Testing", only emails you add as test
  users can sign in. Publish the app (Part 1, step 3) before opening to the public.
- Email magic-link sign-in still works as a fallback alongside Google.
