# Trey Seabrooke — Personal Site

A single-scrolling personal site built with **Next.js**, designed to be hosted on
**Vercel** and edited easily (by you, or by asking Claude Code).

Apple-inspired look: black / white / silver / navy, with light + dark themes
that follow the visitor's system setting.

---

## Editing your content

**All the text and links live in one file:** [`app/content.ts`](app/content.ts).

Open it, change the values, save. That covers your name, bio, projects, contact
info, and social links — no other file needed for normal copy edits.

Prefer to ask Claude Code? Try things like:

- "Update `content.ts` — set my bio to: …"
- "Add a fifth project to the Work section."
- "Change the accent color from navy to a deeper blue."

To change **colors, fonts, or spacing**, edit the tokens at the top of
[`app/globals.css`](app/globals.css).

---

## Run it locally (optional)

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

---

## Deploy to Vercel

1. Push this repo to GitHub (already done if Claude Code pushed your branch).
2. Go to [vercel.com](https://vercel.com) and sign in with GitHub.
3. Click **Add New… → Project**, pick this repository, and click **Import**.
4. Vercel auto-detects Next.js — leave every setting default and click **Deploy**.
5. You'll get a live `*.vercel.app` URL in about a minute.

Every time you (or Claude Code) push to the branch, Vercel redeploys automatically.

### Point your domain at it

1. In your Vercel project: **Settings → Domains → Add**, enter your domain.
2. Vercel shows the DNS records to set. In your domain registrar (or wherever
   your Framer domain is managed), update the DNS to match — usually an `A`
   record to Vercel's IP and/or a `CNAME` to `cname.vercel-dns.com`.
3. If the domain is currently attached to Framer, remove it from Framer first
   so the DNS can point to Vercel instead.
4. DNS changes can take a few minutes to a few hours to propagate.

---

## Structure

```
app/
  content.ts        ← EDIT THIS for all copy + links
  globals.css       ← colors, fonts, spacing tokens at the top
  layout.tsx        ← page shell + tab title
  page.tsx          ← section layout (hero, about, work, contact)
  components/
    Nav.tsx         ← sticky frosted navigation
    Reveal.tsx      ← scroll-in fade animation
```
