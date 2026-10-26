# Setup checklist (your part, ≈ 1 hour)

Everything below needs your accounts or dashboards. The code is done and tested against local data and
the mock AI. These steps connect it to the real services, deploy it, and put it on your iPhone. Do them
in order. Each step says what to copy where.

You'll collect these values along the way:

| Value | From | Goes into |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Vercel env (+ `.env.local`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API keys | Vercel env (+ `.env.local`) |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API keys | Vercel env (+ `.env.local`) |
| `ALLOWED_EMAIL` | your email address | Vercel env (+ `.env.local`) |

---

## 1. Supabase (database, photo storage, login): ≈ 20 min

- [ ] Create an account at <https://supabase.com> and a **new project** (Free plan).
  - Region: **Central EU (Frankfurt)**, the closest to Bologna.
  - Save the database password somewhere (you won't need it for the app).
- [ ] **Create the tables.** Open **SQL Editor → New query**, paste the whole contents of
      `supabase/migrations/20261026000000_init.sql`, and click **Run**. It should finish with
      "Success. No rows returned".
  - This creates all tables with row-level security, plus the private `wardrobe` storage bucket and
    its policies.
  - (Alternative if you use the Supabase CLI: `supabase link --project-ref <ref>` then `supabase db push`.)
- [ ] Check **Storage**: a bucket named `wardrobe` exists and is **not** public.
- [ ] **Copy the API values.** Project Settings → API (or "API Keys"):
  - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
  - `anon` public key (or the newer **publishable** key, `sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - Do **not** copy the `service_role` / secret key anywhere. The app doesn't need it.
- [ ] **Create your user and close sign-ups.**
  1. Authentication → Users → **Add user → Create new user**: your email, any password,
     tick **Auto Confirm User**.
  2. Authentication → Sign In / Providers (or Settings): make sure **Email** is enabled, then turn
     **off "Allow new users to sign up"**. Now nobody else can even create an account.
- [ ] **Put the login code in the email.** Authentication → **Email Templates → Magic Link**. Replace
      the body with:

  ```html
  <h2>Sign in to Wardrobe</h2>
  <p>Your code: <strong>{{ .Token }}</strong></p>
  <p>Or open this link on the same device: <a href="{{ .ConfirmationURL }}">Sign in</a></p>
  ```

  > **Why:** on iPhone, a link in an email opens in Safari, and Safari doesn't share its login with
  > the app you installed on the home screen. So in the installed app you type the **code** instead.
  > On the Mac either works.
- [ ] **URL configuration** (Authentication → URL Configuration). Fill this in after step 3, once you
      know your Vercel URL:
  - Site URL: `https://<your-app>.vercel.app`
  - Redirect URLs: add `https://<your-app>.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`

> **Free-tier notes:** Supabase's built-in email sender allows only a few emails per hour. That's fine
> here, because you sign in rarely (sessions are refreshed automatically). If you ever hit the limit, add
> a free SMTP provider (e.g. Resend) under Authentication → SMTP. Free projects **pause after ~1 week
> of no activity**. If the app suddenly can't load data, open the Supabase dashboard and click
> **Restore**.

## 2. Anthropic API key: ≈ 5 min

- [ ] Go to <https://console.anthropic.com> → **API Keys → Create key**. Name it `wardrobe`.
      Copy it → `ANTHROPIC_API_KEY`.
- [ ] Add a few dollars of credit (Billing). Then set a **monthly spend limit** (Settings → Limits),
      e.g. **$10**, as a hard guardrail.
- [ ] **Pick the model** (set `AI_MODEL`; you can change it any time in Vercel and redeploy):

  | `AI_MODEL` | Price (in/out per M tokens) | Rough cost per scan or tagged item | Notes |
  |---|---|---|---|
  | `claude-opus-5-5` (default) | $4 / $20 | ~$0.02–0.05 | Best label reading and judgement; slowest |
  | `claude-sonnet-5-5` | $2 / $10 | ~$0.01–0.025 | Good balance, faster |
  | `claude-haiku-5-5` | $0.10 / $0.50 | < $0.002 | Fastest and nearly free; weaker at reading small labels |

  Registering ~150 items in the first month with Opus could cost **more than the $5/month guardrail**
  in the PRD. After that, daily use is mostly suggestions (no images, cheaper). The Settings page in the
  app shows the real monthly cost per task, so you can decide from data. A sensible start is the
  default for a week, then compare it with Sonnet. `AI_EFFORT=low` (the default) keeps it fast.

## 3. Vercel (hosting): ≈ 10 min

- [ ] Merge this branch into `main` (or deploy the branch directly).
- [ ] Sign in at <https://vercel.com> with GitHub → **Add New… → Project** → import
      `JesperVigtel/YourStyle`. Framework preset: **Next.js** (auto-detected). Keep the default
      build settings.
- [ ] Under **Environment Variables**, add (for Production *and* Preview):

  ```
  NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  ALLOWED_EMAIL=you@example.com
  ANTHROPIC_API_KEY=sk-ant-...
  AI_MODEL=claude-opus-5-5
  AI_EFFORT=low
  ```

  Do **not** set `DATA_BACKEND` or `AI_PROVIDER` (the defaults are `supabase` and `anthropic`).
  The app refuses to start with `DATA_BACKEND=local` on Vercel.
- [ ] Click **Deploy**. When it's done, note the URL (e.g. `https://yourstyle.vercel.app`).
- [ ] **Function region:** Project → Settings → Functions → Function Region → **Frankfurt (fra1)**,
      next to your Supabase database. Redeploy afterwards (Deployments → … → Redeploy). This
      noticeably cuts latency.
- [ ] Go back to Supabase step 1 → **URL configuration** and fill in the Vercel URL.

## 4. First login on the Mac: ≈ 2 min

- [ ] Open the Vercel URL → you're sent to **/login** → enter your email → **Email me a code**.
- [ ] Enter the code from the email (or click the link) → you land on **Today**.
- [ ] Profile → **Body & fit**: fill in what you like (all optional). Fit preferences and style goals
      matter most for the AI.
- [ ] Profile → **Settings**: check it says your email and the model you picked.

## 5. Install on the iPhone: ≈ 3 min

- [ ] On the iPhone, open the Vercel URL in **Safari** (it must be Safari).
- [ ] Tap **Share** → **Add to Home Screen** → **Add**.
- [ ] Open **Wardrobe** from the home screen. It opens full-screen, without Safari's address bar.
- [ ] Sign in with your email and **type the 6-digit code** from the email. Don't tap the link in
      the Mail app: that would sign in Safari, not the installed app.
- [ ] Allow **Location** when the Today tab asks (for the weather) and **Camera** the first time
      you take a photo.
- [ ] Open the **Shop** tab once while online, so it's cached for markets without signal.

Then run through [`IPHONE_TEST.md`](IPHONE_TEST.md) (≈ 10 min).

---

## Optional: develop locally against your real Supabase

```bash
cp .env.example .env.local     # fill in the four values above; keep DATA_BACKEND=supabase
npm install
npm run dev
```

Log in at <http://localhost:3000/login> (the redirect URL from step 1 makes the magic link work locally).

## If something goes wrong

| Symptom | Likely cause / fix |
|---|---|
| "This email isn't allowed to sign in." | `ALLOWED_EMAIL` in Vercel doesn't exactly match your email. Redeploy after changing env vars. |
| Login email never arrives | Supabase's built-in email limit (a few per hour). Wait, or set up SMTP. Check spam. |
| Logged in on Safari but the home-screen app asks again | Expected on iOS: use the code inside the installed app. |
| "AI is not configured (bad API key)." | `ANTHROPIC_API_KEY` missing or wrong in Vercel, or no credit left. |
| Everything fails after a quiet week | The Supabase free project paused. Dashboard → Restore. |
| Photos don't load, data does | Storage policies weren't created. Re-run the storage part of the migration SQL. |
