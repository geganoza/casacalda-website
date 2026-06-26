# Casa Calda Website — Runbook

Operational playbook for casacalda.com. **Current as of 2026-06-26 (end of day).**

For the deeper migration backstory (why we moved off Hostinger for the
frontend) see [`HANDOVER_CLOUDFLARE_MIGRATION.md`](./HANDOVER_CLOUDFLARE_MIGRATION.md).

---

## Stack

| Layer | What | Where | Notes |
|---|---|---|---|
| Domain registrar | GoDaddy | godaddy.com | Just for registration / renewals |
| DNS | Cloudflare | dash.cloudflare.com | Zone `casacalda.com` id `a19e1a001741e382a060ba9121beb562` |
| Static frontend (HTML/CSS/JS) | Cloudflare Pages | project `casacalda-website` | Direct URL: `casacalda-website.pages.dev` |
| Build/deploy | GitHub Actions | `.github/workflows/deploy-pages.yml` | Auto-runs on push to master |
| Source of truth | GitHub | `geganoza/casacalda-website` | master is production |
| CMS backend | WordPress + custom `casacalda/v1/` REST plugin (Thomas's) | Hostinger, `cms.casacalda.com` | Hostinger Business plan, Paris DC, expires 2028-06-05 |
| Old WP site | WordPress (legacy) | Hostinger, `casacalda.ge` | NOT touched. Has chronic flap (see `site-flapping.md`). Will be retired or repointed. |
| CDN / WAF / SSL | Cloudflare (proxied) | applies to apex + www + cms subdomain | Free tier, Google CA cert |

---

## Repo layout

```
website-static/
├── RUNBOOK.md                       # This file
├── HANDOVER_CLOUDFLARE_MIGRATION.md # Full migration writeup (what + why)
├── THOMAS_HOSTINGER_DEPLOY.md       # Original WP-on-Hostinger guide
├── THOMAS_TRANSLATION.md            # TranslatePress strategy
├── .github/workflows/deploy-pages.yml # Auto-deploy to Cloudflare Pages
├── index.html | services.html | …   # Page shells (each one sets window.CC_PAGE)
├── cms.js                           # WordPress REST client (sends ?lang= per cc_lang)
├── render.js                        # Section templates + override layer (TEXT_OVERRIDES_KA/EN, MEDIA_OVERRIDES, LOGO_OVERRIDE)
├── app.js                           # Page boot: read CC_PAGE → fetch → render
├── style.css                         # All styles
├── main.js                           # Nav, language switcher, carousels, scroll-reveal
├── coming-soon.html                  # Standalone under-construction page
└── assets/
    ├── banners/                     # v2 banners wired to page heroes / CTA / intros (HERO_BG_BY_PAGE, CTA_BAND_BG, etc.)
    ├── logo-main-white.svg          # Official brand mark (used by LOGO_OVERRIDE)
    ├── logo-light.svg / logo-footer.svg  # Legacy logos (kept for revert)
    ├── partners/                    # Partner brand logos
    ├── fonts/                       # Gilroy GEO + Noto Sans Georgian
    └── …                            # Misc photos, icons, stock images
```

---

## End-to-end deploy flow

```
git push origin master
       ↓
GitHub Actions runs cloudflare/wrangler-action@v3
       ↓
wrangler pages deploy . --project-name=casacalda-website
       ↓
Cloudflare Pages global edge ≤ 30s after push completes
       ↓
casacalda.com / www.casacalda.com / casacalda-website.pages.dev all serve new bundle
```

**Total time from `git push` to "live for visitors": ~45 seconds.**

There is no manual upload step. There is no FTP, no hPanel. The repo IS production.

---

## Daily/routine tasks

### Preview locally

```bash
cd ~/Projects/CASACALDA\ Local/website-static
python3 -m http.server 4173
open http://127.0.0.1:4173/
```

### Watch a deploy finish

```bash
gh run list -R geganoza/casacalda-website --limit 1
gh run watch -R geganoza/casacalda-website
```

### Bump cache-bust after editing JS/CSS

When you touch `render.js`, `style.css`, `cms.js`, `app.js`, or `main.js`:

```bash
OLD=$(grep -oE 'render\.js\?v=[0-9]+' index.html | head -1 | sed 's/.*=//')
NEW=$((OLD + 1))   # or just bump to YYYYMMDD<seq>
for f in *.html app.js; do
  sed -i '' "s/?v=$OLD/?v=$NEW/g" "$f"
done
```

Cache-bust history: started `?v=20260624` (Thomas), now at `?v=2026064x` (incremented per commit). Then commit + push as normal.

### Force a specific browser to bypass cache

Visit with a fresh `?t=` query: `https://casacalda.com/?t=$(date +%s)`. Or hard-refresh:

- **Chrome** ⌘+Shift+R
- **Safari** Shift+click reload button (Develop menu not required)
- **Firefox** ⌘+Shift+R

### Take a screenshot of the live site

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B viewport 1440x900
$B goto https://casacalda.com/
$B wait --networkidle
$B screenshot /tmp/cc.png
```

### Look up Cloudflare DNS or trigger cache purge (via API)

```bash
CF=$(grep CF_API_TOKEN ../.env | cut -d= -f2)
ZONE=a19e1a001741e382a060ba9121beb562

# List DNS records
curl -sH "Authorization: Bearer $CF" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records?per_page=200" | jq

# Purge everything
curl -sH "Authorization: Bearer $CF" -X POST \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/purge_cache" \
  -H "Content-Type: application/json" \
  -d '{"purge_everything": true}'
```

### Look up Hostinger account state

```bash
HT=$(grep HOSTINGER ../.env | cut -d= -f2)
curl -sH "Authorization: Bearer $HT" \
  https://developers.hostinger.com/api/hosting/v1/websites | jq
```

---

## Editing content

**Important:** Most text/copy/images on the live site come from WordPress, not the repo. The flow is:

1. Browser loads HTML shell from Cloudflare Pages
2. `cms.js` fetches `https://cms.casacalda.com/?rest_route=/casacalda/v1/site` + relevant page endpoint
3. `render.js` builds the DOM from WP data

So if you want to change a heading, footer text, nav label, etc.:

- **Right place:** WordPress admin at `https://cms.casacalda.com/wp-admin/` (Thomas has the login). Find the field in the relevant page or in the global site options.
- **Wrong place:** the repo. Editing HTML files only changes the shell, not the content.

**Exception — the override layer in `render.js`.** Three independent stop-gap systems that let us change the live site without touching WordPress. All of them collapse to no-ops once Thomas syncs WP to match.

### 1. `TEXT_OVERRIDES_KA` / `TEXT_OVERRIDES_EN` — copy rewrites

Language-aware string substitution. `cms.js` writes `localStorage.cc_lang = 'ka'|'en'`; `render.js`'s `activeOverrides()` picks the matching array. Every WP string flows through `esc()` (HTML-escaped) or `txt()` (raw HTML emitters: `T['custom-html']`, `T['rich-text']`, `projectOverview`), both of which run the array first.

```js
// render.js top of IIFE
var TEXT_OVERRIDES_KA = [
  { from: /…regex…/g, to: 'new copy' },
  …
];
var TEXT_OVERRIDES_EN = [
  { from: /old English string from TranslatePress/g, to: 'new English copy' },
  …
];
```

Add a new rule = append to the right array, bump cache-bust, push. Remove a rule = delete the line, push.

**Safety:** Georgian Mkhedruli codepoints can't appear in URLs/attribute names, so KA rules are safe to run on every string (URLs included). EN rules need a tighter regex because English words can appear inside URLs.

### 2. `MEDIA_OVERRIDES` — image swaps

```js
// render.js
var HERO_BG_BY_PAGE = {
  about:    '/assets/banners/hero-about-desktop.jpg',
  services: '/assets/banners/hero-services-desktop.jpg',
  team:     '/assets/banners/hero-team-desktop.jpg',
  contact:  '/assets/banners/hero-contact-desktop.jpg',
};
var INTRO_SPLIT_BY_PAGE = {
  services: '/assets/banners/intro-services.jpg',
  team:     '/assets/banners/intro-team.jpg',
};
var ABOUT_SPLIT_IMG = '/assets/banners/hero-about-md.jpg';  // homepage company section
var CTA_BAND_BG    = '/assets/banners/cta-band-desktop.jpg';
var SERVICE_DETAIL_IMG = {
  electricity:  '/assets/banners/service-electricity.jpg',
  plumbing:     '/assets/banners/service-plumbing.jpg',
  safety:       '/assets/banners/service-safety.jpg',
  mechanical:   '/assets/banners/service-mechanical.jpg',
  automation:   '/assets/banners/service-automation.jpg',
  consulting:   '/assets/banners/service-consulting.jpg',
  consultation: '/assets/banners/service-consulting.jpg',
};
```

Each map keys off `window.CC_PAGE` (set in the HTML shell — e.g. `<script>window.CC_PAGE = 'home'</script>`) or the service slug. Empty key = WP-supplied image renders.

To revert a slot: delete that entry. To add a new slot: add the file to `assets/banners/`, add the key, bump cache-bust, push.

### 3. `LOGO_OVERRIDE` — single constant

```js
var LOGO_OVERRIDE = '/assets/logo-main-white.svg';
```

Used by `nav()`, `footer()`, `T.hero` (3 emit points) so the brand mark is always the official BRAND DNA white SVG. To revert: delete the constant and restore the original `brand.logo_light` / `brand.logo_footer` reads.

### Override audit + cleanup

Run `grep -c "from:" render.js` to count active KA + EN rules. As WP syncs land, prune. Issues #1 (word swap) and #2 (logo swap) track the current backlog.

---

## Banners

All v2 banners committed to `assets/banners/`. Total 25 files / ~5 MB. Sourced from `~/Downloads/Website Banners/` with the `Website Banners_v2_` prefix, then resized + compressed via `sips`.

Naming convention is English kebab-case so I can grep + map reliably:

| Repo file | Source v2 filename | Size | Where it serves |
|---|---|---|---|
| `hero-about-desktop.jpg`   | `ვინ ვართ ჩვენ 1888x838.jpg`           | 2200px wide max | About page hero |
| `hero-about-tablet.jpg`    | `ვინ ვართ ჩვენ 992x832.jpg`            | 1100px max      | About page hero (responsive — not yet wired into srcset) |
| `hero-about-mobile.jpg`    | `ვინ ვართ ჩვენ 363x300.jpg`            | 400px max       | About page hero mobile (responsive — not yet wired) |
| `hero-about-md.jpg`        | `ვინ ვართ ჩვენ 1284x850.jpg`           | 1400px max      | **Homepage company (about-split) section** |
| `hero-services-{desktop,tablet,mobile}.jpg` | `სერვისები 1888/992/363.jpg` | as above | Services page hero |
| `hero-team-{desktop,tablet,mobile}.jpg`     | `ჩვენი ხალხი 1888/992/363.jpg`         | as above | Team page hero |
| `hero-contact-{desktop,tablet,mobile}.jpg`  | `კონტაქტი 1888/992/363.jpg`            | as above | Contact page hero |
| `cta-band-{xl,desktop,mobile}.jpg` | `მზად ხარ თანამშრომლობისთვის 2828/2048/726.jpg` | as above | CTA band (every page except contact) |
| `intro-team.jpg`           | `ჩვენი ძალა ჩვენს ადამიანებშია.jpg`     | 1400px max      | Team page intro-split |
| `intro-services.jpg`       | (v1 only — no v2 supplied)              | 1400px max      | Services page intro-split |
| `service-{electricity,plumbing,safety,mechanical,automation,consulting}.jpg` | (v1) | 1400px max | Services page detail card images |

The 1 GB `.ai` source files stay in Drive, NEVER committed.

### Refresh banners from a new v2 batch

```bash
cd ~/Projects/CASACALDA\ Local/website-static
SRC="$HOME/Downloads/Website Banners"
# Paste the MAP array (see commit 9701397 for the full list) then loop:
for entry in "${MAP[@]}"; do
  IFS='|' read -r src dst maxw <<< "$entry"
  sips -Z $maxw -s format jpeg -s formatOptions 82 "$SRC/$src" --out "assets/banners/$dst"
done
# bump cache-bust, commit, push
```

Check sync at any time by md5-comparing the source (through the same sips pipeline) against the repo file. The pipeline is deterministic so identical-content banners produce identical md5s.

---

## Language switcher

Top-nav has a `KA` / `EN` button group (see `langSwitcher()` in `render.js`). Click → writes `localStorage.cc_lang` → reloads → `cms.js` appends `&lang=en` to every WP REST fetch → TranslatePress on WP returns English → `render.js` applies `TEXT_OVERRIDES_EN`.

Currently TP is wired for `ka` (default) + `en`. To verify TP REST is alive:

```bash
curl -s "https://cms.casacalda.com/?rest_route=/casacalda/v1/site&lang=en" | jq '.brand'
```

If `lang=en` returns identical content to `lang=ka`, TP REST isn't translating — see `THOMAS_TRANSLATION.md`.

---

## Performance budget (target)

- TTFB target: < 100ms globally (Cloudflare edge)
- LCP target: < 1.5s
- Total page weight: < 500KB for landing page (excluding above-the-fold images)
- Lighthouse target: 95+ across all four categories

Measure via the gstack browser tool (`$B perf`) or PageSpeed Insights.

---

## Emergency procedures

### Site is down — what to check, in order

1. **Public URL**: `curl -sI https://casacalda.com/` — is it really down for the whole world or only locally? Compare with `https://casacalda-website.pages.dev/` (direct project URL).
2. **DNS**: `dig casacalda.com @1.1.1.1` — should return Cloudflare IPs (104.21.x or 172.67.x).
3. **Cloudflare Pages**: log into dash.cloudflare.com → Workers & Pages → casacalda-website → check latest deployment status.
4. **GitHub Action**: `gh run list -R geganoza/casacalda-website --limit 5` — did the last push deploy succeed?
5. **WordPress backend**: `curl -sI https://cms.casacalda.com/` — if 5xx or 403, Hostinger is flapping again (see `site-flapping.md`). The static shell still works but content fetches will fail.
6. **Hostinger overall**: log into hpanel.hostinger.com → check Resource Usage (CPU/PHP workers/I/O).

### Rollback to Hostinger if Cloudflare Pages is broken

Hostinger files are still in place from before the migration — no data was deleted.

```bash
CF=$(grep CF_API_TOKEN ../.env | cut -d= -f2)
ZONE=a19e1a001741e382a060ba9121beb562

# Delete the CNAME → Pages
APEX_ID=$(curl -sH "Authorization: Bearer $CF" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records?type=CNAME&name=casacalda.com" \
  | jq -r '.result[0].id')
curl -sH "Authorization: Bearer $CF" -X DELETE \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records/$APEX_ID"

# Add A record → Hostinger
curl -sH "Authorization: Bearer $CF" -X POST \
  "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
  -H "Content-Type: application/json" \
  -d '{"type":"A","name":"casacalda.com","content":"72.60.93.156","proxied":true,"ttl":1}'
```

Propagation through Cloudflare's proxy is near-instant (<30 seconds).

### Rotate Cloudflare API token

1. https://dash.cloudflare.com/profile/api-tokens → revoke the old token
2. Create new token with these permissions: Account Cloudflare Pages (Edit), Account Settings (Read), Zone DNS (Edit), Zone Settings (Edit), Zone (Edit)
3. Update `.env` file (workspace root, gitignored)
4. Update GitHub repo secret `CLOUDFLARE_API_TOKEN`:
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN -R geganoza/casacalda-website -b "<new_token>"
   ```
5. Restart Claude Code or any local processes that read `.env`

### Rotate Hostinger API token

Current token rotated 2026-06-22, scope=all, expires ~2027-06-22.

1. https://hpanel.hostinger.com/profile/api → revoke old + create new
2. Update workspace `.mcp.json` (the `API_TOKEN` env var of the hostinger MCP server)
3. Update workspace `.env` `HOSTINGER_API_TOKEN` if used by scripts
4. Restart Claude Code

### Force-deploy if GitHub Action stuck

```bash
# Trigger the workflow manually
gh workflow run deploy-pages.yml -R geganoza/casacalda-website
gh run watch -R geganoza/casacalda-website
```

Or push an empty commit:
```bash
git commit --allow-empty -m "trigger deploy"
git push
```

---

## Open work items / known issues

These are tracked as GitHub issues on `geganoza/casacalda-website`:

| # | Title | Status | Notes |
|---|---|---|---|
| #1 | Word swap ექსპერტიზა → კომპეტენცია — sync the CMS too | Open | Thomas needs to do bulk Search/Replace in WP. Until then, override rule in render.js does the swap client-side. |
| #2 | Swap nav/footer logo to official BRAND DNA white SVG | Open | Same pattern — override is live, WP update pending. |
| #3 | 📘 Read me — Cloudflare Pages migration handover | Open (informational) | Pointer to `HANDOVER_CLOUDFLARE_MIGRATION.md`. |

See also the **Short-term TODO list** for Thomas at the bottom of `HANDOVER_CLOUDFLARE_MIGRATION.md`.

### Known instability

- **casacalda.ge** (old WordPress site, separate from this project) flaps intermittently. Documented in `site-flapping.md` memory. Don't conflate with casacalda.com health.
- **cms.casacalda.com** is on the same Hostinger shared account as casacalda.ge so it shares the same flap risk. When it 5xx's, the static site keeps loading but new content fetches fail and the page shows a fallback or blank state. Cloudflare edge caching of WP responses mitigates this.

---

## Owners

- **Project lead:** Giorgi Nozadze (Martivi Digital)
- **Frontend / CMS plugin / WP backend:** Thomas Pkhakadze (`@ThomasPkhakadze`)
- **Code/deploy automation + override layer:** Claude (this assistant)
- **Client contact:** Malkhaz Kurtanidze (CEO, Casa Calda)
- **Client feedback channel:** David (დავითი)
- **Other repo collaborator:** Nino Beriashvili (`@nino-beriashvil`, write access)

---

## Where to find things

| Thing | Where |
|---|---|
| Live production site | https://casacalda.com/ |
| Direct Pages URL (always works) | https://casacalda-website.pages.dev/ |
| Old GitHub Pages mirror | https://geganoza.github.io/casacalda-website/ |
| WP admin | https://cms.casacalda.com/wp-admin/ |
| Old WP site (legacy, will be retired) | https://casacalda.ge/ |
| GitHub repo | https://github.com/geganoza/casacalda-website |
| Cloudflare dashboard | https://dash.cloudflare.com (account `D.baliashvili@itcraft.ge`) |
| Hostinger hPanel | https://hpanel.hostinger.com |
| GoDaddy (registrar) | https://godaddy.com |
| Workspace root | `~/Projects/CASACALDA Local/` |
| Working clone | `~/Projects/CASACALDA Local/website-static/` |
| Local backup mirror | `~/Projects/CASACALDA Local/backups/casacalda-fork.git/` |
| Brand DNA logos | `~/My Drive/Casa Calda/MARKETING/BRAND DNA/Logo/` |

---

## Related docs in this repo

- [HANDOVER_CLOUDFLARE_MIGRATION.md](./HANDOVER_CLOUDFLARE_MIGRATION.md) — the full migration writeup
- [THOMAS_HOSTINGER_DEPLOY.md](./THOMAS_HOSTINGER_DEPLOY.md) — original WordPress-on-Hostinger setup guide (mostly superseded but still relevant for the WP side)
- [THOMAS_TRANSLATION.md](./THOMAS_TRANSLATION.md) — translation strategy via TranslatePress

The earlier `~/Projects/CASACALDA Local/website/RUNBOOK.md` and
`~/Projects/CASACALDA Local/website/BACKEND_RUNBOOK.md` are **pre-migration planning docs** from May 2026.
Both are superseded by this file. Keep them for historical reference; do not edit.
