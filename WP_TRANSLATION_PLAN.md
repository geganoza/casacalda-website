# Casa Calda — WordPress translation plan (Track 2)

**For:** Thomas (WP backend) · **Audience:** whoever owns `cms.casacalda.com`
**Status:** plan — not yet implemented · **Last updated:** 2026-06-26

This is the **content** half of the bilingual rollout. The **frontend** half
(Track 1) is already done and live — see "What's already done on the frontend"
below. This doc says how the WordPress side delivers English so the frontend's
`?lang=en` requests actually return English content.

> **This supersedes the TranslatePress lean in `THOMAS_TRANSLATION.md`.**
> That doc assumed a normal rendered WP front-end. We went **headless** — all
> content is delivered as custom JSON from the `casacalda/v1` REST plugin, which
> TranslatePress does **not** translate out of the box (it rewrites rendered
> HTML/gettext, not a custom plugin's JSON payload). See "Why not TranslatePress".

---

## What's already done on the frontend (Track 1)

The static frontend is bilingual-ready and deployed:

- **`i18n.js`** translates all hardcoded UI chrome (form labels, project spec
  labels — Client/Category/Area/Year/Status, buttons, status messages). Georgian
  default, English available.
- **Language switcher** (KA / EN pills) in the nav, plus a toggle on
  `coming-soon.html`. Writes `localStorage.cc_lang`.
- **`cms.js` already appends `&lang=en`** to every WP REST call when the visitor
  picks English:
  - `/?rest_route=/casacalda/v1/site&lang=en`
  - `/?rest_route=/casacalda/v1/page&slug=…&lang=en`
  - `/?rest_route=/wp/v2/projects&…&lang=en`
  - single project: `/?rest_route=/wp/v2/projects&slug=…&lang=en`
- `?lang=en` is also honored as a URL param (shareable deep-link) and reflected
  on `<html lang>`.

**Net effect today:** when a visitor switches to English, the chrome flips to
English immediately, but **content stays Georgian** because WP ignores the
`lang` param. The moment WP honors `lang=en` (this plan), content flips too —
**no further frontend work needed.**

---

## The mechanism: a `lang` param in the custom plugin + EN fields

Two pieces: (1) store English values in WP, (2) make the plugin return them when
`?lang=en` is present, falling back to Georgian per-field.

### 1. Storing English content

Pick whichever matches how the plugin currently reads fields. In rough order of
preference:

- **A. Parallel meta/ACF fields with an `_en` suffix** (recommended).
  For every translatable meta key the plugin reads (e.g. `cc_overview`), add
  `cc_overview_en`. Editors fill the English in a second field. Lowest-magic,
  fully under the plugin's control, trivial fallback.
- **B. A repeater/group "translations" sub-object** keyed by locale, if the
  content model is ACF-heavy and you'd rather not double every field.
- **C. WPML / Polylang "duplicate post per language."** Heavier; the plugin would
  resolve the EN post by `lang`. Only worth it if the team already runs one of
  these elsewhere. (TranslatePress is **not** in this list — see below.)

Whichever is chosen, the rule is the same: **English is optional per field, and
any missing English falls back to Georgian** so a half-translated site never
shows blanks.

### 2. Plugin changes (per endpoint)

In the `casacalda/v1` plugin (the PHP that builds the `site`, `page`, `contact`
payloads and the `cc` projection on `wp/v2/projects`):

```php
// near the top of each REST callback
$lang = isset($_GET['lang']) && $_GET['lang'] === 'en' ? 'en' : 'ka';

// a tiny helper used everywhere a translatable string is emitted
function cc_t($post_id, $key, $lang) {
    if ($lang === 'en') {
        $en = get_post_meta($post_id, $key . '_en', true); // option A
        if ($en !== '' && $en !== null) return $en;
    }
    return get_post_meta($post_id, $key, true); // Georgian fallback
}
```

Then thread `$lang` through:

- **`/casacalda/v1/site`** — `nav.links[].label`, `nav.cta.label`, `footer.cols[].title`,
  `footer.cols[].links[].label`, `footer.brand_text`, `footer.contacts.*`,
  `footer.copy`, and `contact.services[]` (the form's service dropdown options).
- **`/casacalda/v1/page`** — every section's translatable `data` field. The big
  ones by section type: `hero` (eyebrow/title), `statement` (text),
  `services`/`service-grid`/`service-detail` (name/short/body/features),
  `stats` (label/suffix), `about-split` (eyebrow/title/lead/body/values[]),
  `cta-band` (title/desc/button_label), `contact` (title/intro/form_title/…),
  `timeline`, `feature-grid`, `process`, `rich-text`, `page-hero`.
- **`wp/v2/projects` `cc` projection** — `name`, `tag`, `category`, `client`,
  `area`(unit text), `status`, `duration`, `location`, `overview`,
  `overview_heading`.
- **`/casacalda/v1/contact` (POST)** — the auto-reply/notification email copy, if
  any is hardcoded Georgian.

> The frontend already escapes/handles whatever comes back, and the chrome labels
> around this content are translated client-side, so the plugin only needs to
> return the **content strings** in the requested language.

### 3. SEO `seo.title` / `seo.description`

These drive `<title>` and `<meta description>`. Return the EN variants under
`lang=en` so English pages get English titles. (Until then, English visitors see
Georgian titles — acceptable but not ideal.)

---

## Content to translate (inventory)

Most of this English already exists in `reference/` (the Sept 2025 presentation
is bilingual-ready) — reuse it, don't re-translate from scratch.

| Surface | Source of English copy |
|---|---|
| Nav, footer, CTA labels | short, write directly |
| 6 service divisions (name + short + detail) | presentation PDF + memory |
| Project entries (name, category, client, area, status, overview) | presentation has landmark projects in EN |
| Team roles + bios | needs client input |
| Home/About/Services/Contact page sections | reuse strategy + presentation copy |
| Contact form service options | mirror the services list |

Workflow for net-new Georgian→English: draft in English (the source material is
already English-first). Georgian→English does **not** need the `ka` Gemini tool —
that tool is for producing *Georgian*.

---

## Why not TranslatePress (the change from the old plan)

`THOMAS_TRANSLATION.md` leaned TranslatePress because it was already on the old
`casacalda.ge`. But:

1. **It translates rendered HTML, not custom REST JSON.** The new site is
   headless — the browser gets JSON from `casacalda/v1`, never a WP-rendered page.
   TranslatePress's gettext/DOM layer never runs on that path.
2. Making it work would require the Developer Add-on **plus** custom hooks to
   translate each JSON field — i.e. you'd write roughly the same per-field code as
   Option A above, but with an extra paid dependency and fuzzier fallback.
3. A native `lang` param gives **deterministic per-field fallback** and keeps the
   content model owned by the plugin we already maintain.

REST probe on 2026-06-26 confirmed the current state: namespaces are
`oembed/1.0, casacalda/v1, wp/v2, …` — **no `trp` / WPML namespace**, and the
`site` payload comes back 100% Georgian with no `lang` awareness.

If the team still wants TranslatePress for the *old* site or for a future
non-headless surface, fine — it just isn't the tool for this JSON API.

---

## Rollout order

1. Add EN storage (Option A fields) for the **site shell first** (nav/footer/cta)
   — smallest, highest-visibility win, makes the EN switch feel real.
2. Add `lang` handling to `/casacalda/v1/site`. Test:
   `curl 'https://cms.casacalda.com/?rest_route=/casacalda/v1/site&lang=en'`
   → nav labels come back English, untranslated fields still Georgian.
3. Repeat for `/page` (home first), then `wp/v2/projects`, then remaining pages.
4. Translate content surface by surface; each field falls back to Georgian until
   filled, so you can ship incrementally with no broken states.
5. Add `hreflang` tags / per-language `seo` once content is mostly covered.

## Testing checklist

- [ ] `…/site&lang=en` returns English nav/footer where translated, Georgian elsewhere.
- [ ] `…/site` (no param) is byte-for-byte the current Georgian (no regressions).
- [ ] A page with **no** English filled in still renders fully (Georgian fallback).
- [ ] Frontend: switch to EN → chrome **and** translated content both flip; refresh persists; `?lang=en` deep-link works.

---

Related: `THOMAS_TRANSLATION.md` (original strategy, partly superseded here),
`RUNBOOK.md` (stack + deploy), `i18n.js` / `cms.js` (the frontend side).
