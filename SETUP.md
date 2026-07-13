# Economic Statecraft Monitor — Setup & Deployment Guide

## What this is
A full-stack web application that continuously scans open-source global news and multilateral data sources to detect emerging state-backed cross-border economic transactions (ports, energy, digital infrastructure, cybersecurity). It scores each deal by "executability" (how actionable it is for US policy response) and sends a daily briefing email with the top 3 deals.

---

## Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- An [Anthropic API key](https://console.anthropic.com) (claude-sonnet-4-6 — **required** for deal extraction and summaries)
- A [Resend](https://resend.com) account (free tier: 3,000 emails/month)
- A [Vercel](https://vercel.com) account for deployment

---

## Step 1 — Database setup (Supabase)

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the full contents of `lib/db/schema.sql`
3. From **Project Settings → API**, copy:
   - `Project URL` → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

---

### Step 1b — Enable document uploads (optional but recommended)

To use the **Documents** feature (upload Word/Excel/PDF/CSV/text files and fold them
into the transaction tracker), also run `lib/db/documents.sql` in the SQL Editor.
It creates the `documents` table and a private Supabase Storage bucket named
`deal-documents`. The app reads/writes that bucket with the `service_role` key, so no
extra Storage policies are needed.

---

## Step 2 — Environment variables

Copy `.env.example` to `.env.local` and fill in all values:

```bash
cp .env.example .env.local
```

Required variables:
| Variable | How to get it |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API → service_role |
| `NEXTAUTH_SECRET` | Run: `openssl rand -hex 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` (dev) or your Vercel URL (prod) |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `RESEND_API_KEY` | [resend.com](https://resend.com/api-keys) |
| `EMAIL_FROM` | Verified sender in Resend (or `onboarding@resend.dev` for testing) |
| `EMAIL_TO` | Recipient email address |
| `CRON_SECRET` | Run: `openssl rand -hex 32` |

Optional (enable additional connectors when added):
| Variable | Source |
|---|---|
| `NEWSAPI_KEY` | [newsapi.org](https://newsapi.org) — free tier |
| `GNEWS_KEY` | [gnews.io](https://gnews.io) — free tier |

---

## Step 3 — Create the first user

Start the dev server, then POST to the setup endpoint:

```bash
npm run dev
# In another terminal:
curl -X POST http://localhost:3000/api/setup \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-secure-password","name":"Your Name"}'
```

This endpoint permanently disables itself after the first user is created. Add additional team members via SQL:
```sql
-- Generate hash first: node -e "const b=require('bcryptjs');b.hash('password',12).then(console.log)"
INSERT INTO users (email, password_hash, name) VALUES ('colleague@example.com', '<hash>', 'Name');
```

---

## Step 4 — Local development

```bash
npm install
npm run dev
```

Visit `http://localhost:3000` — you'll be redirected to `/login`.

After logging in, click **Run Scan** to trigger the first data ingestion. GDELT and World Bank are enabled by default (no API keys needed). The scan takes 2–5 minutes because GDELT queries are batched with delays to be respectful of the free API.

---

## Step 5 — Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

Or connect your GitHub repo to Vercel and add all environment variables in the Vercel dashboard under **Settings → Environment Variables**.

**Important:** Set `NEXTAUTH_URL` to your Vercel deployment URL (e.g., `https://your-app.vercel.app`).

### Scheduled jobs (Vercel Cron)
The `vercel.json` file configures two cron jobs:
- `0 4 * * *` — Daily ingestion at 04:00 UTC (7-day rolling news window; dedup makes re-scans safe)
- `0 6 * * *` — Daily email at 06:00 UTC (sends top 3 deals to `EMAIL_TO`)

Cron jobs require Vercel's Hobby plan or higher. On free tier, use a service like [cron-job.org](https://cron-job.org) to call these endpoints:
- `GET https://your-app.vercel.app/api/cron/ingest` with `Authorization: Bearer <CRON_SECRET>`
- `GET https://your-app.vercel.app/api/cron/email` with `Authorization: Bearer <CRON_SECRET>`

---

## Architecture overview

```
Next.js 14 (Vercel)
├── Dashboard (React Server Components + client islands)
│   ├── Deal cards with composite score + sub-score bars
│   ├── Filter/sort by sector, region, sponsor, stage, score
│   ├── Deal detail: summary, timeline, sources, score breakdown
│   └── Admin config: weight sliders, connector toggles, pipeline log
├── API routes
│   ├── /api/ingest       Manual scan trigger (auth required)
│   ├── /api/cron/ingest  Scheduled scan (cron secret)
│   ├── /api/cron/email   Scheduled email (cron secret)
│   ├── /api/deals        Deal list + detail
│   └── /api/config       Weight + connector config
└── Ingestion pipeline
    ├── GDELT DOC API     Global newspapers (250+ sources, 65+ languages, free)
    ├── World Bank API    Project database (official, free)
    ├── [NewsAPI]         When API key provided
    └── LLM (claude-sonnet-4-6)
        ├── Extract deal candidates from article batches
        ├── Generate executive summaries with cited sources
        ├── Generate US diplomatic context paragraphs
        └── Infer lifecycle stage with reasoning

Supabase (Postgres)
├── deals              Canonical transaction records
├── sources            Raw URLs + retrieval timestamps (full audit trail)
├── deal_sources       Deal ↔ source links
├── deal_events        Transaction timeline
├── score_config       Tunable scoring weights
├── connector_config   Enable/disable connectors
└── ingest_logs        Pipeline run history

Email: Resend (free tier, 3k/month)
Auth:  NextAuth.js v4 (credentials, JWT sessions)
```

---

## Data sources — current connectors

| Connector | Key required | Coverage |
|---|---|---|
| GDELT DOC API | None (free) | 250+ global newspapers in 65+ languages, updated every 15 min |
| World Bank Projects | None (free) | Official WB/IFC project database |
| NewsAPI | Free tier key | English-language global press |
| GNews | Free tier key | Multi-language global press |

Connectors can be individually enabled/disabled from the dashboard Config page.

---

## Scoring rubric (default weights, tunable from Config page)

| Dimension | Weight | Description |
|---|---|---|
| Likelihood to Close | 30% | Based on lifecycle stage (rumored=20 → construction=92) |
| US Actionability | 30% | Earlier stage + adversary actor = higher urgency |
| Financing Certainty | 20% | Unknown=15 → signed financing=95 |
| Source Corroboration | 10% | Count + quality tier of independent sources |
| Strategic Priority | 10% | Sector rank × actor-of-concern weight |

All sub-scores (0–100) and their reasoning are stored and displayed on each deal's detail page, making every score explainable and reproducible.

---

## Data integrity

- Every deal links to its raw source URLs with retrieval timestamps
- The LLM is instructed never to fabricate facts — all claims must trace to a cited source
- Unconfirmed fields are explicitly marked `is_confirmed: false`
- Source confidence tiers: T1 = official/primary, T2 = established press, T3 = secondary
- Pipeline logs capture every connector run: start time, result counts, errors

---

## Email setup notes

**Resend domain verification:** To send from a custom domain (e.g., `alerts@yourdomain.com`), add your domain in the Resend dashboard and add DNS records. Until then, you can use `onboarding@resend.dev` as the sender for testing — note that `.mil` addresses may apply strict spam filters, so domain verification is recommended for production.

**Delivery to `.mil` addresses:** US military email systems can be aggressive with spam filtering. Recommended steps:
1. Verify your sender domain in Resend
2. Set a meaningful `EMAIL_FROM` display name
3. Ensure SPF/DKIM records are correct
4. Test with a personal address first before confirming `.mil` delivery
