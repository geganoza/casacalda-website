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

## Team videos — hover-to-play with first-frame poster (no `<img>` poster file needed)

**The design.** Each team-card on the homepage and `team.html` shows a portrait. On hover the portrait animates (it's actually a short MP4 looping); on mouse-leave it pauses and returns to the first frame.

**The video tags** are emitted by `T.team` (render.js:480) and `T['team-grid']` (render.js:535) — plus the same shape in `T['about-proj-card']` (render.js:617). All three render:

```html
<video src="…cms.casacalda.com/…/portrait.mp4" muted loop playsinline preload="metadata"></video>
```

No `autoplay`, no `poster=` attribute — that's intentional. The play/pause logic lives in `main.js` ("STAFF VIDEOS: play on hover only" block, ~line 578).

### The bug we hit (2026-06-26)

On Safari (both macOS and iOS) the team cards rendered as blank black rectangles until the user moused over them. Reason:

- `preload="metadata"` only downloads the MP4 headers, not any frame data.
- A `<video>` element that is paused, has no `poster=`, and hasn't decoded a frame yet renders its background color (black in Safari, sometimes transparent in Chrome).
- Chrome was lenient and usually decoded frame 0 anyway. Safari was strict and showed nothing.

### The fix (committed in `a4378c8` + `c58b835`)

Two cooperating pieces, both in `main.js` inside the "STAFF VIDEOS: play on hover only" block. **No template change, no CSS change, no backend change, no `poster=` file needed.**

**1. Prime the first frame by seeking to `0.05s`.**

For every `.team-card__img video` and `.team-grid__img video`, on `loadeddata` (or immediately if already loaded), set `video.currentTime = 0.05`. Browsers decode and paint the seeked frame even while paused — that becomes the visible "poster". Same seek runs on `mouseleave` so the card returns to the first frame after the video plays.

Why `0.05` and not `0`: Safari sometimes ignores `currentTime = 0` for the paint step (treats it as "you were already there, no repaint needed"). A hair past zero forces a fresh seek + decode + paint.

**2. Lazy-promote `preload` from `metadata` to `auto`.**

An `IntersectionObserver` watches `.team` and `.team-grid` sections. When either is ~300px from entering the viewport, it bumps `video.preload = 'auto'` on every video inside, so the data is actually present to seek into. Visitors who never scroll to the team section don't download the 8 portrait videos (each ~1.5–3 MB).

Critical: **do NOT call `v.load()`** in this block. `v.load()` resets `currentTime` back to zero and undoes the prime-first-frame seek. Just flipping `preload` is enough to trigger background download.

Fallback if `IntersectionObserver` isn't supported (very old Safari): just set `preload = 'auto'` immediately for all team videos.

### What the JS looks like

```js
// main.js, ~line 578 — abridged
document.querySelectorAll('.team-card__img video, .team-grid__img video').forEach(function (v) {
    v.pause();
    var primeFirstFrame = function () { try { v.currentTime = 0.05; } catch (e) {} };
    if (v.readyState >= 2) primeFirstFrame();
    else {
        v.addEventListener('loadeddata', primeFirstFrame, { once: true });
        v.addEventListener('canplay',    primeFirstFrame, { once: true });
    }
    var card = v.closest('.team-card, .team-grid__card') || v.parentElement;
    card.addEventListener('mouseenter', function () {
        var p = v.play(); if (p && p.catch) p.catch(function () {});
    });
    card.addEventListener('mouseleave', function () { v.pause(); v.currentTime = 0.05; });
});

if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.querySelectorAll('video').forEach(function (v) {
                if (v.preload !== 'auto') v.preload = 'auto';
                var reprime = function () { try { if (v.paused) v.currentTime = 0.05; } catch (e) {} };
                if (v.readyState >= 2) reprime();
                else v.addEventListener('loadeddata', reprime, { once: true });
            });
            obs.unobserve(entry.target);
        });
    }, { rootMargin: '300px' });
    document.querySelectorAll('.team, .team-grid').forEach(function (el) { io.observe(el); });
}
```

### How to verify it works

In headless Chrome via `gstack browse`:

```bash
B=~/.claude/skills/gstack/browse/dist/browse
$B viewport 1440x900
T=$(date +%s%N)
$B goto "https://casacalda-website.pages.dev/?cb=$T"
$B wait --networkidle
sleep 3
$B scroll .team
sleep 4
$B js "var vids = document.querySelectorAll('.team-card video'); var r = ''; vids.forEach(function(v,i){ r += 'v'+i+': preload='+v.preload+' t='+v.currentTime.toFixed(2)+' paused='+v.paused+' rs='+v.readyState+' '; }); r;"
```

Expected: `preload=auto`, `t=0.05`, `paused=true`, `rs=4` for all eight videos.

Then simulate hover/leave:

```bash
$B js "var c=document.querySelector('.team-card'); c.dispatchEvent(new MouseEvent('mouseenter', {bubbles:true})); 'hover'"
sleep 1
$B js "var v=document.querySelector('.team-card video'); 'paused='+v.paused+' t='+v.currentTime.toFixed(2);"
# expected: paused=false, currentTime > 0.5
$B js "var c=document.querySelector('.team-card'); c.dispatchEvent(new MouseEvent('mouseleave',{bubbles:true})); 'leave'"
sleep 1
$B js "var v=document.querySelector('.team-card video'); 'paused='+v.paused+' t='+v.currentTime.toFixed(2);"
# expected: paused=true, currentTime=0.05
```

For Safari testing, open `https://casacalda-website.pages.dev/` on a Mac (or iPhone via the same URL), hard-refresh (⌘+Shift+R on macOS Safari), scroll to the team section, and confirm portraits appear immediately (not blank/black).

### Known constraints / future improvements

- **Videos are served from `cms.casacalda.com`** (Hostinger). Each portrait is 1.5–3 MB. If Hostinger flaps (see `site-flapping.md`), the first-frame seek can fail silently; cards stay blank. The IO observer means we only hit Hostinger when the visitor scrolls there, so this only affects people who actually look at the team section.
- **No `poster=` attribute is set.** We deliberately don't extract poster JPGs from each video — would require a build step or a WP field. The seek-to-0.05 trick gets the same visual result with zero asset overhead.
- **`preload="metadata"` is the initial value** (set in render.js). The IntersectionObserver upgrades it to `auto`. If you ever want to make team videos visible above the fold (e.g. a hero featuring a portrait), change the initial value in render.js to `auto` for that specific emit site — don't rip the IO observer out, it still does the right thing.

### How to revert

Delete the entire "STAFF VIDEOS: play on hover only" block in `main.js` (~lines 578–630) and restore the original 6-line version (committed in `c58b835`'s parent — see `git log -- main.js`). The video tags in render.js don't need to change. Bump cache-bust, push.

---

## Pre-launch gate (Cloudflare Pages Functions middleware)

The site sits behind a preview-token gate — visitors without the bypass cookie are 302'd to `/coming-soon.html`. The gate is one file: `functions/_middleware.js`. Any request to a Pages Function file at the repo root runs at the CF edge before the static asset is served.

### How the flow works

```
Visitor → CF edge runs functions/_middleware.js
              │
              ├─ Cookie cc_preview=1 present?    → next() → real site
              │
              ├─ ?preview=<TOKEN> in URL?        → 302 + Set-Cookie (Max-Age=1yr) → clean URL
              │
              ├─ path is /coming-soon /assets/ *.mp4 etc?  → next() → static asset
              │
              └─ everything else                 → 302 → /coming-soon.html
```

### The current preview URL

```
https://casacalda.com/?preview=casa-prelaunch-0f81db5d
```

Works on any page — just append `?preview=…` to any URL. First click sets a 1-year cookie; subsequent visits from that browser skip the gate.

### Rotating the token

1. Edit `PREVIEW_TOKEN` in `functions/_middleware.js` (top of file)
2. Bump cache-bust, commit, push
3. Old links stop working immediately
4. Existing cookie holders keep working until their cookie expires or they clear cookies

### Force-revoke EVERY existing bypass cookie (nuclear)

Change BOTH `PREVIEW_TOKEN` AND `BYPASS_COOKIE` (e.g. `cc_preview` → `cc_preview2`) in the same commit. The renamed cookie name means no one's existing cookie matches, so every browser has to re-preview with the new token.

### Removing the gate at launch

Delete `functions/_middleware.js`, replace `robots.txt` with a normal `User-agent: * / Allow: /` (or whatever indexing policy you want), commit, push. Next deploy resumes plain static serving.

Detailed pass-through rules and passthrough exts are documented inline in the middleware file itself.

---

## Homepage hero video

The `.hero` section on `index.html` renders a locally-hosted looping video (repo-served, not from WP media). Everything about it lives in three places:

| Piece | Where |
|---|---|
| Video file | `assets/hero-home.mp4` (currently ~22 MB, 1920×1080 @ 50 fps, 49 s) |
| Poster JPG | `assets/hero-home-poster.jpg` (~65 KB, frame at 0.5 s) |
| Emitter | `render.js` `T.hero` (bypasses `mediaTag`, hard-emits `<video>` with `poster=` attribute) |
| CSS | `.hero__bg video` (extended from the `img` rule at style.css:162) |
| Mobile shape | Below 600 px viewport, `.hero { aspect-ratio: 1/1; height: auto; }` — square, not tall vertical |
| Logo fade | `main.js` sets `.hero__logo--faded` on `.hero__logo` after 5 s; CSS transitions opacity + scale over 1.2 s |

### Swap the video

```bash
# Fresh 4K/HD source → transcode to hero-home.mp4
SRC=/path/to/new-hero.mp4
DST="$(pwd)/assets/hero-home.mp4"
POSTER="$(pwd)/assets/hero-home-poster.jpg"

ffmpeg -y -i "$SRC" \
  -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -c:v libx264 -crf 22 -preset slow -profile:v high -level 4.0 \
  -g 30 -keyint_min 30 -sc_threshold 0 \
  -movflags +faststart -pix_fmt yuv420p -an \
  "$DST"

ffmpeg -y -ss 0.5 -i "$SRC" -frames:v 1 -vf "scale=1920:-1" -q:v 4 "$POSTER"

# Bump cache-bust, commit, push. That's it.
```

CRF 22 is high quality; drop to 24 or 26 for smaller file. `-g 30 -keyint_min 30 -sc_threshold 0` puts a keyframe every ~0.6 s so scrubbing/looping is smooth.

### Revert to a static image hero

Delete the `HERO_HOME_VIDEO` / `HERO_HOME_POSTER` constants and the `bgHtml = '<video …>'` block in `T.hero`, restore the original `mediaTag(d.bg, …)` call. The WP-supplied image bg comes back automatically.

---

## WordPress-side operations (Thomas's headless WP + `casacalda/v1/` plugin)

The static site fetches data from `cms.casacalda.com` — a headless WP install on Hostinger. Thomas owns the plugin; a few operational quick refs:

| Endpoint | Purpose |
|---|---|
| `GET /wp-json/casacalda/v1/site` (also `?rest_route=/casacalda/v1/site`) | Brand + nav + footer config |
| `GET /wp-json/casacalda/v1/page&slug=<x>` | Page sections (media/entity refs resolved) |
| `GET /wp/v2/staff` | Team members CPT (`cc_staff`), all published |
| `GET /wp/v2/projects` | Project CPT |
| `POST /wp-json/casacalda/v1/contact` | Contact form submit |

### Bulk-managing staff without wp-admin clicks

The `cc_staff` post type stores `cc_role`, `cc_group`, `cc_video` as post_meta that WP REST doesn't expose (not registered with `show_in_rest`). To bulk-update:

1. Log in via `wp-login.php` with a WP user's password to get session cookies
2. Fetch `/wp-admin/post.php?post=<id>&action=edit` to scrape `_wpnonce`, `cc_staff_nonce`, and all hidden inputs (keep the FIRST occurrence of each name — a meta-box adds a second `action` input that will clobber the real `editpost`)
3. POST the same form back to `/wp-admin/post.php` with your new title, `cc_role`, `cc_group`, `cc_video`, plus `save=Update`

Full working script preserved in `/tmp/staff-driver-v2.py` from the 2026-06-26 bulk import — check commit `f6a693a` for context if you need to redo this.

### Team-portrait video upload (WP media library)

Videos go through `POST /wp-json/wp/v2/media` with:
```
Content-Type: video/mp4
Content-Disposition: attachment; filename="<ascii-only-name>.mp4"
X-WP-Nonce: <scraped from /wp-admin/ page>
Cookie: <session cookies from wp-login.php>
User-Agent: Mozilla/…  (Cloudflare's bot filter blocks Python-urllib/curl defaults on some paths)
```

Georgian filenames are rejected — WP wants ASCII in `Content-Disposition`. Transliterate the person's name (see `/tmp/translit.py` from the same commit) and put the real Georgian in the `title` field of the staff post afterwards.

### Cloudflare Cache Rule for the REST API

**Not yet in place** — Thomas is scheduled to add this per `THOMAS_WP_FLAP_FIXES.md`. Once shipped, `/casacalda/v1/*` responses will be edge-cached for 30 min and the site will be immune to Hostinger flaps for cacheable content. See that doc for the exact CF rule.

---

## Cloudflare access

The Casa Calda Cloudflare account is under `d.baliashvili@itcraft.ge` (ITcraft, not Martivi). We manage it via:

- **Global API Key** (email + `cfk_…` key) — stored in `../.env` as `CF_EMAIL` + `CF_GLOBAL_KEY`, gitignored, chmod 600. Full account access. Do NOT commit or share.
- **Toma's scoped token** (`cfut_EGI9…`) — created via the Global Key, permissions: Pages Write + DNS Write + Rulesets Write + Cache Purge + Zone Read. Toma should use this in his GitHub Actions, `wrangler`, and `casacalda/v1/` plugin's CF purge hook.

### Common operations

```bash
# Load
CF=$(grep CF_GLOBAL_KEY ../.env | cut -d= -f2)
EMAIL=$(grep CF_EMAIL ../.env | cut -d= -f2)
ACCOUNT=4c05de69627ec8453970a2c40a3a54f9
ZONE_COM=a19e1a001741e382a060ba9121beb562
ZONE_GE=54320e7e8491fa2d4aa6ce6244ffd2d1

# List DNS records for casacalda.com
curl -sH "X-Auth-Email: $EMAIL" -H "X-Auth-Key: $CF" \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_COM/dns_records?per_page=100" | jq '.result[] | {name,type,content}'

# Purge everything on casacalda.com
curl -sH "X-Auth-Email: $EMAIL" -H "X-Auth-Key: $CF" -X POST \
  "https://api.cloudflare.com/client/v4/zones/$ZONE_COM/purge_cache" \
  -H "Content-Type: application/json" -d '{"purge_everything":true}'

# Mint a new scoped token (equal-or-less permissions than the parent)
# See the "Toma's token" recipe in the 2026-07-02 chat transcript,
# or just re-run the exact permission_groups block from commit history
```

### Rotate the Global Key (nuclear)

dash.cloudflare.com → click profile avatar → My Profile → API Tokens → **Global API Key** → **Roll**. Old key dies instantly. Paste new key into `.env`. Any downstream scripts that referenced the old key stop working — includes any wp-cron in the WP plugin.

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
