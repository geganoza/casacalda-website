# Handover — Cloudflare Pages migration + frontend overrides

**Date:** 2026-06-25
**Recipient:** Thomas Pkhakadze
**Author:** Giorgi Nozadze (via Claude)

This document is the post-migration brief for the change from the
hand-uploaded-to-Hostinger static frontend to an auto-deployed Cloudflare
Pages frontend. WordPress (your headless backend) is untouched.

---

## TL;DR

1. **`casacalda.com` and `www.casacalda.com` now serve from Cloudflare Pages**, not Hostinger.
2. **`cms.casacalda.com` (your WordPress) is unchanged** — same Hostinger account, same DB, same plugin.
3. **Every push to `master` auto-deploys** to Cloudflare Pages within ~45 seconds via a GitHub Action.
4. **A `TEXT_OVERRIDES` system in `render.js`** rewrites strings client-side. This is a stopgap — once you sync the WordPress content to the new copy, we delete those overrides one by one.
5. **The Hostinger account stays paid** — no files were deleted there. It's still the WP backend and a fallback if Cloudflare ever fails.

---

## Why we moved

### Problem 1 — Hostinger flap

Both `casacalda.ge` and `casacalda.com` were intermittently failing — TLS RST on `.ge`, HTTP 403 from LiteSpeed on `.com` — at the same time. Same shared Hostinger account, same vhost-level squeeze (PHP-FPM pool exhausted or mod_security blanket-block). Documented in `site-flapping.md` in the memory archive since 2026-05-19.

Splitting frontend off Hostinger means visitors keep seeing the site even when WP is flapping. The static shell loads from Cloudflare's edge instantly, and if the API call to `cms.casacalda.com` returns 5xx, the stale-while-revalidate / cache layer at Cloudflare still serves the last good response for cached pages.

### Problem 2 — Manual file deploys

Each frontend change required you to upload files to Hostinger via File Manager or SFTP. There was no `git push = live` workflow. That's slow, blocked Giorgi when you were unavailable, and meant the repo state could drift from what was actually live.

Cloudflare Pages + GitHub Actions closes that loop:

```
git push origin master
    ↓
GitHub Actions workflow runs (cloudflare/wrangler-action@v3)
    ↓
wrangler pages deploy . --project-name=casacalda-website
    ↓
Cloudflare edge serves new bundle globally (~30s)
```

### Problem 3 — Hostinger flap risk for the static asset bundle

The static frontend on Hostinger meant *every* visitor's browser was hitting Hostinger's LiteSpeed for HTML/CSS/JS. Cloudflare Pages serves all of that from 300+ edge POPs — much faster globally and immune to origin issues.

---

## The new architecture (visual)

```
                  ┌──────────────────────────────────────┐
                  │  casacalda.com / www.casacalda.com   │
                  └──────────────────┬───────────────────┘
                                     │
                  ┌──────────────────▼───────────────────┐
                  │  Cloudflare DNS (registrar = GoDaddy)│
                  │  CNAME @  →  casacalda-website.pages.dev │
                  │  CNAME www →  casacalda-website.pages.dev │
                  │  A cms.casacalda.com → 72.60.93.156 (proxied) │
                  └──────────────────┬───────────────────┘
                                     │
                  ┌──────────────────▼───────────────────┐
                  │  Cloudflare Pages                     │
                  │  Project: casacalda-website           │
                  │  Source: GitHub geganoza/casacalda-website │
                  │  Branch: master (auto-deploy)         │
                  │  SSL: Google CA, auto-renewed         │
                  └──────────────────┬───────────────────┘
                                     │ (visitor's browser)
                                     │
                  Browser runs cms.js → fetches https://cms.casacalda.com/?rest_route=/casacalda/v1/site
                                     │
                                     ▼
                  ┌──────────────────────────────────────┐
                  │  Hostinger Business shared hosting    │
                  │  WordPress + your /casacalda/v1/ REST │
                  │  plugin. UNCHANGED.                   │
                  └──────────────────────────────────────┘
```

---

## What's in the repo that's new

| Path | Purpose | Owned by |
|---|---|---|
| `.github/workflows/deploy-pages.yml` | GitHub Action that runs `wrangler pages deploy` on every push to master. Uses `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` as repo secrets. | Claude (set up 2026-06-25) |
| `assets/logo-main.svg` | Official BRAND DNA MAIN GEO SVG (navy + orange). For light backgrounds. | Mirrored from Drive |
| `assets/logo-main-white.svg` | Official BRAND DNA MAIN GEO WHITE SVG. For dark backgrounds. Used by `LOGO_OVERRIDE`. | Mirrored from Drive |
| `coming-soon.html` | Standalone branded under-construction page. Not currently used as the homepage; the WP-rendered hero is. | Claude |
| `HANDOVER_CLOUDFLARE_MIGRATION.md` | This file. | Claude |
| `THOMAS_HOSTINGER_DEPLOY.md` | Earlier handover, pre-migration. Still mostly relevant for the WP side. | Claude |
| `THOMAS_TRANSLATION.md` | Translation strategy (TranslatePress on WP). Still applies. | Claude |
| `render.js` | **Heavily modified** — `TEXT_OVERRIDES` array + `LOGO_OVERRIDE` constant + `txt()` helper + `esc()` patched + `T.hero` / `nav()` / `footer()` / `T['cta-band']` / `T.contact` modified. See "Overrides" below. | Claude |
| `style.css` | `.nav__logo` 24→44px; `.footer__brand img` 36→64px. To fit the more compact new logo aspect ratio. | Claude |
| `?v=` cache-bust | Bumped to `?v=20260637` in every HTML page + `app.js`. We're incrementing on every change so browsers refetch. | Claude |
| `.env` (gitignored) | Holds the Cloudflare API token used locally for emergency CF API calls. **NOT in git.** | Local-only |

---

## TEXT_OVERRIDES — what they are and why

In `render.js`, at the top of the IIFE, there's now this block:

```js
var TEXT_OVERRIDES = [
  // sentence-level (run first)
  { from: /…regex…/g, to: 'replacement' },
  …
  // word-level
  { from: /ექსპერტიზა/g, to: 'კომპეტენცია' },
  { from: /სპეციალიზაცია/g, to: 'კომპეტენცია' },
  …
];

function applyOverrides(s) {
  var out = String(s == null ? '' : s);
  for (var i = 0; i < TEXT_OVERRIDES.length; i++) {
    out = out.replace(TEXT_OVERRIDES[i].from, TEXT_OVERRIDES[i].to);
  }
  return out;
}

function esc(s) {
  return applyOverrides(s).replace(/[&<>"']/g, …);  // HTML-escape after replace
}

function txt(s) { return applyOverrides(s); }  // For raw-HTML emitters
```

**Why it exists.** Giorgi was iterating fast on copy. The actual content (nav labels, footer text, page titles, body copy, the brand text under the footer logo, contact info) all lives in WordPress, which only you can edit. Round-tripping every word change through "Giorgi messages Thomas → Thomas edits WP" was too slow. So I built a client-side string-replace layer that catches every WP-sourced string at the moment it's about to be rendered and rewrites it.

**Georgian Mkhedruli is safe to use as a regex needle.** The codepoints (U+10D0–U+10FF) can never appear inside URLs, HTML attribute names, slugs, `tel:` / `mailto:` targets, or asset paths. So we can run substring replacements on the whole string (URLs included) without corrupting anything. The same wouldn't be true for English-word substitutions.

**Three raw-HTML emitters bypass `esc()`** — `T['custom-html']`, `T['rich-text']`, and `projectOverview` (for the `p.overview` field). Those go through `txt()` instead — which runs the same overrides but skips the HTML entity escape so the WP-formatted HTML survives.

### Current overrides (as of commit `0dd97dd`)

Sentence-level (run first because they may rewrite away words the next rules would touch):

| Match | Becomes |
|---|---|
| `უმაღლესი ხარისხის (ექსპერტიზა\|კომპეტენცია\|სერვისი) ჩვენთვის სტანდარტი არ არის — ეს ჩვენი ყოველდღიური საქმეა.` | `უმაღლესი ხარისხის სერვისი ჩვენი ყოველდღიურობაა` |
| `ჩვენ ვგემავთ და ვაშენებთ თქვენს სიმყუდროვეს` | `გაიმარტივეთ ცხოვრება თბილ სახლთან ერთად` (footer brand line) |
| `სრული ელექტრო სისტემების დაპროექტება და მონტაჟი საცხოვრებელი და კომერციული ობიექტებისთვის.` | `სრული ელექტროსისტემების დაბრუნება და მონტაჟი ნებისმიერი სირთულის ობიექტისთვის.` |
| `უკვე მრავალი წელია რაც ჩვენი მომსახურებით, ჩვენ ვუქმნით ჯანსაღ და კომფორტულ გარემოს, ჩვენს მომხმარებლებს` | `ჩვენი სიძლიერე ჩვენს პროფესიონალებით დაკომპლექტებულ, მოტივირებულ გუნდშია` |
| `გამოგვიგზავნე შეტყობინება` | `გამოგვიგზავნეთ შეტყობინება` (politeness) |
| `მზად ხარ ჩვენთან თანამშრომლობისთვის?` | `მზად ხართ ჩვენთან თანამშრომლობისთვის?` |
| `შეავსე ფორმა და გამოგვიგზავნე შენი CV` | `შეავსეთ ფორმა და გამოგვიგზავნეთ თქვენი CV` |
| `შეავსე ფორმა და ჩვენ დაგიკავშირდებით…` | `შეავსეთ ფორმა და ჩვენ დაგიკავშირდებით…` |
| `გაიმარტივე ცხოვ(ერ)ება თბილ სახლთან ერთად` | `გაიმარტივეთ ცხოვრება თბილ სახლთან ერთად` |

Address overrides (HQ correction):

| Match | Becomes | Notes |
|---|---|---|
| `0186,?\s*ვაჟა-ფშაველას 6` | `0159, ლუბლიანას ქუჩა N56` | Per BIA.ge + Yell.ge. **Spot-check before printing on anything official.** |
| `ვაჟა-ფშაველას 6` | `ლუბლიანას ქუჩა N56` | Same. |

Word-level (run after the above):

| Match | Becomes | Notes |
|---|---|---|
| `ექსპერტიზა` | `კომპეტენცია` | Global rename. |
| `სპეციალიზაცია` | `კომპეტენცია` | Same — page hero `<h1>` on services. |
| `ტექნიკური კომპეტენცია` | `ტექნიკური ექსპერტიზა` | Re-replace: the phrase "ტექნიკური ექსპერტიზა" should keep `ექსპერტიზა`. Runs after the global rule. |
| `პორტფოლიო` | `ჩვენი` | Eyebrow above the project block on the homepage. |
| `ვუზრუნველყოფთ` | `უზრუნველვყოფთ` | Verb form correction (the `ვ` particle position). |
| `დაგვიკავშირდი(?![ა-ჰ])` | `დაგვიკავშირდით` | Standalone CTA button text → polite. Lookahead avoids matching prefixes of longer conjugations. |
| `ჩვენი სამუშაოები` | `ჩვენი ნამუშევრები` | "Our jobs" → "Our works". |

### LOGO_OVERRIDE

A single constant `var LOGO_OVERRIDE = '/assets/logo-main-white.svg'` forces all three logo emit points in `render.js` to use the official BRAND DNA white SVG:

1. `nav()` — Object.assign override of `brand.logo_light`
2. `footer()` — Object.assign override of `brand.logo_footer`
3. `T.hero` — `d.logo` is ignored entirely; the override URL is emitted unconditionally

CSS sizes bumped in `style.css` to compensate for the new logo's compact 2:1 aspect (vs the previous ~5:1 wordmark):

- `.nav__logo`: 24 → 44 px (mobile breakpoints: 28→40, 26→38)
- `.footer__brand img`: 36 → 64 px

### Other render.js changes

- **`T.hero`** — d.actions is ignored, no buttons render in the hero. Logo render is unconditional.
- **`T['cta-band']`** — returns empty string when `window.CC_PAGE === 'contact'` so the bottom CTA banner doesn't show on the contact page (redundant with the form). Other pages still get it.

---

## What you (Thomas) should do

### Short-term (this week)

1. **Sync the overrides into WordPress.** Each row in the TEXT_OVERRIDES table above is a word/sentence I'm rewriting on-the-fly. The cleaner state is: edit the value in WP admin so the override becomes a no-op. Then we delete the override.

   Order to do them in (easiest to hardest):

   - Word-level: ექსპერტიზა → კომპეტენცია (also see issue #1 — pending since 2026-06-22). Use the **Better Search Replace** plugin in WP admin, dry-run first.
   - Word-level: სპეციალიზაცია → კომპეტენცია (services page hero — set in the page-hero block of the services page).
   - Word-level: პორტფოლიო → ჩვენი (homepage project section eyebrow).
   - Word-level: ჩვენი სამუშაოები → ჩვენი ნამუშევრები.
   - Word-level: ვუზრუნველყოფთ → უზრუნველვყოფთ.
   - Word-level: დაგვიკავშირდი → დაგვიკავშირდით (CTA button labels).
   - Sentence: footer brand text → `გაიმარტივეთ ცხოვრება თბილ სახლთან ერთად` (in Customizer or footer options).
   - Sentence: services section description.
   - Sentence: team section description.
   - Sentence: electricity service blurb.
   - Address: contact page + footer contacts → `0159, ლუბლიანას ქუჩა N56` (after spot-check confirmation).
   - The two singular-form CTAs ("გამოგვიგზავნე", "შეავსე ფორმა …") → polite forms.

2. **Update `brand.logo_light` and `brand.logo_footer`** in WP to point at the new BRAND DNA white SVG. Source file is at `assets/logo-main-white.svg` in the repo. Upload to WP Media Library, then point the brand fields at the new URL. See issue #2.

3. **Get the WP plugin source into git.** Right now your `casacalda/v1/` REST plugin only exists on Hostinger. If that file is lost, the entire frontend stops working. Commit it to this repo under `/wordpress-plugin/casacalda/` so it's versioned + restorable. See open ticket. Add a deploy step to the GitHub Action (SFTP push to `cms.casacalda.com/wp-content/plugins/casacalda/`) so the plugin auto-deploys too.

### Medium-term (next sprint)

4. **TranslatePress REST behavior verification.** When you add the English translation, confirm `/wp-json/casacalda/v1/site?lang=en` returns translated strings. If not, the static frontend needs the lang param wired into the URL prefix instead. See `THOMAS_TRANSLATION.md` (Path A).

5. **Cloudflare cache rules for `cms.casacalda.com`** — set an aggressive edge cache TTL (1 year) for `cms.casacalda.com/wp-content/uploads/*` so WP-uploaded images survive Hostinger flaps. One-time CF API call; Claude can do this.

6. **Decision: keep WP or migrate to Decap CMS.** The full TEXT_OVERRIDES system is a stopgap. The proper architectural fix is to move content into git (Decap is the recommendation — see `THOMAS_HOSTINGER_DEPLOY.md` Option C). That eliminates the need for overrides, the WP plugin, the Hostinger dependency for the CMS, and the flap risk entirely. Cost: 2–3 days rebuild. Benefit: no more "Thomas, please update WP" loop. **Tell us your preference.**

### Long-term (when convenient)

7. **Cancel Hostinger** once Decap is in. Until then, Hostinger still hosts WP.

---

## Operational reference

### Deploy URLs

| URL | Source | Purpose |
|---|---|---|
| https://casacalda.com/ | Cloudflare Pages | Production |
| https://www.casacalda.com/ | Cloudflare Pages | Production (canonical = root) |
| https://casacalda-website.pages.dev/ | Cloudflare Pages | Direct project URL (always works even if custom-domain DNS is broken) |
| https://cms.casacalda.com/ | Hostinger | WordPress admin + REST |
| https://geganoza.github.io/casacalda-website/ | GitHub Pages | Old preview URL (still alive as a fallback). |

### Secrets

- `CLOUDFLARE_API_TOKEN` — GitHub repo secret. Has Pages-Edit + Zone-DNS-Edit perms. Token value in local `.env`.
- `CLOUDFLARE_ACCOUNT_ID` — `4c05de69627ec8453970a2c40a3a54f9`. GitHub repo secret.
- `HOSTINGER_API_TOKEN` — local `.env` only.
- Cloudflare zone ID for `casacalda.com`: `a19e1a001741e382a060ba9121beb562`.
- Cloudflare zone ID for `casacalda.ge`: `54320e7e8491fa2d4aa6ce6244ffd2d1`.

### Rollback to Hostinger if Cloudflare breaks

(Should never be needed but documenting for safety.)

```bash
# Reverse the DNS change — point apex back at Hostinger origin
ZONE=a19e1a001741e382a060ba9121beb562
# Delete the apex CNAME pointing at Pages, add A back to Hostinger IP
# (one-liner via CF API; use CF_API_TOKEN from .env)
```

The Hostinger files are still there from before the migration — no data loss possible.

### Cache-bust convention

When you change `render.js`, `style.css`, `cms.js`, `app.js`, or `main.js`, bump the `?v=YYYYMMDD` (or `YYYYMMDDXX`) suffix in all HTML files + the `app.js` self-reference to `main.js`. Pattern:

```bash
for f in *.html app.js; do
  sed -i '' 's/?v=20260637/?v=20260638/g' "$f"
done
```

Otherwise stuck browsers may serve the old JS from disk cache.

---

## Open GitHub Issues

- **#1 — Sync the WP CMS with the ექსპერტიზა → კომპეტენცია rename.** Filed 2026-06-22. Bumped with API evidence today.
- **#2 — Swap nav/footer logo to official BRAND DNA white SVG.** Filed 2026-06-22.

Both should be closeable once you do the WP-side sync described above.

---

## Questions / disagreements

If anything in here looks wrong, comment on the relevant commit or open an issue. The override system is intentionally easy to remove — delete a row from TEXT_OVERRIDES, commit, push, live in 45 seconds.

— G + Claude
