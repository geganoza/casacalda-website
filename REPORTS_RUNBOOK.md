# Casa Calda Monthly Reports — Runbook

Operational playbook for the Casa Calda monthly social-media performance report at
`reports.casacalda.com/casa-calda/<month>-<year>`. **Current as of 2026-08-05.**

For the frontend site itself see [`RUNBOOK.md`](./RUNBOOK.md). This file only covers
the reports pipeline.

---

## Overview

- **What:** One HTML deck per calendar month summarising Casa Calda's paid + organic
  Meta performance. Published at `reports.casacalda.com/casa-calda/<month>-<year>`,
  emailed to Casa Calda leadership on the 1st of the following month.
- **Client:** Casa Calda (Malkhaz Kurtanidze, CEO)
- **Data source:** Meta Ads API (Marketing Graph v21.0). Casa Calda is Meta-only —
  no Google Ads.
- **Automation status:** Fully automated end-to-end since 2026-08-05. Both operator
  cron and supervisor cron are live. Next real fire: **2026-09-01 08:00 Georgia**
  (for the August 2026 report).

---

## Stack

| Layer | What | Where | Notes |
|---|---|---|---|
| Domain | `reports.casacalda.com` | Cloudflare DNS on `casacalda.com` zone `a19e1a001741e382a060ba9121beb562` | CNAME → `cname.vercel-dns.com`, proxy **OFF** |
| Static frontend | Casa Calda-branded HTML/CSS/JS | Vercel project **martivi-presentations** | Multi-client Vercel project (also hosts Thermorum, HR, autograph, interview) — see [Host isolation](#host-isolation) |
| Build/deploy | Vercel git integration on push to main | | Auto-deploys ~45 s after push |
| Source of truth | GitHub | `geganoza/martivi-presentations` | `main` is production |
| Report generator | Python 3, stdlib only | `scripts/generate_casa_calda_report.py` | Pulls Meta → renders template → writes HTML → updates index |
| Template | HTML with `str.format` placeholders | `casa-calda/template.html` | 25 KB, extracted from July 2026's report |
| Email helper | Python 3, stdlib `smtplib` | `scripts/send_casa_calda_report_email.py` | SMTP via `cp8.co.hostnodes.ge` |
| Sender mailbox | `reports@martividigital.com` | cPanel on hostnodes.ge, account `bebias` | Created 2026-08-05. SPF passes via `ip4:195.54.179.33`. |
| Operator cron | GitHub Actions | `.github/workflows/casa-calda-monthly-report.yml` | Cron: `0 4 1 * *` (08:00 Georgia, 1st of month) |
| Supervisor cron | Claude Cloud routine (CCR) | Trigger id `trig_01WFfenCGmx3VtPn8Dyq8S1a` | Cron: `0 5 2 * *` (09:00 Georgia, 2nd of month) |
| Host isolation | Vercel Edge Middleware | `middleware.ts` at repo root | Allowlist: only `/` and `/casa-calda/*` on the reports host; everything else 404 |
| Fonts | Self-hosted | `casa-calda/assets/fonts/` | Noto Sans Georgian (3 subsets, variable) + Montserrat (5 weights × latin + latin-ext) |

---

## Domain + DNS

- Zone: `casacalda.com` on Cloudflare, zone id `a19e1a001741e382a060ba9121beb562`
- Record: `CNAME reports.casacalda.com → cname.vercel-dns.com`, TTL auto, **proxy OFF**
- Attached to Vercel project `martivi-presentations`
- TLS cert: Let's Encrypt, issued by Vercel, auto-renews

Proxy is intentionally off — Vercel does its own edge TLS + caching, and proxying
through Cloudflare on top adds a second cache layer that would have to be purged
after every deploy. Not worth it for a deck the browser hits once a month.

---

## End-to-end pipeline (what happens on the 1st)

```
2026-09-01 04:00 UTC (08:00 Georgia time)
  └─ GitHub Actions cron fires casa-calda-monthly-report.yml
     ├─ Restores config/credentials/meta_ads_credentials.json from secret
     ├─ Resolves "previous month" via Python: 2026-08
     ├─ Runs: python3 scripts/generate_casa_calda_report.py --year 2026 --month 8
     │    ├─ Pulls Meta Ads account totals + per-ad rows for Aug 2026
     │    ├─ For each ad: fetches creative.effective_object_story_id + object_type
     │    ├─ Dedupes ads by post_id, aggregates spend/impressions per post
     │    ├─ Sorts by ad.created_time DESC (newest post first)
     │    ├─ Renders casa-calda/template.html with the data
     │    ├─ Writes casa-calda/august-2026.html (~30 KB)
     │    └─ Updates casa-calda/index.html with a new card at the top
     ├─ Commits: git add casa-calda/ → git commit -m "Add Casa Calda 8/2026 report"
     ├─ Pushes to main → Vercel git integration auto-deploys within ~45 s
     ├─ Sleeps 60 s to let deploy complete
     └─ Runs: python3 scripts/send_casa_calda_report_email.py --year 2026 --month 8
          ├─ Renders subject: "REPORT — Casa Calda — აგვისტო 2026 სოციალური მედიის ანგარიში მზადაა"
          ├─ Renders body (Georgian, includes URL)
          ├─ Auths against cp8.co.hostnodes.ge:587 as reports@martividigital.com
          ├─ Sends to m.k@casacalda.ge, marketing@casacalda.ge
          └─ BCCs martividigital@gmail.com (personal receipt)

2026-09-02 05:00 UTC (09:00 Georgia time)
  └─ Claude Cloud supervisor routine trig_01WFfenCGmx3VtPn8Dyq8S1a fires
     ├─ Clones geganoza/martivi-presentations
     ├─ Computes previous month = August 2026 → slug august-2026
     ├─ Check 1: casa-calda/august-2026.html file exists + > 400 lines
     ├─ Check 2: recent commit in last 3 days touching that file
     ├─ Check 3: URL live (200) + contains Georgian "სოციალური მედიის ანგარიში" + ≥1 iframe
     ├─ Check 4: casa-calda/index.html references the new slug
     └─ Sends confirmation or alert to martividigital@gmail.com via Gmail connector
```

**24-hour gap between operator and supervisor is deliberate.** If the 08:00 run has
a transient failure (Meta API blip, Vercel deploy queue), the workflow's own retry
finishes long before 09:00 the next day. If it's a real failure, we still get an
alert within a day rather than at the end of the month when the client notices.

---

## Manual operations

### Trigger a specific month right now

Same workflow, human-triggered via `workflow_dispatch`:

```bash
gh workflow run casa-calda-monthly-report.yml \
  --repo geganoza/martivi-presentations \
  -f month=8 -f year=2026

gh run watch --repo geganoza/martivi-presentations
```

Optional inputs:

| Input | Effect |
|---|---|
| `force_email=true` | Send email even if the report file didn't change (useful for testing SMTP) |
| `test_recipient=someone@example.com` | Override `CASA_CALDA_REPORT_RECIPIENT` for this one run (comma-separated OK) |
| `skip_email=true` | Regenerate the HTML without sending mail |

### Fire the supervisor now

```bash
# From a Claude Code session with schedule/RemoteTrigger available:
#   RemoteTrigger action=run trigger_id=trig_01WFfenCGmx3VtPn8Dyq8S1a
# Or via the web UI:
open https://claude.ai/code/routines/trig_01WFfenCGmx3VtPn8Dyq8S1a
```

### Generate a report locally (no deploy)

```bash
cd ~/Projects/AZON/MARTIVI-Presentations
python3 scripts/generate_casa_calda_report.py --year 2026 --month 8 --output /tmp/aug.html
open /tmp/aug.html
```

The script's credentials lookup order is:

1. `META_ADS_CREDENTIALS_PATH` env var
2. `./config/credentials/meta_ads_credentials.json` in repo (this is what CI restores)
3. `~/Projects/AZON/MAIA/config/credentials/meta_ads_credentials.json` (local dev fallback)

### Preview the report locally

```bash
cd ~/Projects/AZON/MARTIVI-Presentations
python3 -m http.server 8091
open http://localhost:8091/casa-calda/july-2026.html
```

### Send a test email from your machine

```bash
SMTP_HOST=cp8.co.hostnodes.ge SMTP_PORT=587 \
SMTP_USER=reports@martividigital.com SMTP_PASSWORD='<paste>' \
CASA_CALDA_REPORT_RECIPIENT=martividigital@gmail.com \
python3 scripts/send_casa_calda_report_email.py --year 2026 --month 7
```

Keep `CASA_CALDA_REPORT_RECIPIENT` on **yourself** for tests. Missing this env var
here would land a test email on the actual client — the send helper doesn't ask
for confirmation and doesn't tag the subject as [TEST].

---

## Secrets inventory (repo: geganoza/martivi-presentations)

| Secret | Contents | Rotates via |
|---|---|---|
| `META_ADS_CREDENTIALS_JSON` | Full contents of `~/Projects/AZON/MAIA/config/credentials/meta_ads_credentials.json` | Meta Business Manager → System Users → API Bot → generate new token |
| `CASA_CALDA_REPORT_RECIPIENT` | `m.k@casacalda.ge,marketing@casacalda.ge` | `gh secret set CASA_CALDA_REPORT_RECIPIENT --body "..."` |
| `REPORT_BCC` | `martividigital@gmail.com` | Same |
| `SMTP_HOST` | `cp8.co.hostnodes.ge` | Same |
| `SMTP_PORT` | `587` | Same |
| `SMTP_USER` | `reports@martividigital.com` | Same |
| `SMTP_PASSWORD` | Mailbox password | cPanel → Email Accounts → change password → `gh secret set SMTP_PASSWORD --body '...'` |
| `SENDER_EMAIL` | (unset — defaults to `SMTP_USER`) | Set only if you want a different visible From address |
| `TG_BOT_TOKEN` | Telegram bot token | (Not set yet — workflow's Telegram notify step no-ops until this is present) |
| `TG_CHAT_ID` | Personal chat id | Same |

List them all in one call:

```bash
gh secret list --repo geganoza/martivi-presentations
```

---

## Meta Ads identifiers

- **Ad account:** `act_2040713473241527` (name: "CASA CALDA", currency USD, timezone Asia/Tbilisi)
- **Facebook Page ID:** `391986960923797`
- **API version:** v21.0
- **Post embed URL pattern:**

  ```
  https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Fwww.facebook.com%2F391986960923797%2Fposts%2F<POST_ID>&show_text=false&width=500
  ```

The generator dedupes ads by `post_id` before rendering — Meta returns one row per
ad, but Casa Calda often runs multiple ads pointing at the same organic post.
Aggregating first is what makes the "top posts" list match what the marketing team
actually sees in Business Suite.

---

## Email that lands on the client

**From:** `reports@martividigital.com` (defaults to `SMTP_USER`)
**To:** `m.k@casacalda.ge, marketing@casacalda.ge`
**Bcc:** `martividigital@gmail.com`
**Subject template:** `REPORT — Casa Calda — <Georgian month> <year> სოციალური მედიის ანგარიში მზადაა`
**Body (Georgian):** four lines — greeting, one-liner with the URL, invitation to
ask, sign-off "Casa Calda × Martivi Digital"

The subject prefix "REPORT —" was added specifically so it stands out in the
CEO's inbox (2026-08-05). **Do not remove** — several ad-hoc project mails from
Martivi land in the same thread group, and without the prefix the monthly send
gets buried.

---

## Host isolation

Why `/thermorum`, `/hr`, `/interview` return 404 on the Casa Calda domain.

The reports domain (`reports.casacalda.com`) is attached to the same Vercel project
that hosts several other clients (Thermorum reports, MARTIVI HR dashboard,
autograph material, interview booking flow, various `/api` routes). By default a
Vercel domain serves **every** path in the project — which meant Casa Calda's own
URL was publishing Thermorum's ad spend and MARTIVI's HR candidate dashboard until
2026-08-05.

**Current mitigation:** an Edge Middleware allowlist at repo root (`middleware.ts`).
On host `reports.casacalda.com`, only `/` and `/casa-calda/*` are allowed; anything
else returns 404 with a plain-text body. Same status a nonexistent path returns —
no hint the path exists elsewhere. Other hosts (`martivi-presentations.vercel.app`,
preview aliases) pass through untouched.

**The real fix** is one Vercel project per client, so cross-client leakage is
architecturally impossible instead of code-enforced. That work is not done as of
the last runbook update; if you're adding a fourth client, do it first — see
[What's not done yet](#whats-not-done-yet).

If you must add a new directory to this project, verify it doesn't leak on
`reports.casacalda.com`:

```bash
for path in /hr /thermorum/xxx /autograph /new-thing /casa-calda/july-2026; do
  echo -n "$path → "
  curl -sI "https://reports.casacalda.com$path" -o /dev/null -w "%{http_code}\n"
done
```

Only `/casa-calda/*` should be 200; everything else 404.

---

## Fonts (self-hosted)

Previously loaded from `fonts.googleapis.com` + `fonts.gstatic.com` — a
third-country data transfer on every client visit. As of 2026-08-05 both font
families are served from origin:

| Font | Files under `casa-calda/assets/fonts/` |
|---|---|
| Noto Sans Georgian | Variable font, 3 subsets (georgian, latin, latin-ext), 3 woff2 files, covers weights 300–900 |
| Montserrat | 5 weights × 2 subsets (latin + latin-ext) = 10 woff2 files |
| CSS declarations | `noto-sans-georgian.css` + `montserrat.css` |

Origin traffic added: ~440 KB total, cached indefinitely by the browser. Zero
external font requests remain — verify with the network panel or:

```bash
curl -s https://reports.casacalda.com/casa-calda/july-2026 | grep -c "fonts.googleapis\|fonts.gstatic"
# Should print: 0
```

The Casa Calda site (`casacalda.com`, separate project) already self-hosted its
fonts before this — that's where these font files were copied from. If you update
Noto Sans Georgian versions there, **re-copy them here too**.

---

## Troubleshooting

### The 1st-of-month email never arrived

1. GitHub Actions run:

   ```bash
   gh run list --repo geganoza/martivi-presentations \
     --workflow=casa-calda-monthly-report.yml --limit 5
   ```

2. If the run failed, look at which step — recipe below per step.
3. If the run passed but no email: check the "Send notification email" step log
   for `Sent to ...` — that string only prints on successful SMTP delivery.
4. Check `martividigital@gmail.com` (you're BCC'd) — if it's there but not at the
   primary recipients, the primaries filtered/blocked.
5. Check the supervisor's confirmation email (2nd of month) — its outcome should
   tell you which check failed.

### Meta API call in the generator fails

- **Token expired**: the `meta_ads_credentials.json`'s `access_token` has a
  rotation window. If the workflow logs show 401/190 from Graph API, generate a
  fresh System User token in Meta Business Manager → System Users → API Bot →
  Generate New Token, then
  `gh secret set META_ADS_CREDENTIALS_JSON --body "$(cat …)"`
- **Rate limit / temporary block**: retry in 10–30 minutes. Meta throttles bursts
  per IP.
- **Wrong ad account**: verify the account id is `act_2040713473241527` in the
  credentials JSON — it must be Casa Calda's, not Thermorum's.

### SMTP send fails

- `SMTPAuthenticationError`: password wrong. Reset in cPanel
  (`https://cp8.co.hostnodes.ge:2083` → Email Accounts →
  `reports@martividigital.com` → Password → Change) → paste new value into
  `gh secret set SMTP_PASSWORD --body '...'`.
- `SMTPRecipientsRefused`: one of the recipients was rejected (bad address,
  mailbox full). The helper sends to all recipients in one message; you'll need
  to remove the bad one from `CASA_CALDA_REPORT_RECIPIENT`.
- `Connection timeout`: hostnodes.ge SMTP was blocked from this IP. Rare. Retry.

### Report file wrote but URL 404s

- Vercel deploy failed. Check the run's "Commit and push" step succeeded, then
  look at Vercel's build log via the URL that step prints.
- Cache lag: force a fresh fetch with a random query string:

  ```bash
  curl "https://reports.casacalda.com/casa-calda/august-2026?_=$RANDOM"
  ```

### Supervisor flagged BROKEN but the report looks fine

- The supervisor's checks are strict on purpose. Look at the email body — it
  lists which of the 4 checks failed with raw output.
- Re-run the supervisor manually (RemoteTrigger `action=run`) to see if it's
  transient.
- The check that most often false-positives is Check 3 (URL live + Georgian
  string). A cold Vercel edge sometimes returns the deploy 200 with a stale HTML
  variant for ~30 s. If the supervisor caught it inside that window, the retry
  will pass.

---

## Rotating things

### SMTP password (`reports@martividigital.com`)

1. cPanel → Email Accounts → `reports@martividigital.com` → Change password
2. Paste new value:
   ```bash
   gh secret set SMTP_PASSWORD --repo geganoza/martivi-presentations --body '<new>'
   ```
3. Trigger a test run:
   ```bash
   gh workflow run casa-calda-monthly-report.yml \
     --repo geganoza/martivi-presentations \
     -f month=7 -f year=2026 -f force_email=true \
     -f test_recipient=martividigital@gmail.com
   ```

### Meta System User token

1. Meta Business Manager → Business Settings → System Users → "API Bot" →
   Generate New Token (permissions: `ads_read`, `business_management`)
2. Update MAIA copy:
   `~/Projects/AZON/MAIA/config/credentials/meta_ads_credentials.json` field
   `meta_marketing_api.access_token`
3. Push it into the repo secret:
   ```bash
   gh secret set META_ADS_CREDENTIALS_JSON \
     --repo geganoza/martivi-presentations \
     --body "$(cat ~/Projects/AZON/MAIA/config/credentials/meta_ads_credentials.json)"
   ```
4. Trigger a test run.

### Recipients

Cheap:

```bash
gh secret set CASA_CALDA_REPORT_RECIPIENT \
  --repo geganoza/martivi-presentations \
  --body "m.k@casacalda.ge,marketing@casacalda.ge,new@casacalda.ge"
```

Comma-separated, no spaces. The helper splits on `,` and trims per address.

---

## The template

`casa-calda/template.html` is a `str.format`-style template. It has placeholders
for every data-varying field (month, year, KPIs, chips, creatives array, table
rows, chart data, period). The generator loads the template and renders it —
no Jinja, no framework, stdlib only.

**Don't hand-edit the rendered HTML files** (`july-2026.html`, etc.) — they get
overwritten the next time the generator runs against that month. Edit the template
and regenerate:

```bash
python3 scripts/generate_casa_calda_report.py --year 2026 --month 7
python3 scripts/generate_casa_calda_report.py --year 2026 --month 6
```

Common template gotcha: raw `{` and `}` in CSS or JS inside the template must be
escaped as `{{` and `}}` or `str.format` will throw
`KeyError: 'the-first-thing-inside-the-brace'`. The current template is clean;
keep it that way.

---

## Owners

- **Automation, template, generator, this runbook:** Claude (this assistant, in this session)
- **Sender mailbox:** hostnodes.ge cPanel account `bebias` (Giorgi's)
- **Meta ad account:** Casa Calda's own `act_2040713473241527`
- **Client contact:** Malkhaz Kurtanidze (CEO) at `m.k@casacalda.ge`
- **Client secondary:** `marketing@casacalda.ge` (team inbox)

---

## What's not done yet

As of this runbook update (2026-08-05):

- **Project split.** Reports still live in the shared `martivi-presentations`
  Vercel project alongside Thermorum, HR, autograph, interview. The middleware
  allowlist is the interim block; the real fix is a separate Vercel project just
  for Casa Calda. 2–3 hours of work. Do this *before* onboarding a fourth client.
- **Telegram alerts.** Workflow has the steps wired in, but `TG_BOT_TOKEN` +
  `TG_CHAT_ID` secrets aren't set, so the steps skip silently. Adding them:
  create a bot with `@BotFather`, get chat id from `@userinfobot`, then
  `gh secret set TG_BOT_TOKEN --body "..."` and
  `gh secret set TG_CHAT_ID --body "..."`.
- **Reply-to routing.** `reports@martividigital.com`'s MX points at Google
  Workspace (not the hostnodes cPanel that hosts the send mailbox). A client
  hitting Reply will bounce unless we add `reports@` as a Google Workspace alias
  forwarded to a real user. Or set a `Reply-To` header to a different address
  the client can actually reach. Right now the CEO replying to the deck goes
  nowhere.

---

## Where to find things

| Thing | Where |
|---|---|
| Live reports index | https://reports.casacalda.com/casa-calda/ |
| Direct Vercel URL (always works) | https://martivi-presentations.vercel.app/casa-calda/ |
| GitHub repo | https://github.com/geganoza/martivi-presentations |
| Workflow file | `.github/workflows/casa-calda-monthly-report.yml` |
| Generator | `scripts/generate_casa_calda_report.py` |
| Email helper | `scripts/send_casa_calda_report_email.py` |
| Template | `casa-calda/template.html` |
| Rendered decks | `casa-calda/<month>-<year>.html` |
| Middleware (host isolation) | `middleware.ts` |
| Fonts | `casa-calda/assets/fonts/` |
| Meta credentials (local canonical copy) | `~/Projects/AZON/MAIA/config/credentials/meta_ads_credentials.json` |
| cPanel (sender mailbox) | https://cp8.co.hostnodes.ge:2083 (user `bebias`) |
| Vercel dashboard | https://vercel.com/martivi/martivi-presentations |
| Supervisor routine | https://claude.ai/code/routines/trig_01WFfenCGmx3VtPn8Dyq8S1a |

---

## Related docs

- [`RUNBOOK.md`](./RUNBOOK.md) — the frontend `casacalda.com` runbook (separate
  system, separate repo, separate host)
