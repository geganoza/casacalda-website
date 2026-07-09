/* Casa Calda — page bootstrapper.
 * Reads the page slug (window.CC_PAGE or ?page=), fetches /site + /page, renders
 * nav → sections → footer with CCRender, then loads main.js so its carousels,
 * scroll reveals and counters bind to the freshly-rendered DOM. */
(function () {
	'use strict';

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

	/* Privacy Policy is a legal document — it must render even if WP is down.
	   We DON'T call CC_CMS.page(slug) for it; both KA + EN article bodies are
	   pre-baked into privacy-policy.html and app.js just wraps them with nav
	   (site data if available, minimal fallback otherwise) + a hero band +
	   footer. Ships legal content instantly regardless of backend health. */
	if (slug === 'privacy') {
		var bakedArticles = root.innerHTML;   // both <article lang="ka"> + <article lang="en">
		var pageHero =
			'<section class="page-hero page-hero--legal">' +
				'<div class="page-hero__overlay"></div>' +
				'<div class="page-hero__content wrap">' +
					'<h1 class="page-hero__title">' + t('privacy_title') + '</h1>' +
					'<p class="page-hero__updated">' + t('privacy_updated') + '</p>' +
				'</div>' +
			'</section>';
		Promise.resolve(CC_CMS.site()).then(function (site) {
			// nav()/footer() both tolerate an empty {} — logo + langswitch + legal
			// line always render, columns just come out empty. Good enough for a
			// legal page during a WP outage.
			var safeSite = site || {};
			document.title = t('privacy_title') + ' — ' + t('brand_suffix');
			root.innerHTML =
				CCRender.nav(safeSite) +
				pageHero +
				'<main class="privacy-body wrap">' + bakedArticles + '</main>' +
				CCRender.footer(safeSite) +
				CCRender.btt();
			afterRender();
		}).catch(function () {
			var safeSite = {};
			root.innerHTML =
				CCRender.nav(safeSite) +
				pageHero +
				'<main class="privacy-body wrap">' + bakedArticles + '</main>' +
				CCRender.footer(safeSite) +
				CCRender.btt();
			afterRender();
		});
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
				var media = m.video ? '<video src="' + esc(m.video) + '" muted loop playsinline preload="metadata"></video>'
					: (m.photo ? '<img src="' + esc(m.photo) + '" alt="' + esc(m.name) + '">' : '');
				return '<div class="team-card"><div class="team-card__img">' + media + '</div>' +
					'<div class="team-card__info"><p class="team-card__role">' + esc(m.role) + '</p>' +
					'<h3 class="team-card__name">' + esc(m.name) + '</h3>' +
					(m.bio ? '<div class="team-card__bio"><p>' + esc(m.bio) + '</p></div>' : '') +
					'</div></div>';
			}).join('');
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
		s.src = 'main.js?v=20260663';
		document.body.appendChild(s);
	}
})();
