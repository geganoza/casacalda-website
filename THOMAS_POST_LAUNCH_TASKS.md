# Toma — Post-launch task list

**Date drafted:** 2026-07-06
**Launch date:** 2026-07-05 (pre-launch gate removed)
**Supersedes:** `THOMAS_WP_FLAP_FIXES.md` — that file's tasks are pulled forward here with current status.

---

## Status snapshot (what's already done vs still open)

### ✅ Done — don't redo

| Item | When | Commit / evidence |
|---|---|---|
| Site launched (pre-launch gate removed) | 2026-07-05 | `functions/_middleware.js` deleted |
| Favicons added | 2026-07-05 | `favicon.ico`, `favicon.svg` |
| **casacalda.ge → casacalda.com 301 redirect** | Recently | `curl -sI https://casacalda.ge/` returns `301 → https://casacalda.com/` — verified today |
| Mobile team-card blank-video bug | 2026-07-06 | Commit `4c00f8e`. Was regressed on 2026-07-02 (`3523767`) when the IntersectionObserver was changed from watching containers to watching individual videos. Reverted to container observation. See `main.js` STAFF VIDEOS block. |

### ❌ Open (this doc)

1. `robots.txt` still says `Disallow: /` — **Google is not indexing the site**
2. `/casacalda/v1/*` still hits Hostinger on every request (no CF edge cache)
3. No analytics installed anywhere
4. No search console verification (Google or Bing)
5. Fallback error text in `i18n.js` still leaks `WordPress (Local)`
6. `cms.js` has no fetch timeout

---

## 🚨 URGENT — do first (tomorrow morning)

### 1. Replace `robots.txt` — currently blocking Google

**Problem.** The current `robots.txt` is left over from the pre-launch gate:

```
User-agent: *
Disallow: /
```

Every crawler that hits `casacalda.com/robots.txt` right now is told to leave and index nothing. **Every day this stays up is a day the site isn't in Google's index.**

**Fix.** Replace with a normal permissive robots + sitemap pointer:

```
User-agent: *
Allow: /
Disallow: /coming-soon
Disallow: /coming-soon.html

Sitemap: https://casacalda.com/sitemap.xml
```

Then commit + push. Verify: `curl https://casacalda.com/robots.txt` should show the new content within ~30s (Pages deploy time).

**Verification:** In Google Search Console → URL inspection → `https://casacalda.com/` → click **Test live URL**. Should say "URL is available to Google" (before your change it says "URL is not available to Google — robots.txt blocked").

---

### 2. Add the Cloudflare Cache Rule for `/casacalda/v1/*` (from the flap-fixes doc)

**Problem.** Every REST response still returns `cache-control: no-store, no-cache, must-revalidate` (WP core default). Cloudflare respects that → every visitor's every page load hits Hostinger origin twice. Verified today:

```
$ curl -sI "https://cms.casacalda.com/?rest_route=/casacalda/v1/site" | grep -iE "cache-control|cf-cache"
cache-control: no-store, no-cache, must-revalidate, max-age=0
cf-cache-status: DYNAMIC   ← should be HIT after this task
```

**Cloudflare Dashboard steps:**

1. https://dash.cloudflare.com → **casacalda.com** zone → **Caching → Cache Rules**
2. Click **Create rule** → name: `WP REST cache — casacalda/v1`
3. **When incoming requests match**:
   - `Hostname` equals `cms.casacalda.com`
   - AND `URI Path` starts with `/wp-json/casacalda/v1/`
   - Then click **Or** and add: `URI Query String contains rest_route=/casacalda/v1/`
4. **Then**:
   - Cache eligibility: **Eligible for cache**
   - Edge TTL: **Override origin — 30 minutes**
   - Browser TTL: **Respect origin**
5. Save + Deploy

**API form (equivalent, faster to script):**

```bash
export CF_API_TOKEN=cfut_...    # your Toma token — ask Giorgi if you don't have it
ZONE=a19e1a001741e382a060ba9121beb562   # casacalda.com

curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/rulesets" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WP REST cache — casacalda/v1",
    "kind": "zone",
    "phase": "http_request_cache_settings",
    "rules": [{
      "expression": "http.host eq \"cms.casacalda.com\" and (starts_with(http.request.uri.path, \"/wp-json/casacalda/v1/\") or http.request.uri.query contains \"rest_route=/casacalda/v1/\")",
      "action": "set_cache_settings",
      "action_parameters": {
        "cache": true,
        "edge_ttl": { "mode": "override_origin", "default": 1800 },
        "browser_ttl": { "mode": "respect_origin" }
      }
    }]
  }'
```

**Verify** the rule is working — hit the API twice:

```bash
curl -sI "https://cms.casacalda.com/?rest_route=/casacalda/v1/site" | grep -i cf-cache-status
# First response: DYNAMIC (goes to origin, gets cached)
sleep 2
curl -sI "https://cms.casacalda.com/?rest_route=/casacalda/v1/site" | grep -i cf-cache-status
# Second response: HIT (served from edge, doesn't touch Hostinger)
```

**Cache purging on content changes.** Add this to your `casacalda/v1/` plugin so every save/update triggers a Cloudflare purge:

```php
add_action('save_post',    'cc_purge_cf_cache', 10, 0);
add_action('deleted_post', 'cc_purge_cf_cache', 10, 0);
add_action('updated_option', 'cc_purge_cf_cache', 10, 0);
function cc_purge_cf_cache() {
    if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
    wp_remote_post('https://api.cloudflare.com/client/v4/zones/a19e1a001741e382a060ba9121beb562/purge_cache', [
        'timeout' => 5,
        'headers' => [
            'Authorization' => 'Bearer ' . getenv('CF_PURGE_TOKEN'),
            'Content-Type'  => 'application/json',
        ],
        'body' => wp_json_encode([
            'prefixes' => [
                'cms.casacalda.com/wp-json/casacalda/v1/',
                'cms.casacalda.com/?rest_route=/casacalda/v1/',
            ],
        ]),
    ]);
}
```

Store `CF_PURGE_TOKEN` in wp-config.php as an env var so it's not in plugin code:

```php
// wp-config.php
putenv('CF_PURGE_TOKEN=' . 'cfut_YOUR_TOMA_TOKEN_HERE');
```

**Expected impact:** median REST latency drops from ~600 ms to ~30 ms. Hostinger sees ~1% of the traffic it does today. Any WP flap becomes invisible for cached content.

---

## ⚡ HIGH — do this week

### 3. Set up Google Search Console + submit a sitemap

**Steps:**

1. https://search.google.com/search-console → **Add property** → URL prefix → `https://casacalda.com`
2. Verify ownership. Pick the DNS TXT method (easiest — you can add records via the Cloudflare token I gave you):

```bash
export CF_API_TOKEN=cfut_...
ZONE=a19e1a001741e382a060ba9121beb562

curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE/dns_records" \
  -H "Authorization: Bearer $CF_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "TXT",
    "name": "@",
    "content": "google-site-verification=<VALUE_FROM_SEARCH_CONSOLE>",
    "ttl": 300
  }'
```

(Or paste the meta tag Search Console gives you into `<head>` of `index.html` — either method works.)

3. Once verified, in Search Console → **Sitemaps** → submit `https://casacalda.com/sitemap.xml`.

**Sitemap generation.** The site is static, so you have two easy options:

**Option A** — hand-write it (7 pages, takes 5 min):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://casacalda.com/</loc><priority>1.0</priority></url>
  <url><loc>https://casacalda.com/about.html</loc><priority>0.8</priority></url>
  <url><loc>https://casacalda.com/services.html</loc><priority>0.8</priority></url>
  <url><loc>https://casacalda.com/team.html</loc><priority>0.7</priority></url>
  <url><loc>https://casacalda.com/projects.html</loc><priority>0.7</priority></url>
  <url><loc>https://casacalda.com/contact.html</loc><priority>0.7</priority></url>
</urlset>
```

Save as `website-static/sitemap.xml`, commit, push.

**Option B** — generate from WP dynamically at `cms.casacalda.com/sitemap.xml`, but that's more work and requires a plugin.

Go with A.

**Verify:** `curl https://casacalda.com/sitemap.xml` returns the XML, Search Console → Sitemaps shows it as "Success".

---

### 4. Install analytics

Currently zero analytics on the site — you can't measure launch traffic. Pick one:

| Option | Setup | Cost |
|---|---|---|
| **Cloudflare Web Analytics** (recommended, matches your stack) | dash.cloudflare.com → Analytics → Web Analytics → Add site → paste the beacon snippet in `<head>` of all `.html` files | Free |
| **Google Analytics 4** (if you already have a GA property) | Paste the `gtag.js` snippet from GA4 admin into `<head>` | Free |
| **Plausible** (privacy-friendly, no cookie banner needed) | Paste one-line script tag | $9/mo |

Cloudflare Web Analytics is what I'd pick — same account you already manage, no cookie banner needed, zero performance impact.

Add to every HTML file's `<head>`. Easiest: put it in a shared `<script>` block right after the meta tags.

---

### 5. Bing Webmaster Tools (quick, low priority)

Same idea as Google Search Console. https://www.bing.com/webmasters → Add site → DNS TXT verify → submit sitemap. Bing → ~2% of your traffic but takes 5 min so worth doing.

---

### 6. Sanitize the dev-leak fallback error text in `i18n.js`

`website-static/i18n.js:60-62`:

```js
err_site_load: { ka: 'საიტი ვერ ჩაიტვირთა', en: 'The site could not be loaded' },
err_wp_hint:   { ka: 'დარწმუნდი, რომ WordPress (Local) გაშვებულია.', en: 'Make sure the WordPress backend is running.' },
```

The `WordPress (Local)` string is dev-mode leftover (Local by Flywheel). Real users saw this text yesterday on iPhones during a Hostinger flap. Replace with user-facing wording:

```js
err_site_load: { ka: 'საიტი დროებით მიუწვდომელია', en: 'The site is temporarily unavailable' },
err_wp_hint:   { ka: 'გთხოვთ სცადოთ ერთი წუთის შემდეგ.', en: 'Please try again in a moment.' },
```

Bump cache-bust and push. Once Task 2 (CF cache rule) is live, visitors will basically never see this fallback anyway — but the message still shouldn't leak dev tool names.

---

### 7. Uptime monitoring — 5 min setup

https://uptimerobot.com → free tier — ping `https://casacalda.com/` every 5 min, alert to your email or Slack if it fails. Also add `https://cms.casacalda.com/?rest_route=/casacalda/v1/site` so you know if WP goes down separately.

---

## 🔧 MEDIUM — do next week

### 8. Add fetch timeout + graceful degradation in `cms.js` / `app.js`

Once Task 2 is live this becomes almost redundant. But belt-and-suspenders:

**In `cms.js`**, wrap all fetches:

```js
function ccFetch(url, opts) {
    var ctrl = new AbortController();
    var timeout = setTimeout(function () { ctrl.abort(); }, 8000);
    return fetch(url, Object.assign({ signal: ctrl.signal }, opts))
        .finally(function () { clearTimeout(timeout); });
}
```

Then replace `fetch(this.api + …)` with `ccFetch(this.api + …)` in `site()`, `page()`, `projects()`, `staff()`.

**In `app.js` `showError()`**, degrade gracefully:

```js
function showError(msg) {
    var fallbackNav = '<nav class="nav nav--scrolled"><a href="/" class="nav__logo"><img src="/assets/logo-main-white.svg" alt="Casa Calda"></a></nav>';
    var fallbackHero = '<section class="hero"><div class="hero__bg"><video src="/assets/hero-home.mp4" poster="/assets/hero-home-poster.jpg" autoplay muted loop playsinline></video></div><div class="hero__overlay"></div></section>';
    var banner = '<div style="background:#f18227;color:#fff;padding:10px;text-align:center;font-size:14px">' + msg + '</div>';
    root.innerHTML = fallbackNav + banner + fallbackHero;
}
```

Users still see the nav + hero video when WP fails, instead of a blank error page.

---

### 9. Structured data (JSON-LD) — SEO polish

Add to `index.html` `<head>`:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Casa Calda",
  "alternateName": "თბილი სახლი",
  "url": "https://casacalda.com",
  "logo": "https://casacalda.com/assets/logo-main-white.svg",
  "description": "Georgia's leading MEP (Mechanical, Electrical, Plumbing) engineering company since 2001",
  "foundingDate": "2001",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "ლუბლიანას ქუჩა N56",
    "addressLocality": "Tbilisi",
    "postalCode": "0159",
    "addressCountry": "GE"
  },
  "telephone": "+995 32 2 311 325",
  "email": "info@casacalda.ge"
}
</script>
```

Helps Google build a Knowledge Panel for Casa Calda.

---

## Cheat sheet

| What | Where |
|---|---|
| Your Cloudflare token (Toma) | Ask Giorgi (starts `cfut_EGI9…`) — Pages + DNS + Cache Rules + Cache Purge + Zone Read |
| CF account id | `4c05de69627ec8453970a2c40a3a54f9` |
| CF zone `casacalda.com` id | `a19e1a001741e382a060ba9121beb562` |
| CF zone `casacalda.ge` id | `54320e7e8491fa2d4aa6ce6244ffd2d1` |
| Hostinger account | `u168788757` |
| WP admin | https://cms.casacalda.com/wp-admin/ |
| WP install id | 29134885 |
| Static repo | https://github.com/geganoza/casacalda-website |
| CF Pages project | `casacalda-website` |
| Current cache-bust | `?v=20260662` |

## Do NOT

- **Do NOT** touch the `.hero__bg video` block in `render.js` — Giorgi supplied the hero video, changes need his sign-off.
- **Do NOT** revert the IntersectionObserver in `main.js` back to per-video observation. That regression on 2026-07-02 caused the mobile team-card blank-video bug. Section-container observation is required for mobile WebKit + horizontal scrollers. See RUNBOOK "Team videos" section.
- **Do NOT** re-add `functions/_middleware.js` — the pre-launch gate was intentionally removed at launch.
- **Do NOT** disable the CORS headers on your `casacalda/v1/` plugin — `cms.js` relies on `access-control-allow-origin: *`.

## Priority summary

Do these in order, don't skip:

1. 🚨 `robots.txt` swap (30 sec, blocks Google right now)
2. 🚨 CF Cache Rule for REST (10 min, kills WP flap impact)
3. ⚡ Google Search Console + sitemap (20 min, gets you into search)
4. ⚡ Analytics (10 min, measure launch)
5. ⚡ Bing Webmaster (5 min, easy win)
6. ⚡ Fallback error text sanitize (2 min)
7. ⚡ Uptime monitoring (5 min)
8. 🔧 Fetch timeout + graceful fallback (30 min)
9. 🔧 Structured data (10 min)

**Total: ~90 min for URGENT + HIGH, another ~40 min for MEDIUM.**

If you can't get to everything today, at minimum ship #1 and #2 — those are the two things bleeding real users right now.
