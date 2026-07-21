# Research Field Log — deploy guide

A real app: static frontend (deploy to Netlify) + a real Postgres database (Supabase, free tier) so it works from any device, for anyone you share the URL with.

## 1. Create the database (5 min)

1. Go to supabase.com → sign up (free) → New project.
2. Once it's ready, open **SQL Editor** (left sidebar) → **New query**.
3. Paste the contents of `schema.sql` and click **Run**.
4. Go to **Project Settings → API**. Copy:
   - **Project URL**
   - **anon public** key (NOT the service_role key — that one is secret, never put it in frontend code)

## 2. Point the app at your database

Open `index.html`, find this block near the top:

```html
<script>
  window.__SUPABASE_URL__ = 'YOUR_SUPABASE_URL';
  window.__SUPABASE_ANON_KEY__ = 'YOUR_SUPABASE_ANON_KEY';
</script>
```

Paste in your values from step 1.

## 3. Deploy to Netlify (5 min)

1. Go to app.netlify.com → sign up (free).
2. **Add new site → Deploy manually** → drag the whole `field-log-app` folder (just `index.html` is enough, schema.sql/README aren't needed on the server) into the drop zone.
3. You get a live URL immediately (e.g. `yourproject.netlify.app`). That's it — deployed.
4. Optional: Site settings → Change site name, to get a nicer URL.

Re-deploying after an edit is the same drag-and-drop again. (If you'd rather connect a GitHub repo so it auto-deploys on every push, that's also supported in Netlify's "Import from Git" flow — worth doing once you're editing this often.)

## Security note (read this)

Right now the database allows **anyone with your live URL** to read, add, and delete entries — no login. That's fine for a small trusted team sharing a link, which is your current use case. It stops being fine the moment the URL becomes more widely shared. If that happens, add Supabase Auth (see below) before it does.

## Google Calendar setup (optional, for real verified sync)

Without this, "+ Add to Google Calendar" still works as a pre-filled template link (opens Calendar with details ready, you click Save yourself, no confirmation comes back). With this set up, it creates the event directly via Google's API and shows a real "✓ View in Google Calendar" link once confirmed.

1. Go to console.cloud.google.com → create a project (or use an existing one).
2. **APIs & Services → Library** → search "Google Calendar API" → Enable.
3. **APIs & Services → OAuth consent screen** → User type: External → fill in app name and your email → under Scopes, add `https://www.googleapis.com/auth/calendar.events` → under Test users, add your email and your teammate's → Save. (Leave publishing status as "Testing" — fine for two people, no Google review needed.)
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type: **Web application** → under Authorized JavaScript origins, add your exact Netlify URL (e.g. `https://gesture-fieldlog.netlify.app`, no trailing slash) → Create.
5. Copy the Client ID → paste into the `CONFIG` block in `index.html` as `__GOOGLE_CLIENT_ID__`.
6. Redeploy. First click of "+ Add to Google Calendar" will pop up Google sign-in.

**Expect an "unverified app" warning the first time** — that's normal for a Testing-mode app with a sensitive scope, not a sign something's wrong. Click "Advanced" → "Go to [your app name] (unsafe)" to proceed. Only the test users you listed in step 3 can get past this screen at all, so it's safe for your two-person use.

## Paper metadata auto-lookup

Pasting a DOI queries CrossRef directly (works from the browser, no setup needed). Pasting any other link (IEEE Xplore, a lab's dataset page, GitHub, etc.) goes through a small serverless function (`netlify/functions/fetch-meta.js`) that fetches the page server-side and reads its `citation_*` / Open Graph meta tags — the same tags Zotero relies on, and most publisher/journal pages include them. Direct PDF or raw file links won't have any HTML to read, so those will honestly report "not an HTML page" instead of guessing.

**This requires the function to actually deploy.** Manual drag-and-drop to Netlify does support functions, but only if the `netlify/functions/` folder and `netlify.toml` are included in what you drag — make sure you're dragging the whole `field-log-app` folder, not just `index.html`, from here on. If functions don't seem to trigger after deploying, connecting this folder as a GitHub repo and letting Netlify build from git is the more reliable path (Settings → your site → connect a repository) — worth doing once you're iterating on this often anyway.

## Extending it later

The architecture (static frontend + Supabase table) is built so each of these is an isolated addition, not a rewrite:

- **Analytics tab** — a new view that runs aggregate queries against the same `entries` table (hours per week, papers per verdict, decisions over time) and renders them with a lightweight chart library (Chart.js via CDN, same pattern as the Supabase script tag). No schema change needed — the data you're already logging is enough.
- **Login for your teammate** — Supabase Auth (email/password or magic link) plus tightening the RLS policies in `schema.sql` from "allow all" to "allow if authenticated." A few lines of SQL and a login screen.
- **Export to Markdown/CSV** — a button that pulls all rows and formats them client-side; useful when you sit down to write the related-work section.
- **Edit existing entries** (not just add/delete) — same `supabase.from('entries').update()` pattern already used for insert/delete.
- **Tags as a proper taxonomy / filter by tag** — currently tags are free text; could add a second `tags` table if you want autocomplete or a tag cloud.

Come back anytime and say what to add — each of these is a scoped change to one file.
