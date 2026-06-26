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

	function setMeta(name, val) {
		if (!val) { return; }
		var m = document.querySelector('meta[name="' + name + '"]');
		if (!m) { m = document.createElement('meta'); m.setAttribute('name', name); document.head.appendChild(m); }
		m.setAttribute('content', val);
	}

	function showError(msg) {
		root.innerHTML = '<div style="min-height:70vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:40px;color:#555;font-family:sans-serif">' +
			'<div><h2>' + msg + '</h2><p>' + t('err_wp_hint') + '</p></div></div>';
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
					if (proj) { document.title = proj.name + ' — ' + t('brand_suffix'); lead = CCRender.projectHero(proj) + CCRender.projectOverview(proj); }
					build(lead);
				}).catch(function () { build(''); });
			} else { build(''); }
			return;
		}

		build('');
	}).catch(function (e) { showError(t('err_prefix') + (e.message || e)); });

	function afterRender() {
		bindRibbonNav();
		bindContactForm();
		loadMain();
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
		s.src = 'main.js?v=20260640';
		document.body.appendChild(s);
	}
})();
