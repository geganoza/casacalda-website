/* Pre-launch gate.
 *
 * Every incoming request hits this middleware before Cloudflare Pages serves
 * the static asset. Visitors without the bypass cookie are sent to
 * /coming-soon.html. The bypass is granted by visiting any URL with
 * ?preview=<token> — the middleware sets a 1-year cookie and redirects to the
 * clean URL, so subsequent visits from that browser see the real site without
 * the token in the URL bar.
 *
 * To TURN THE GATE OFF (at launch): delete this file. Pages resumes normal
 * static serving on the next deploy.
 *
 * To ROTATE THE TOKEN: change PREVIEW_TOKEN below, commit, push. Existing
 * holders of the old link keep working until their cookie expires (1 year)
 * or they clear cookies — to force-revoke, also change BYPASS_COOKIE name.
 */

const PREVIEW_TOKEN = 'casa-prelaunch-0f81db5d';
const BYPASS_COOKIE = 'cc_preview';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/* Paths the gate lets through unconditionally so /coming-soon.html itself
   can load + so visitors don't see broken images on the gate page. Both
   /coming-soon and /coming-soon.html are listed because Cloudflare Pages'
   "pretty URLs" strips the .html extension. */
const PASSTHROUGH_PATHS = new Set(['/coming-soon', '/coming-soon.html', '/robots.txt']);
const PASSTHROUGH_PREFIXES = ['/assets/', '/favicon'];
const PASSTHROUGH_EXTS = ['.css', '.js', '.svg', '.woff2', '.woff', '.ttf', '.ico', '.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4'];

function hasBypass(request) {
    const raw = request.headers.get('Cookie') || '';
    return raw.split(';').some(c => {
        const [name, value] = c.trim().split('=');
        return name === BYPASS_COOKIE && value === '1';
    });
}

function isPassthroughPath(pathname) {
    if (PASSTHROUGH_PATHS.has(pathname)) return true;
    if (PASSTHROUGH_PREFIXES.some(p => pathname.startsWith(p))) return true;
    return PASSTHROUGH_EXTS.some(ext => pathname.endsWith(ext));
}

export async function onRequest(context) {
    const { request, next } = context;
    const url = new URL(request.url);

    /* 1. Holder of the preview link → already-marked browser, pass straight to the real site. */
    if (hasBypass(request)) {
        return next();
    }

    /* 2. Visiting with ?preview=<token> → mark the browser, redirect to clean URL. */
    if (url.searchParams.get('preview') === PREVIEW_TOKEN) {
        url.searchParams.delete('preview');
        const target = url.pathname + (url.search ? url.search : '') + url.hash;
        return new Response(null, {
            status: 302,
            headers: {
                'Location': target || '/',
                'Set-Cookie': `${BYPASS_COOKIE}=1; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; Secure`,
                'Cache-Control': 'no-store',
            },
        });
    }

    /* 3. Asset request for the coming-soon page itself → let through so the page renders. */
    if (isPassthroughPath(url.pathname)) {
        return next();
    }

    /* 4. Everyone else → bounce to /coming-soon.html.
       302 (temporary) so search engines don't cache the redirect. */
    return Response.redirect(new URL('/coming-soon.html', request.url).toString(), 302);
}
