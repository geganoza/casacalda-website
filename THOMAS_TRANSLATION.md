# Thomas — translation tooling for the site

**Goal:** ship the website in **Georgian + English** with minimum maintenance burden.

## What we already have

### 1. TranslatePress on `casacalda.ge` (old WP)
- Already installed and active on the old WP.
- Detected today via CSS handle `trp-language-switcher-style-css` and plugin path
  `/wp-content/plugins/translatepress-multilingual/`.
- TranslatePress is the **agreed translation tool** for this project — don't swap it out for WPML/Polylang/Weglot without a reason.
- Admin path: `/wp-admin/options-general.php?page=trp_translation_settings`.

### 2. Nothing on the new headless WP / static frontend yet
- `cms.js` and `app.js` have no `lang`, `locale`, or `i18n` logic.
- No second-language version of `coming-soon.html`.
- This is what needs building.

---

## The two real paths

### Path A — Install TranslatePress on the new WP backend, expose via REST

This matches the existing setup and reuses the team's TranslatePress knowledge.

1. **On the WP backend** (wherever the headless backend is hosted — Hostinger):
   1. Plugins → Add new → search "TranslatePress" → install + activate (free version supports 2 langs).
   2. Settings → TranslatePress → set **Default = Georgian (ka)**, add **English (en)**.
   3. *Optional but recommended:* install `TranslatePress — REST API` companion (or use the [TranslatePress Developer Add-on](https://translatepress.com/docs/developers/)). Translations need to come out of `/wp-json/...` for the static frontend to read them.
   4. Open the **TranslatePress Visual Editor** (top admin bar → "Translate Site"). Click any text on the live preview, paste the English, save. Repeat per string.
2. **On the static frontend** (`cms.js`):
   - Detect the user's language: read `?lang=en` query param OR `localStorage.cc_lang` OR `navigator.language.startsWith('en')`.
   - Pass `?lang=en` (or whatever TranslatePress expects — usually `?trp-edit-translation=preview&lang=en_US` or set via URL prefix `/en/`) when fetching from `/wp-json/wp/v2/...`.
   - The REST responses come back already translated by TranslatePress.
3. **On the static frontend** (HTML pages):
   - Add a language switcher in the nav (`ka` / `en` toggle).
   - On click → set `localStorage.cc_lang`, reload.

**Pros:** single source of truth (the WP DB), translators use the same Visual Editor they already know, no duplicate HTML files.
**Cons:** depends on TranslatePress REST behavior — verify it returns translated REST output (some configs only translate the front-end, not REST).

### Path B — Duplicate static pages per language (no CMS dependency)

Faster for small/static pages like `coming-soon.html` where there's no WP fetch.

1. Create `coming-soon-en.html` next to `coming-soon.html`. Same layout, English copy.
2. Add a small language toggle (two pills, top-right of the page).
3. Each page links to the other for the toggle.

**Pros:** zero CMS dependency, ship in 10 minutes, easy to review the actual English copy.
**Cons:** doesn't scale to dozens of pages; manual sync if the original changes.

**Recommendation:** Path B for `coming-soon.html` (it's a holding page, ships in minutes). Path A for the real site once the headless setup is stable.

---

## What's actually translated where (current state)

| Surface | Languages today | Tool | Notes |
|---|---|---|---|
| `casacalda.ge` (old WP) | GE + EN (assumed) | TranslatePress | Check `/wp-admin/options-general.php?page=trp_translation_settings` to confirm EN is published |
| `casacalda.com` (new WP backend) | GE only | none yet | Install TranslatePress when ready |
| `coming-soon.html` (this repo) | GE only | none | Make `coming-soon-en.html` as a quick win |
| `index.html` / static pages | GE only (content fetched from WP) | none on frontend | Wire `?lang=` query to WP REST |

---

## URL strategy for multilingual

TranslatePress defaults to either:
- **Subfolder:** `casacalda.com/` (GE) + `casacalda.com/en/` (EN) — recommended, SEO-friendly
- **Query param:** `casacalda.com/?lang=en` — simpler, less SEO

Pick subfolder unless there's a reason not to. For the static repo, two coming-soon files = `coming-soon.html` + `coming-soon-en.html` (no subfolder gymnastics needed for one page).

---

## Translation source-of-truth for new content

When Giorgi writes new Georgian copy:
1. Author in GE in the WP Visual Editor.
2. Add EN translation in the same Editor (right pane).
3. Save. Both languages publish.

For the static `coming-soon-en.html` only: hand-translate or paste from a translation tool, then commit. Don't drift — when copy changes in GE, update EN in the same commit.

---

## Quick wins Thomas can do in 30 minutes

1. Confirm TranslatePress is enabled on `casacalda.ge` and EN is actually published. (Check `casacalda.ge/en/` in a browser.)
2. Install TranslatePress on the new WP backend if not already there.
3. Create `coming-soon-en.html` for the holding page (ask Claude to translate the existing Georgian — Giorgi has a Gemini-based Georgian tool he uses for that).
4. Add a tiny language toggle to both `coming-soon.html` and `coming-soon-en.html`.

Ping Giorgi/Claude when stuck. Don't burn time blocked.

---

Related repo files:
- `THOMAS_HOSTINGER_DEPLOY.md` — deployment guide
- `coming-soon.html` — current GE-only holding page
- `cms.js`, `app.js` — headless frontend (no i18n yet)
