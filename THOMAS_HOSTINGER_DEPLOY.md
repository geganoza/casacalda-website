# Thomas — WordPress deployment to Hostinger

**Goal:** Get a ready-made WordPress site live on Hostinger, served at `casacalda.com`.

## Where things stand right now (2026-06-22)

| Asset | Status |
|---|---|
| **casacalda.com** registrar | GoDaddy. Giorgi owns it. Nameservers already moved to Cloudflare ✅ |
| **casacalda.com DNS** | Cloudflare zone `a19e1a001741e382a060ba9121beb562`. Status: **active**. |
| **Current DNS records on casacalda.com** | Points at **GitHub Pages** (`185.199.108-111.153`). When you flip to Hostinger, these must change. |
| **Hostinger plan** | Business plan, Paris DC, expires 2028-06-05, has **1 free slot left** (currently only `casacalda.ge` is on it). |
| **GitHub repo (this one)** | `geganoza/casacalda-website`. Master = static site Giorgi + I built. Your `thom` branch has the WP-integration work. |
| **Old `casacalda.ge`** | Untouched. Leave alone. |

---

## Architecture decision

Two reasonable layouts. Pick one before deploying:

**A. Full WordPress at casacalda.com (simplest)**
- Hostinger serves WP at `casacalda.com`
- The static site (master branch / GitHub Pages) becomes a design reference, not the live site
- DNS: A records → Hostinger IP `72.60.93.156`

**B. Headless: static frontend at casacalda.com, WP backend at cms.casacalda.com (your `thom` branch architecture)**
- GitHub Pages serves the static site at `casacalda.com` (current setup, no change)
- Hostinger serves WP admin + REST API at `cms.casacalda.com`
- The static site fetches projects/team/services from `cms.casacalda.com/wp-json/...`
- DNS: keep current A records as-is, ADD an A record for `cms` → Hostinger IP

**Recommendation:** Option B — it matches what you already built on `thom`. If you'd rather just ship WP and worry about the headless wiring later, go A.

---

## Option A steps — Full WP at casacalda.com

### 1. Add the website to Hostinger
1. Sign in: https://hpanel.hostinger.com
2. Hosting → "Add website" → "Existing domain" → enter `casacalda.com`
3. Hostinger will create directory `/home/u168788757/domains/casacalda.com/public_html/`
4. **Do NOT change nameservers when prompted** — they already point to Cloudflare. Just confirm the website slot is created.

### 2. Upload the ready-made WordPress site
Pick whichever export format you have:

**If you have an All-in-One WP Migration `.wpress` file:**
1. hPanel → Websites → casacalda.com → "Auto Installer" → install fresh WordPress (any temp admin user/pw — you'll overwrite).
2. WP admin → Plugins → install "All-in-One WP Migration" → Import → upload your `.wpress` file.
3. After import, log in with the original site's credentials.

**If you have a Duplicator `.zip` + installer.php:**
1. Use Hostinger's File Manager (or FTP) to upload both to `/public_html/`
2. Browse to `https://casacalda.com/installer.php` (after DNS step 3 below; until DNS, use the Hostinger temp URL from hPanel)
3. Follow the wizard — Hostinger MCP / hPanel can create the MySQL DB and user (Database → MySQL Databases).

**If you have raw files + SQL dump:**
1. File Manager: upload site files to `/public_html/`
2. hPanel → Databases → MySQL → create db + user, note credentials
3. phpMyAdmin → import SQL dump
4. Edit `wp-config.php` with the new db creds
5. Fix `siteurl` and `home` rows in `wp_options` to `https://casacalda.com`

### 3. Repoint casacalda.com DNS at Hostinger
Currently DNS sends visitors to GitHub Pages. We need to change it. Either:
- **Ping Giorgi or Claude** to run the Cloudflare API calls (we have the token in `.env`), OR
- Do it yourself in the Cloudflare dashboard:
  1. dash.cloudflare.com → casacalda.com → DNS → Records
  2. Delete the 4 A records pointing at `185.199.x.153`
  3. Delete the 4 AAAA records pointing at `2606:50c0:800x::153`
  4. Add A record: name `@`, content `72.60.93.156`, proxy status **Proxied** (orange cloud)
  5. Edit CNAME `www` → keep as is (it already points at `geganoza.github.io` but now would 404, so either delete it or repoint to `casacalda.com`)
  6. **Cloudflare SSL mode: change from `Full` → `Flexible`** for the first ~30 min so Hostinger can issue its Let's Encrypt cert without redirect loops. Once Hostinger SSL is live, flip back to `Full`.

### 4. Issue SSL cert on Hostinger
hPanel → casacalda.com → SSL → install free Let's Encrypt. Once active, set Cloudflare SSL = `Full`.

### 5. Verify
- `https://casacalda.com` loads the WP site
- `https://www.casacalda.com` redirects to root (configure in WP General Settings)
- HTTPS padlock works
- WP admin at `https://casacalda.com/wp-admin/`

---

## Option B steps — Headless: WP at cms.casacalda.com, static stays at casacalda.com

### 1. Add subdomain in Hostinger
1. hPanel → Domains → Subdomains
2. Create `cms.casacalda.com` under the existing account
3. Hostinger creates `/home/u168788757/domains/casacalda.com/public_html/cms/` (or similar)

### 2. Upload WordPress (same as Option A step 2, but to the subdomain root)

### 3. Add DNS for the subdomain (don't touch the existing A records!)
- In Cloudflare DNS → Add record:
  - Type **A**, name `cms`, content `72.60.93.156`, proxy **Proxied** (orange).
- Done. The existing root casacalda.com records stay pointing at GitHub Pages.

### 4. Issue SSL for cms.casacalda.com on Hostinger (same as Option A step 4)

### 5. Configure WP to allow REST API from the static site
- WP admin → Settings → Permalinks → make sure "Post name" is selected (so REST API works clean)
- Install **WP CORS** plugin if the static frontend gets CORS errors when fetching
- Allow origin: `https://casacalda.com` (and `https://geganoza.github.io` for the GH Pages preview URL)

### 6. Point the static site's `cms.js` at the new WP base URL
- In the `thom` branch, find wherever `cms.js` defines the WP base URL
- Change it to `https://cms.casacalda.com`
- Commit + push → GitHub Pages rebuilds

---

## Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| WP shows "redirect loop" after SSL setup | Cloudflare SSL = Flexible but Hostinger already has cert + WP forces HTTPS | Switch Cloudflare to `Full` |
| `mixed content` errors in browser console | DB has hardcoded `http://` URLs | WP admin → Tools → Site Health, or use Better Search Replace plugin to swap `http://oldsite.com` → `https://casacalda.com` everywhere in DB |
| CORS errors from static frontend | WP not allowing cross-origin requests | Install `WP CORS` plugin or add headers in `.htaccess` |
| DNS still showing old IPs after 1 hour | Cloudflare proxy cache | Cloudflare → Caching → "Purge Everything" |
| Can't log in after import | Cookie domain mismatch | In `wp-config.php`: `define('COOKIE_DOMAIN', '');` |
| Images broken after migration | Old absolute URLs in DB | Better Search Replace plugin: `oldsite.com` → `casacalda.com` |

---

## Before you start — sync this branch

You're working on `thom`. Master now has a `CNAME` file I added (for GitHub Pages custom-domain config). Pull it before merging:

```bash
git fetch origin
git checkout thom
git rebase origin/master   # or: git merge origin/master
git push --force-with-lease origin thom
```

---

## When you're done

- Send Giorgi (or post here) the URL where you finish so we can verify
- If anything's blocked: comment on this file with the issue, push the comment, ping Giorgi/Claude
- If you change Cloudflare DNS yourself, also update this file with the new state so we don't get confused

---

## Credentials & access you should already have

- GitHub: collaborator on `geganoza/casacalda-website` (write) — invitation should be in your inbox or notifications if you haven't accepted yet
- Hostinger hPanel: ask Giorgi for the login (or he can add you as a "Manage access" sub-user)
- Cloudflare dashboard: ask Giorgi (account is under `D.baliashvili@itcraft.ge`)
