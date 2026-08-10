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

### Branch previews

Any non-master branch gets its own Cloudflare Pages deploy via `.github/workflows/preview-pages.yml`:

```
https://<branch-name>.casacalda-website.pages.dev/?preview=casa-prelaunch-0f81db5d
```

Branch names are slugified (`/` → `-`). The preview sits behind the same pre-launch gate, so the `?preview=` token is needed there too. **Review PRs at their preview URL** — PR #6 shipped without one and had to be reviewed off a local server, which cost several rounds.

---

## Cache-busting discipline — read this before shipping any asset

Three separate bugs on 2026-08-04 had the same root cause: **a fix shipped correctly and the browser never fetched it.** A correct fix the browser doesn't load is indistinguishable from no fix, which is exactly how each survived multiple "it's still broken" rounds.

| What | Was | Why it bit |
|---|---|---|
| `main.js` | hardcoded `?v=20260663` in `app.js`, never bumped since June | Team-video fixes shipped invisible. A commit titled *"bump cache-bust to ensure fresh main.js"* bumped the HTML tags but not that line. |
| `hero-home.mp4` | bare path, no `?v=` | Hero swap appeared not to work |
| `hero-home-poster.jpg` | bare path, no `?v=` | Poster/video mismatch persisted after being fixed |

Cloudflare serves assets `public, max-age=14400, must-revalidate` — **4 hours with no revalidation.** A returning visitor keeps the old file for that long.

**The rule: every repo-served asset referenced from JS must carry the build tag.** Don't hand-maintain the version — derive it from the referencing script's own `?v=`:

```js
var BUILD_Q = (function () {
    var s = document.currentScript || document.querySelector('script[src*="render.js"]');
    var m = s && s.src && s.src.match(/[?&]v=([^&#]+)/);
    return m ? '?v=' + m[1] : '';
})();
```

In place now: `app.js` (for `main.js`), `render.js` (hero video + poster), `cms.js` (appends `_v=` to every WordPress fetch, so CMS content edits appear on the next deploy instead of waiting out the ~30-min edge cache).

Bumping the tag in the HTML `<script>`/`<link>` tags now cascades to all of it. **Grep before you ship:**

```bash
grep -rnE "'/assets/[^']*'" render.js | grep -v BUILD_Q   # bare asset paths — suspicious
grep -n "\.js?v=" app.js                                   # must not be a literal
```

Paired assets are the sharp edge: the hero poster **must** match frame 0 of the hero video. Version them independently-or-not-at-all and a new video can pair with a cached old poster, silently reintroducing a fixed bug.

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

**The video tags** are emitted by `T.team` (render.js:480), `T['team-grid']` (render.js:535), and `T['about-proj-card']` (render.js:617). All three render:

```html
<video src="…cms.casacalda.com/…/portrait.mp4" muted loop playsinline preload="metadata"></video>
```

No `autoplay`, no `poster=` attribute in the tag — that's intentional. The first-frame paint + hover play/pause logic lives in `main.js` ("STAFF VIDEOS: play on hover only" block).

### The problem (mobile-Safari specific)

Team cards render as blank black rectangles until the user hovers/taps. On desktop Chrome/Firefox this rarely shows up. On **iOS Safari + iOS Chrome** (both WebKit) it's guaranteed:

- WebKit strictly honors `preload="metadata"` and fetches ONLY the moov atom, zero frame data.
- Runtime `v.preload = 'auto'` flips don't force a re-fetch — WebKit treats `preload` as a load-time hint.
- A paused `<video>` with no decoded frames renders its background color (black on iOS).

### Current fix (2026-07-06, commit `b371e15`) — the play-then-pause dance

For every observed video: force a fetch, then briefly `.play()` so WebKit is compelled to buffer + decode + composite a frame, then immediately pause and seek slightly forward.

```js
// main.js — abridged
function primeVideoForPaint(v) {
    // Force WebKit to re-evaluate preload strategy + actually fetch bytes.
    try { v.preload = 'auto'; v.load(); } catch (e) {}
    var done = false;
    var finish = function () {
        if (done) return; done = true;
        try { v.pause(); v.currentTime = 0.05; } catch (e) {}
    };
    var attemptPlay = function () {
        if (done) return;
        var p = v.play();
        if (p && p.then) {
            // muted + playsinline = autoplay is permitted → play() succeeds
            // → WebKit paints a frame → pause 60ms later.
            p.then(function () { setTimeout(finish, 60); })
             .catch(function () { try { v.currentTime = 0.05; } catch (e) {} });
        } else {
            try { v.currentTime = 0.05; } catch (e) {}
        }
    };
    if (v.readyState >= 2) attemptPlay();
    else v.addEventListener('loadeddata', attemptPlay, { once: true });
}

// Observation is at SECTION level (not per-video) — horizontal scrollers
// on the About page put many cards off-viewport where per-video IO never fires.
var teamContainers = document.querySelectorAll('.team, .team-grid');
if (teamContainers.length && 'IntersectionObserver' in window) {
    var teamSectionObserver = new IntersectionObserver(function (entries, obs) {
        entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.querySelectorAll('video').forEach(primeVideoForPaint);
            obs.unobserve(entry.target);
        });
    }, { rootMargin: '300px' });
    teamContainers.forEach(function (c) { teamSectionObserver.observe(c); });
}
```

### Fix history — read before touching this code

Three iterations, each catching a real-device failure the previous one missed:

1. **2026-06-26 (`a4378c8`, `c58b835`)** — Original fix. Seek `currentTime = 0.05` in `loadeddata`; observe `.team`/`.team-grid` sections; flip `preload` to `auto`. Comment said "do NOT call `v.load()`" because it would reset the seek. **Worked on Mac Safari + desktop Chrome/Firefox.** Verified via headless Chromium.

2. **2026-07-02 (`3523767`, Thomas)** — Rewrote observer to watch INDIVIDUAL video elements instead of sections. Rationale: don't fire 20 simultaneous fetches for the About page team-grid. **Broke on all mobile.** Horizontal-scroll cards past the viewport's right edge never intersect individually → their preload never gets promoted → blank forever.

3. **2026-07-06 (`4c00f8e`)** — Reverted to section-container observation. Headless-Chromium test showed 34/34 videos painting. **User reported real iPhone was still blank in incognito.** Root cause: headless Chromium ignores strict `preload="metadata"` semantics; real WebKit doesn't. Seek-to-0.05 without frame bytes is a no-op.

4. **2026-07-06 (`b371e15`)** — Adds explicit `v.load()` before the seek (forces WebKit to actually re-fetch) and switches to **play-then-pause dance** (real WebKit composites a frame during `.play()`, guaranteed). **Still blank on real Safari** — it primed all 39 videos at once (see 5).

5. **2026-08-04** — Current. **Chunked priming (`CHUNK = 6`, `CHUNK_GAP = 120`).** This is the fix that actually works, and it is the load-bearing one.

   **Real root cause, finally measured.** Each primed `<video>` holds a media resource slot while it buffers, and the play-then-pause dance *pauses* rather than releases it. Priming all ~39 staff videos concurrently from a cold cache exhausts WebKit's media pipeline: every element deadlocks at `readyState 0` / `networkState 2` (LOADING, forever, no error) and the whole team section renders blank. Chromium's cap is far higher, so it loads all 39 without complaint.

   Measured on **real Safari 26.5** against the live site, same page, same session:

   | | Result |
   |---|---|
   | all 39 primed at once | **0 / 39 painted** |
   | sequential chunks of 6 | **39 / 39 painted** |

   It is **not** autoplay (a standalone muted video reports `autoplay: ALLOWED`), not the codec (H.264 High / yuv420p / faststart), not `preload`, not the server (Range returns 206).

   Also fixed in the same change: `app.js` injects `main.js` at runtime and had its `?v=` **hardcoded at `20260663`** since June, while every HTML `<script>` tag got bumped. A shipped `main.js` fix stayed invisible to any browser holding the cached copy. (Commit `884ea19`, titled "bump cache-bust to ensure fresh main.js", bumped the HTML tags but not that line.) `main.js` now inherits `app.js`'s own `?v=`, so it can never drift again.

   Note: Toma wrote this same chunking in `4aaee7c` / `ed7ed6f`; it was discarded in PR #4's revert of the hero/carousel lag experiments (preserved on `thom-lag-backup`). The right fix existed and was thrown away.

**Do not** revert to per-video observation. Do not remove the `.load()`. Do not remove the `.play()` call — the seek alone is not enough on real iOS. **Do not prime all videos at once** — that is the bug, and Chromium will not show it to you.

### Why play-then-pause works everywhere

- **Desktop Chrome/Firefox**: fetches on `preload="auto"` flip anyway; `.play()`+pause visibly paints a frame; the `currentTime=0.05` seek at the end lands on the desired frame. Net effect: same as before.
- **iOS Safari**: `.load()` triggers real fetch; `.play()` (allowed because `muted+playsinline`) forces decode+composite; pause 60 ms later leaves the decoded frame on screen; seek nudges to 0.05. The visible "flash" is imperceptible.
- **iOS Chrome (WebKit under the hood)**: same as iOS Safari.

### How to verify — READ THIS FIRST

**Never verify this code in headless Chromium.** Chromium loads all 39 videos happily and reports `painted: 39, blank: 0` whether the fix is present or not. Three separate "verified" fixes shipped broken because they were signed off on a Chromium run. A green Chromium result means nothing here.

Two checks that do work, in order of reliability: real Safari (below), then a real iPhone.

### How to verify in real Safari (desktop, automated)

Drives actual Safari over WebDriver — the real media pipeline, not Playwright's relaxed WebKit build (Playwright loosens autoplay policy, which masks this class of bug).

One-time setup, run by a human because it needs an admin password:

```bash
sudo safaridriver --enable      # then Safari → Develop → Allow Remote Automation
```

Then:

```bash
safaridriver -p 4444 &
```

Create a WebDriver session against `http://localhost:4444`, load the page, scroll `.team` / `.team-grid` into view, wait ~10s for the chunk queue to drain, and evaluate:

```js
var v = Array.prototype.slice.call(
  document.querySelectorAll('.team-card__img video, .team-grid__img video'));
var o = { total: v.length, painted: 0, blank: 0, stuck: 0 };
v.forEach(function (x) {
  if (x.readyState >= 2 && x.currentTime > 0) o.painted++;
  else { o.blank++; if (x.networkState === 2 && x.readyState === 0) o.stuck++; }
});
JSON.stringify(o);
```

Expected: `painted: 39, blank: 0, stuck: 0`. **`stuck > 0` is the signature of this bug** — elements fetching forever because the media pipeline is saturated.

Serving the frontend locally? Append **`?api=prod`** — `cms.js` points a `localhost` frontend at `http://casacalda.local`, which won't resolve, and the page renders an error instead of any team cards (`total: 0`).

### How to verify on real iOS

The last word on mobile. Steps:

1. Open `https://casacalda.com/` in Safari or Chrome on an actual iPhone
2. Open a fresh incognito/private tab (rules out cache staleness)
3. Scroll to "ჩვენი გუნდი"
4. Every card should show a portrait immediately — no blank rectangles
5. Also visit `casacalda.com/team.html` and scroll through the horizontal team-grid — same check
6. Tap a card → it should start playing full-motion; release → it should snap back to the paused first frame

If any card is still blank, the fix hasn't landed — check cache-bust in served HTML matches the repo:

```bash
LIVE=$(curl -s https://casacalda.com/ | grep -oE 'main\.js\?v=[0-9]+' | head -1)
REPO=$(grep -oE 'main\.js\?v=[0-9]+' index.html | head -1)
echo "live: $LIVE   repo: $REPO"
```

### Known constraints

- **Videos served from `cms.casacalda.com`** (Hostinger). Each portrait is 0.2–1 MB. Cloudflare Pages is planned to eventually front these too, but for now they hit Hostinger. If WP is flapping (see `site-flapping.md`) the video URLs 5xx and cards stay blank — no JS can fix that.
- **Section observation loads ALL videos** in the section when it enters viewport. For the current 20-staff About page that's ~10 MB simultaneous. Per-video lazy-load would save bandwidth but breaks on mobile horizontal scrollers. Section-level observation is the correct trade-off.
- **Play-then-pause loads slightly more per video** than pure seek would (an extra ~100 KB per video to reach `canplay`). That's the price of iOS compatibility.

### How to revert to the June 26 version (only if this fix breaks something worse)

```bash
git show c58b835:main.js > /tmp/main-known-good.js
# ...manual patch of the STAFF VIDEOS block, or:
git checkout c58b835 -- main.js
# Then bump cache-bust and push. But: this reintroduces the mobile-blank bug.
```

Prefer: iterate on `primeVideoForPaint` — don't full-revert.

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
| Video file | `assets/hero-home.mp4` (~18 MB, 1920×1080 **@ 30 fps**, 49 s) — see the frame-rate rule below |
| Poster JPG | `assets/hero-home-poster.jpg` (~64 KB, **frame at 0.0 s** — must match where playback starts) |
| Emitter | `render.js` `T.hero` (bypasses `mediaTag`, hard-emits `<video>` with `poster=` attribute) |
| CSS | `.hero__bg video` (extended from the `img` rule at style.css:162) |
| Mobile shape | Below 600 px viewport, `.hero { aspect-ratio: 1/1; height: auto; }` — square, not tall vertical |
| Logo fade | `main.js` sets `.hero__logo--faded` on `.hero__logo` after 5 s; CSS transitions opacity + scale over 1.2 s |

### The poster rule — it must be the FIRST frame

**Generate the poster with no `-ss`.** The old recipe used `-ss 0.5`, and that single flag was the cause of the long-running "hero glitches and restarts" complaint.

`poster=` paints instantly, before a single video byte arrives. Playback then begins at `currentTime = 0`. If the poster is the frame at 0.5 s, the visitor sees the 0.5 s image, then the video snaps **backward** to 0.0 s and replays that half second. It reads exactly like a stutter-and-restart — on every load, in every browser, cached or not.

That browser-independence is the tell, and it's why bandwidth, codec and `backdrop-filter` theories all came up empty for weeks: nothing about it is a *media* problem. It's two images shown in the wrong order.

Verify with a pixel diff — the poster must match frame 0, not some later frame:

```bash
ffmpeg -y -v error -i assets/hero-home.mp4 -frames:v 1 -vf "scale=480:270,format=gray" /tmp/f0.png
ffmpeg -y -v error -i assets/hero-home-poster.jpg -vf "scale=480:270,format=gray" /tmp/p.png
# Compare /tmp/f0.png and /tmp/p.png — they should be near-identical.
```

Measured before the 2026-08-04 fix: poster-vs-frame-0 difference **44.87**, poster-vs-frame-0.5 **14.63** (i.e. it was the 0.5 s frame). After: poster-vs-frame-0 is **1.98** — JPEG noise only.

If the first frame is a bad still (black, mid-blink), **re-cut the video so it opens on a good frame**. Do not paper over it by picking a later poster.

**Colour-match it too.** The video is limited-range `bt709`; a JPEG written without colour flags is full-range `bt601`, so the poster decodes ~3 levels brighter in green and you get a visible tint pop the moment the video takes over. The `in_color_matrix=bt709:in_range=tv:out_range=pc` in the recipe fixes that:

| Poster | mean abs Δ vs frame 0 | G / B delta |
|---|---|---|
| No colour flags | 2.29 | +3.06 / +2.23 |
| **Colour-matched** | **1.21** | **+0.74 / −0.02** |

1.2 is the floor — that's 4:2:0 chroma subsampling, not compression. Raising JPEG quality past `-q:v 6` only grows the file (72 KB → 120 KB at `q:v 2`) without improving the match.

### The frame-rate rule — encode at 30 fps, always

**`-r 30` is not optional.** The hero shipped at 50 fps for months (the recipe below had no `-r` flag, so it silently inherited whatever the source was) and it visibly stuttered in **both** Chrome and Safari on every load.

A display can only present a frame on a refresh boundary. 50 fps divides evenly into no common refresh rate, so each frame is held for either one refresh or two, forever:

| Video | 60 Hz | 75 Hz | 120 Hz |
|---|---|---|---|
| 50 fps | 1.2 ✗ | 1.5 ✗ | 2.4 ✗ |
| **30 fps** | **2 ✓** | 2.5 ✗ | **4 ✓** |
| 25 fps | 2.4 ✗ | **3 ✓** | 4.8 ✗ |

Measured on real Safari (`requestVideoFrameCallback`, 6 s window, ~60 Hz display):

| Encode | Frames presented | Target | Jitter (SD) |
|---|---|---|---|
| 50 fps | 272 / 280 → **~46 fps** | 300 | 7.4 – 7.9 |
| **30 fps** | 181 → **30.0 fps** | 180 | **2.07** |

At 50 fps the browser silently misses ~9 % of frames. At 30 fps it hits the target exactly and jitter drops 3.7×. This is display arithmetic, not a codec or bandwidth problem — which is why re-encoding at the same 50 fps (`6efd376`, later reverted in `34dc824`) never fixed it, and why it looked identical in Chrome and Safari.

Dropping 50 → 30 fps also makes the file *better*, not worse: half the frames means each one gets more bits at a lower total bitrate. The 2026-08-04 swap went 23.0 MB → 18.3 MB (−21 %) while per-frame budget rose 74.5 → 98.3 kbit (+32 %), SSIM 0.9964 against the original.

### Swap the video

```bash
# Fresh 4K/HD source → transcode to hero-home.mp4
SRC=/path/to/new-hero.mp4
DST="$(pwd)/assets/hero-home.mp4"
POSTER="$(pwd)/assets/hero-home-poster.jpg"

ffmpeg -y -i "$SRC" \
  -vf "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
  -r 30 \
  -c:v libx264 -crf 22 -preset slow -profile:v high -level 4.0 \
  -g 60 -keyint_min 60 -sc_threshold 0 \
  -movflags +faststart -pix_fmt yuv420p -an \
  "$DST"

# Poster MUST be the FIRST frame (no -ss) AND colour-matched to the video.
# in_color_matrix/in_range tell ffmpeg the source is limited-range bt709; without
# them the JPEG lands ~3 levels bright and you get a colour pop at the handoff.
ffmpeg -y -i "$DST" -frames:v 1 \
  -vf "scale=1920:-1:in_color_matrix=bt709:in_range=tv:out_range=pc,format=rgb24" \
  -q:v 6 "$POSTER"

# Verify BEFORE committing — this must print 30/1:
ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 "$DST"

# Bump cache-bust, commit, push.
```

CRF 22 is high quality; drop to 24 or 26 for a smaller file. `-g 60 -keyint_min 60 -sc_threshold 0` puts a keyframe every 2 s at 30 fps.

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

### Shell access (wp-cli)

Everything below is faster and safer via `wp-cli` over SSH than through wp-admin:

```bash
ssh -i ~/.ssh/casacalda_hostinger -p 65002 u168788757@72.60.93.156
cd ~/domains/casacalda.com/public_html/cms
wp post list --post_type=project --post_status=any \
   --fields=ID,post_title,post_status,menu_order --format=table
```

Post types are **singular**: `project`, `cc_staff`, `cc_service`, `cc_page`. The REST bases are plural (`/wp/v2/projects`) — `wp post list --post_type=projects` silently returns nothing, which looks like "no projects exist."

**Always back up before mutating**, into `backups/cms-projects/` in this repo:

```bash
wp post list --post_type=project --post_status=any \
   --fields=ID,post_title,post_name,post_status,menu_order --format=json > projects-all-$(date +%F-%H%M%S).json
wp post meta list <ID> --format=json > <slug>-meta-BEFORE-$(date +%F-%H%M%S).json
```

### Hide a project from the site

**Set it to `draft`. Never delete** — project data lives only in WordPress, not in git, so a delete is unrecoverable.

```bash
wp post update <ID> --post_status=draft
wp cache flush; wp litespeed-purge all
```

Draft removes it from the public site immediately (the frontend only reads `publish`) while keeping the post, its photos and its `menu_order` intact in wp-admin. Reverse with `--post_status=publish`.

This is the site's established convention — several projects are already parked as drafts. Verify against the endpoint the frontend actually calls, not just wp-admin:

```bash
curl -s "https://cms.casacalda.com/?rest_route=/wp/v2/projects&per_page=50&_cb=$(date +%s)" \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d),'published')"
```

Done 2026-08-04 for **კაკლები** (26) and **ლისი 2** (22) — note **ლისი 1** (20) is a *separate* project. Confirm which one is meant before touching either.

### Swap a project's main photo

The hero is the **featured image** (`_thumbnail_id`); the rest live in a serialized `cc_gallery` meta array of attachment IDs.

```bash
wp post meta get <ID> _thumbnail_id
wp post meta get <ID> cc_gallery --format=json

# Find an attachment ID from a filename:
wp db query "SELECT ID, guid FROM wp_posts WHERE post_type='attachment' AND guid LIKE '%GM1Q9925%';" --skip-column-names
```

To swap the hero with a gallery image, use `wp eval` — `wp post meta update` will double-serialize a PHP array:

```bash
wp eval 'update_post_meta(14, "_thumbnail_id", 103);
         update_post_meta(14, "cc_gallery", array(99,100,101,102,98));'
wp cache flush; wp litespeed-purge all
```

Put the **outgoing** hero into the slot the incoming one vacated, so the gallery keeps its length and no image is silently dropped. Verify on the frontend's own payload — `cc.image` is what renders:

```bash
curl -s "https://cms.casacalda.com/?rest_route=/wp/v2/projects&slug=<slug>&_cb=$(date +%s)" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['cc']['image'])"
```

Done 2026-08-04 for Axis Towers (14): hero 98 → 103 (`GM1Q9925`), and 98 took 103's gallery slot.

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

### Editing footer contact info (phone / email / address / socials)

The footer's contact column (top row: address + email + phone + socials) is CMS-driven from `wp_options.cc_site_globals.footer.contacts.*`. The plugin file `wp-content/plugins/casacalda-control/includes/globals.php` only supplies defaults — the DB option overrides it once set.

**Wrong instinct:** editing the plugin file and pushing to git — the DB option wins and your file change is a no-op for the live site.

**Right way — patch the nested key in the DB option:**

```bash
ssh -i ~/.ssh/casacalda_hostinger -p 65002 u168788757@72.60.93.156
cd ~/domains/casacalda.com/public_html/cms

# Back up first — cc_site_globals holds nav, brand, socials, copy, contact recipient, etc.
mkdir -p ~/backups/globals-$(date +%Y%m%dT%H%M%SZ)
wp option get cc_site_globals --format=json > ~/backups/globals-*/cc_site_globals.json

# Patch a single nested key (leaves nav / brand / socials / etc. untouched)
wp option patch update cc_site_globals footer contacts phone "+995 32 2 311 525"
wp option patch update cc_site_globals footer contacts email "info@casacalda.ge"
wp option patch update cc_site_globals footer contacts address1 "საქართველო, თბილისი"

# Then fix the plugin default too (so a wipe/reinstall defaults to the right value)
sed -i "s/OLD_VALUE/NEW_VALUE/g" wp-content/plugins/casacalda-control/includes/globals.php
sed -i "s/OLD_VALUE/NEW_VALUE/g" wp-content/plugins/casacalda-control/includes/migrate.php

wp cache flush
```

Mirror the two `.php` edits into `website/wordpress/plugins-live-backup/casacalda-control/includes/` in the outer repo so the local backup stays in sync.

**Then purge Cloudflare — by HOST, not by URL.** The frontend calls `?rest_route=/casacalda/v1/site&_v=<version>` (not just `/wp-json/casacalda/v1/site`), and Cloudflare keys cache by full URL. If you purge only the pretty `/wp-json/...` variant, the frontend's actual request stays cached and the DB change is invisible for hours.

```bash
CF=$(grep CF_GLOBAL_KEY ../.env | cut -d= -f2)
EMAIL=$(grep CF_EMAIL ../.env | cut -d= -f2)
curl -sH "X-Auth-Email: $EMAIL" -H "X-Auth-Key: $CF" -X POST \
  "https://api.cloudflare.com/client/v4/zones/a19e1a001741e382a060ba9121beb562/purge_cache" \
  -H "Content-Type: application/json" -d '{"hosts":["cms.casacalda.com"]}'
```

Only the Global Key auth (`X-Auth-Email` + `X-Auth-Key`) has purge permission on this zone — the scoped `cfut_…` token in `.env` returns `Authentication error` on `/purge_cache`.

**Verify in a real browser, not with curl.** curl one URL tests one URL; the browser executes the app's actual fetch, so it catches "curl on `/wp-json/...` says 525 but the frontend loads `?rest_route=...` cached at 325." Use `browse`:

```bash
$B goto https://casacalda.com/
$B js "Array.from(document.querySelectorAll('a[href^=\"tel:\"]')).map(a=>({href:a.href,text:a.textContent.trim()}))"
```

Or ⌘⇧R on your own machine to bypass your local disk cache.

**Bare-minimum change:** the phone can be updated via wp-admin → Settings → Casa Calda Control → Footer → Phone, but that skips the plugin-default fix and the CF purge, so the browser can keep serving the old value.

Reference: phone 325 → 525 done 2026-08-10 this way — DB patch + plugin defaults + host purge. Server snapshot at `~/backups/phone-fix-20260810T154439Z/`.

### Footer legal strip contents (render.js)

The narrow strip at the very bottom of the footer is rendered in `render.js` (`legalHtml` block, ~line 320) from `i18n.js` keys, NOT from the CMS. As of 2026-08-10:

- **Shown:** company name → address → email → phone → privacy policy link → terms of use link
- **NOT shown:** reg ID (`ს/კ 204976179`) — removed 2026-08-10 per client. The ID still lives in the body text of `privacy-policy.html` and `terms-of-use.html`, which are one click away via the footer links.

If legal ever asks to restore the reg ID in the strip:
1. Uncomment / re-add the `legal_id` span in `render.js` (~line 323) — the `legal_id` translation is still in `i18n.js:76-79`
2. Bump `?_v=` on the render.js load in `index.html` (see "Cache-busting discipline") so browsers pick it up

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

### Open as of 2026-08-04

- **Team-card posters (recommended next).** The 39 staff videos are still primed by JS (`primeChunk`), which means the first frame depends on `.play()` succeeding. Give each card a first-frame JPG `poster=`, set `preload="none"`, and load the video on hover. That removes the whole failure class — no priming, no concurrency ceiling, no autoplay dependency — and cuts ~39 × 1.4 MB of MP4 to ~39 × 40 KB of JPG. Same reasoning as the hero poster.
- **Hero cold-start weight.** 18 MB still stalls several seconds on a cold cache before playback. Frame rate is fixed; weight isn't. Options: shorten the loop, or serve a smaller mobile variant.
- **Unreproduced Safari report (2026-08-04).** Hero not replaying and team cards blank on refresh, on one Mac's Safari only; Chrome fine. **Not reproducible** in `safaridriver` (clean profile gives 39/39 and a healthy hero across loads and refreshes), and ruled out: Range support (206 everywhere), the pre-launch gate (media passes through uncookied), and per-site Auto-Play (set to the permissive default). Remaining suspects are that profile's cache or a Safari-only **Content Blocker** — which would explain Chrome being unaffected. Next step is a Private Window test on the affected machine.

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
- [REPORTS_RUNBOOK.md](./REPORTS_RUNBOOK.md) — the monthly-reports pipeline at `reports.casacalda.com` (separate repo, separate host — Vercel + Meta Ads)

The earlier `~/Projects/CASACALDA Local/website/RUNBOOK.md` and
`~/Projects/CASACALDA Local/website/BACKEND_RUNBOOK.md` are **pre-migration planning docs** from May 2026.
Both are superseded by this file. Keep them for historical reference; do not edit.
