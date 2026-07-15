/* Casa Calda — page bootstrapper.
 * Reads the page slug (window.CC_PAGE or ?page=), fetches /site + /page, renders
 * nav → sections → footer with CCRender, then loads main.js so its carousels,
 * scroll reveals and counters bind to the freshly-rendered DOM. */
(function () {
	'use strict';

	/* Debug / A-B for the hero stutter. Default OFF. The frosted blur on the nav
	   pill, language switcher and ghost buttons re-blurs the PLAYING hero video
	   every frame, which stutters the hero on phones. ?fxblur=1 puts the blur back
	   (adds html.cc-fxblur — see style.css) so the difference is feelable on a real
	   device; ?fxblur=0 clears it. Persisted so it survives page navigation. */
	try {
		var _fx = new URLSearchParams(location.search).get('fxblur');
		if (_fx === '1') { localStorage.setItem('cc_fxblur', '1'); }
		else if (_fx === '0') { localStorage.removeItem('cc_fxblur'); }
		if (localStorage.getItem('cc_fxblur') === '1') { document.documentElement.classList.add('cc-fxblur'); }
	} catch (e) {}

	/* ?perf=1 — on-screen performance readout so we can SEE what's actually slow
	   on the real device instead of guessing: main-thread FPS, the worst single
	   frame time, a count of long frames, and — the key one — the hero VIDEO's
	   dropped-frame ratio (the true measure of playback smoothness; a rAF FPS
	   meter alone can read 60 while the video visibly stutters on the compositor).
	   Screenshot it after ~10s and send it over. */
	try {
		if (new URLSearchParams(location.search).get('perf') === '1') {
			var _hud = document.createElement('div');
			_hud.style.cssText = 'position:fixed;top:8px;left:8px;z-index:2147483647;background:rgba(0,0,0,.82);color:#0f0;font:600 12px/1.5 monospace;padding:7px 10px;border-radius:7px;pointer-events:none;white-space:pre;box-shadow:0 2px 10px rgba(0,0,0,.4)';
			var _mount = function () { if (document.body) { document.body.appendChild(_hud); } else { setTimeout(_mount, 50); } };
			_mount();
			var _last = performance.now(), _f = 0, _acc = 0, _worst = 0, _jank = 0, _base = null;
			var _vid = function () { return document.querySelector('.hero__bg video') || document.querySelector('.hero video') || document.querySelector('video'); };
			var _loop = function (now) {
				var dt = now - _last; _last = now; _f++; _acc += dt;
				if (dt > _worst) { _worst = dt; }
				if (dt > 50) { _jank++; }
				if (_acc >= 500) {
					var line = 'FPS ' + Math.round(_f * 1000 / _acc) + '   worst ' + Math.round(_worst) + 'ms\nlong frames >50ms: ' + _jank;
					var v = _vid();
					if (v && v.getVideoPlaybackQuality) {
						var q = v.getVideoPlaybackQuality();
						if (_base === null) { _base = q.totalVideoFrames; }
						line += '\nhero dropped: ' + q.droppedVideoFrames + ' / ' + q.totalVideoFrames;
					} else if (v && typeof v.webkitDroppedFrameCount === 'number') {
						line += '\nhero dropped: ' + v.webkitDroppedFrameCount + ' / ' + v.webkitDecodedFrameCount;
					}
					_hud.textContent = line;
					_f = 0; _acc = 0; _worst = 0;
				}
				requestAnimationFrame(_loop);
			};
			requestAnimationFrame(_loop);
		}
	} catch (e) {}

	/* UI-string translator (chrome only). Falls back to the key if i18n.js is
	   missing — but i18n.js always loads first, so this resolves to ka/en. */
	function t(k) { return (window.CC_I18N && window.CC_I18N.t) ? window.CC_I18N.t(k) : k; }

	var slug = window.CC_PAGE || (new URLSearchParams(location.search)).get('page') || 'home';
	var root = document.getElementById('cc-root') || document.body;
	if (root && root.classList) { root.classList.add('cc-page-' + slug); } // per-page CSS hook

	function setMeta(name, val) {
		if (!val) { return; }
		var m = document.querySelector('meta[name="' + name + '"]');
		if (!m) { m = document.createElement('meta'); m.setAttribute('name', name); document.head.appendChild(m); }
		m.setAttribute('content', val);
	}

	function showError(msg) {
		// Graceful degradation: instead of a blank error page, keep the brand nav
		// and hero video (both CDN-served, independent of WP) and show the message
		// in a banner. Mirrors render.js's real nav/hero markup + classes.
		var nav = '<nav class="nav" id="nav"><a href="index.html" class="nav__logo">' +
			'<img src="/assets/logo-main-white.svg" alt="Casa Calda"></a></nav>';
		var banner = '<div style="background:#f18227;color:#fff;padding:12px 16px;text-align:center;font:500 14px/1.5 sans-serif">' +
			msg + ' ' + t('err_wp_hint') + '</div>';
		var hero = '<section class="hero"><div class="hero__bg">' +
			'<video src="/assets/hero-home.mp4" poster="/assets/hero-home-poster.jpg" autoplay muted loop playsinline></video>' +
			'</div><div class="hero__overlay"></div></section>';
		root.innerHTML = nav + banner + hero;
	}

	/* Legal pages (privacy-policy.html, terms-of-use.html) are static documents —
	   they must render even if WP is down. We DON'T call CC_CMS.page(slug); both
	   KA + EN article bodies are pre-baked into the HTML file, and app.js just
	   wraps them with nav (site data if available, minimal fallback otherwise) +
	   a hero band + footer. Ships legal content instantly regardless of backend
	   health. `slug` is 'privacy' or 'terms'; i18n keys share the same prefix. */
	if (slug === 'privacy' || slug === 'terms') {
		var bakedArticles = root.innerHTML;   // both <article lang="ka"> + <article lang="en">
		var titleKey   = slug === 'privacy' ? 'privacy_title'   : 'terms_title';
		var subKey     = slug === 'privacy' ? 'privacy_updated' : 'terms_effective';
		var pageHero =
			'<section class="page-hero page-hero--legal">' +
				'<div class="page-hero__overlay"></div>' +
				'<div class="page-hero__content wrap">' +
					'<h1 class="page-hero__title">' + t(titleKey) + '</h1>' +
					'<p class="page-hero__updated">' + t(subKey) + '</p>' +
				'</div>' +
			'</section>';
		var renderLegal = function (site) {
			// nav()/footer() both tolerate an empty {} — logo + langswitch + legal
			// line always render, columns just come out empty. Good enough for a
			// legal page during a WP outage.
			var safeSite = site || {};
			document.title = t(titleKey) + ' — ' + t('brand_suffix');
			root.innerHTML =
				CCRender.nav(safeSite) +
				pageHero +
				'<main class="privacy-body wrap">' + bakedArticles + '</main>' +
				CCRender.footer(safeSite) +
				CCRender.btt();
			afterRender();
		};
		Promise.resolve(CC_CMS.site()).then(renderLegal).catch(function () { renderLegal({}); });
		return;
	}

	Promise.all([CC_CMS.site(), CC_CMS.page(slug)]).then(function (res) {
		var site = res[0], page = res[1];
		if (!site) { showError(t('err_site_load')); return; }

		if (!page) {
			root.innerHTML = CCRender.nav(site) +
				'<section class="page-hero"><div class="page-hero__overlay"></div><div class="page-hero__content wrap">' +
				'<h1 class="page-hero__title">' + t('err_page_404') + '</h1></div></section>' +
				CCRender.footer(site) + CCRender.btt();
			afterRender();
			return;
		}

		if (page.seo && page.seo.title) { document.title = page.seo.title; }
		setMeta('description', page.seo && page.seo.description);

		function build(leadHtml) {
			var html = CCRender.nav(site) + (leadHtml || '');
			(page.sections || []).forEach(function (s) { html += CCRender.section(s, site); });
			html += CCRender.footer(site) + CCRender.btt();
			root.innerHTML = html;
			afterRender();
		}

		// Single-project pages get their hero + overview from the Project entity (?slug=).
		if (page.template === 'single-project') {
			var pslug = new URLSearchParams(location.search).get('slug');
			if (pslug && CC_CMS.project) {
				CC_CMS.project(pslug).then(function (proj) {
					var lead = '';
					if (proj) { document.title = proj.name + ' — ' + t('brand_suffix'); lead = CCRender.projectHero(proj) + CCRender.projectOverview(proj) + CCRender.projectGallery(proj); }
					build(lead);
				}).catch(function () { build(''); });
			} else { build(''); }
			return;
		}

		build('');
	}).catch(function (e) { showError(t('err_prefix') + (e.message || e)); });

	function afterRender() {
		bindRibbonNav();
		bindServiceNav();
		bindContactForm();
		// Populate real staff on the About page before main.js binds its video
		// handlers, so the injected cards get the same first-frame + hover behaviour.
		loadAboutStaff(function () {
			scrollToHash();
			loadMain();
		});
	}

	function esc(s) {
		return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}

	/* The About page's custom-html body ships static placeholder team cards that
	   point at video files which don't exist (assets/videos/staff-0N.mp4). Swap
	   them for the live staff from WordPress — the same source the Team page uses.
	   No-op off the About page; a 2.5s timeout guarantees a slow/failed staff
	   fetch never blocks the rest of the page from becoming interactive. */
	function loadAboutStaff(done) {
		var wrap = slug === 'about' ? document.querySelector('#team .team__cards') : null;
		if (!wrap || !window.CC_CMS || !CC_CMS.staff) { done(); return; }
		var called = false, finish = function () { if (!called) { called = true; done(); } };
		setTimeout(finish, 2500);
		CC_CMS.staff().then(function (staff) {
			if (!staff || !staff.length) { return; }
			wrap.innerHTML = staff.map(function (m) {
				var media = m.video ? '<video src="' + esc(m.video) + '"' + (m.photo ? ' poster="' + esc(m.photo) + '"' : '') + ' muted loop playsinline preload="none"></video>'
					: (m.photo ? '<img src="' + esc(m.photo) + '" alt="' + esc(m.name) + '">' : '');
				return '<div class="team-card"><div class="team-card__img">' + media + '</div>' +
					'<div class="team-card__info"><p class="team-card__role">' + esc(m.role) + '</p>' +
					'<h3 class="team-card__name">' + esc(m.name) + '</h3>' +
					(m.bio ? '<div class="team-card__bio"><p>' + esc(m.bio) + '</p></div>' : '') +
					'</div></div>';
			}).join('');
				if (window.CC_initStaffVideos) { window.CC_initStaffVideos(wrap); }
		}).catch(function () {}).then(finish);
	}

	/* Service items (home services carousel + project page service grid) carry a
	   data-svc-anchor; clicking one jumps to that service on the services page. */
	function bindServiceNav() {
		root.addEventListener('click', function (e) {
			var el = e.target.closest ? e.target.closest('[data-svc-anchor]') : null;
			if (!el) { return; }
			var a = el.getAttribute('data-svc-anchor');
			if (a) { location.href = 'services.html#' + encodeURIComponent(a); }
		});
	}

	/* Deep-link scroll. Content renders async, so by the time the browser tries to
	   jump to location.hash (e.g. services.html#electricity) the target doesn't
	   exist yet. Re-run the jump after render, accounting for the fixed nav, and
	   again once images settle so the target lands in the right place. */
	function scrollToHash() {
		var raw = location.hash;
		if (!raw || raw.length < 2) { return; }
		var id;
		try { id = decodeURIComponent(raw.slice(1)); } catch (e) { id = raw.slice(1); }
		var el = document.getElementById(id);
		if (!el) { return; }
		function go() {
			var top = el.getBoundingClientRect().top + (window.pageYOffset || window.scrollY) - 80;
			window.scrollTo({ top: Math.max(top, 0), behavior: 'auto' });
		}
		requestAnimationFrame(function () { requestAnimationFrame(go); });
		window.addEventListener('load', go);
		setTimeout(go, 400);
	}

	function bindRibbonNav() {
		root.addEventListener('click', function (e) {
			var c = e.target.closest ? e.target.closest('.ribbon__card[data-slug]') : null;
			if (c && c.getAttribute('data-slug')) {
				location.href = 'project.html?slug=' + encodeURIComponent(c.getAttribute('data-slug'));
			}
		});
	}

	function bindContactForm() {
		var form = document.getElementById('contactForm') || document.getElementById('ccContactForm');
		if (!form || !window.CC_CMS) { return; }
		var btn = form.querySelector('button[type=submit]');
		function show(msg, ok) {
			var s = document.getElementById('formStatus') || document.getElementById('ccFormStatus');
			if (s) { s.textContent = msg; s.style.color = ok ? 'var(--orange)' : '#c0392b'; }
		}
		form.addEventListener('submit', function (e) {
			e.preventDefault();
			var data = {};
			new FormData(form).forEach(function (v, k) { data[k] = v; });
			if (!data.fname || (!data.email && !data.phone)) { show(t('form_required'), false); return; }
			var label = btn ? btn.textContent : '';
			if (btn) { btn.disabled = true; btn.textContent = t('form_sending'); }
			show('', true);
			CC_CMS.sendContact(data).then(function (r) {
				if (r && r.ok) { show(t('form_thanks'), true); form.reset(); }
				else { show(t('form_error'), false); }
			}).catch(function () { show(t('form_noconn'), false); })
				.then(function () { if (btn) { btn.disabled = false; btn.textContent = label; } });
		});
	}

	function loadMain() {
		var s = document.createElement('script');
		s.src = 'main.js?v=20260715';
		document.body.appendChild(s);
	}
})();
