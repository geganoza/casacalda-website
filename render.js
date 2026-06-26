/* Casa Calda — section renderer.
 *
 * One template per section type, producing the SAME markup the existing
 * style.css and main.js expect, so the design and all interactions keep working.
 * Section field values come from /casacalda/v1/page (media already resolved to
 * {url,type}, entity sources expanded to .items). window.CCRender is consumed by app.js.
 *
 * Homepage types (hero, statement, services, stats, projects, about-split, team,
 * cta-band, footer, nav) mirror index.html exactly. Inner-page types
 * (page-hero, partners, timeline, feature-grid, contact) are close reconstructions
 * refined as each page is wired. */
(function () {
	'use strict';

	/* UI-string translator (chrome only — CMS content is translated WP-side).
	   Falls back to the Georgian default if i18n.js is missing or a key is
	   absent, so Georgian rendering can never break. */
	function t(k) { return (window.CC_I18N && window.CC_I18N.t) ? window.CC_I18N.t(k) : k; }

	/* Frontend overrides for content still pending sync in WordPress.
	   Georgian Mkhedruli codepoints cannot appear in URLs/attribute names, so the
	   replace is safe to run on every string that flows through esc(). */
	var TEXT_OVERRIDES = [
		/* Sentence-level overrides run first; they may contain words that the
		   word-level rules below would otherwise rewrite. */
		{ from: /უმაღლესი ხარისხის (ექსპერტიზა|კომპეტენცია|სერვისი) ჩვენთვის სტანდარტი არ არის — ეს ჩვენი ყოველდღიური საქმეა\./g,
		  to: 'უმაღლესი ხარისხის სერვისი ჩვენი ყოველდღიურობაა' },
		{ from: /უკვე მრავალი წელია რაც ჩვენი მომსახურებით,?\s*ჩვენ ვუქმნით ჯანსაღ და კომფორტულ გარემოს,?\s*ჩვენს მომხმარებლებს\.?/g,
		  to: 'ჩვენი სიძლიერე ჩვენს პროფესიონალებით დაკომპლექტებულ, მოტივირებულ გუნდშია' },
		{ from: /ჩვენ ვგემავთ და ვაშენებთ[\s\n]+თქვენს სიმყუდროვეს\.?/g,
		  to: 'გაიმარტივეთ ცხოვრება თბილ სახლთან ერთად' },
		{ from: /სრული ელექტრო\s*სისტემების დაპროექტება და მონტაჟი საცხოვრებელი და კომერციული ობიექტებისთვის\.?/g,
		  to: 'სრული ელექტროსისტემების დაბრუნება და მონტაჟი ნებისმიერი სირთულის ობიექტისთვის.' },
		/* Polite/plural-form CTAs and copy (informal შენ form → formal თქვენ).
		   Per user's global instruction; converted via the `ka` Gemini tool. */
		{ from: /გამოგვიგზავნე შეტყობინება/g, to: 'გამოგვიგზავნეთ შეტყობინება' },
		{ from: /მზად ხარ ჩვენთან თანამშრომლობისთვის\?/g, to: 'მზად ხართ ჩვენთან თანამშრომლობისთვის?' },
		{ from: /შეავსე ფორმა და გამოგვიგზავნე შენი CV/g, to: 'შეავსეთ ფორმა და გამოგვიგზავნეთ თქვენი CV' },
		{ from: /შეავსე ფორმა და ჩვენ დაგიკავშირდებით უმოკლეს ვადაში/g,
		  to: 'შეავსეთ ფორმა და ჩვენ დაგიკავშირდებით უმოკლეს ვადაში' },
		{ from: /გაიმარტივე ცხოვ?ერება თბილ სახლთან ერთად/g,
		  to: 'გაიმარტივეთ ცხოვრება თბილ სახლთან ერთად' },
		{ from: /ჩვენი ძალა ჩვენს ადამიანებშია\.?/g,
		  to: 'ჩვენი ძალა ჩვენს გუნდშია!' },
		/* Address override — old Vazha-Pshavela 6/0186 was wrong (different
		   district). Correct HQ per BIA.ge + Yell.ge (high confidence): Lubliana 56. */
		{ from: /საქართველო, თბილისი/g, to: 'საქართველო, თბილისი' },
		{ from: /0186,?\s*ვაჟა-ფშაველას 6/g, to: '0159, ლუბლიანას ქუჩა N56' },
		{ from: /ვაჟა-ფშაველას 6/g, to: 'ლუბლიანას ქუჩა N56' },
		/* Word-level rules. */
		{ from: /ექსპერტიზა/g, to: 'კომპეტენცია' },
		{ from: /სპეციალიზაცია/g, to: 'კომპეტენცია' },
		{ from: /ჩვენი სამუშაოები/g, to: 'ჩვენი ნამუშევრები' },
		{ from: /ჩვენი ხალხი/g, to: 'ჩვენი გუნდი' },
		/* Re-replace: 'ტექნიკური ექსპერტიზა' should keep ექსპერტიზა (the previous
		   global rule would have turned it into 'ტექნიკური კომპეტენცია'). */
		{ from: /ტექნიკური კომპეტენცია/g, to: 'ტექნიკური ექსპერტიზა' },
		{ from: /პორტფოლიო/g, to: 'ჩვენი' },
		{ from: /ვუზრუნველყოფთ/g, to: 'უზრუნველვყოფთ' },
		/* Standalone CTA button text: 'დაგვიკავშირდი' (singular imperative) →
		   'დაგვიკავშირდით' (plural). Negative lookahead avoids matching when
		   followed by another Georgian letter (so we don't corrupt longer
		   conjugations like დაგვიკავშირდით or დაგვიკავშირდება etc.). */
		{ from: /დაგვიკავშირდი(?![ა-ჰ])/g, to: 'დაგვიკავშირდით' }
	];
	var LOGO_OVERRIDE = '/assets/logo-main-white.svg';
	var FOOTER_LOGO_OVERRIDE = '/assets/union.svg';

	function applyOverrides(s) {
		var out = String(s == null ? '' : s);
		for (var i = 0; i < TEXT_OVERRIDES.length; i++) {
			out = out.replace(TEXT_OVERRIDES[i].from, TEXT_OVERRIDES[i].to);
		}
		return out;
	}
	function esc(s) {
		return applyOverrides(s).replace(/[&<>"']/g, function (c) {
			return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
		});
	}
	function txt(s) { return applyOverrides(s); }
	function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
	function url(m) { return (m && m.url) ? m.url : ''; }
	function isVid(m) { return !!(m && m.type === 'video'); }

	/* Find a service's anchor by display name — used to link the home service
	   cards and project feature-grid items to services.html#<anchor>. '' if none. */
	function serviceAnchorByName(site, name) {
		var svcs = (site && site.services) || [];
		var n = String(name == null ? '' : name).trim();
		for (var i = 0; i < svcs.length; i++) {
			if (String(svcs[i].name == null ? '' : svcs[i].name).trim() === n) {
				return svcs[i].anchor || svcs[i].slug || '';
			}
		}
		return '';
	}

	function mediaTag(m, opts) {
		opts = opts || {};
		if (!m || !m.url) { return ''; }
		var cls = opts.cls ? ' class="' + opts.cls + '"' : '';
		if (isVid(m)) {
			var auto = opts.noAuto ? '' : ' autoplay';
			return '<video src="' + esc(m.url) + '"' + cls + auto + ' muted loop playsinline></video>';
		}
		return '<img src="' + esc(m.url) + '"' + cls + ' alt="' + esc(opts.alt || m.alt || '') + '"' + (opts.lazy ? ' loading="lazy"' : '') + '>';
	}

	var SVG_PREV = '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>';
	var SVG_NEXT = '<svg viewBox="0 0 24 24"><path d="M9 18l6-6-6-6"/></svg>';

	function btnPill(a) {
		var cls = 'btn-pill btn-pill--' + (a.style === 'ghost' ? 'ghost' : (a.style === 'orange' ? 'white' : 'white'));
		return '<a href="' + esc(a.href || '#') + '" class="' + cls + '">' + esc(a.label) + '</a>';
	}

	/* ---------------- NAV / FOOTER / BTT ---------------- */

	function langSwitcher() {
		var cur = 'ka';
		try { cur = localStorage.getItem('cc_lang') || 'ka'; } catch (e) {}
		function btn(code, label) {
			var active = (cur === code) ? ' lang-switcher__btn--active' : '';
			return '<button type="button" class="lang-switcher__btn' + active +
				'" data-cc-lang="' + code + '" aria-label="' + esc(label === 'KA' ? 'ქართული' : 'English') +
				'"' + (cur === code ? ' aria-current="true"' : '') + '>' + label + '</button>';
		}
		return '<div class="lang-switcher" role="group" aria-label="Language">' +
			btn('ka', 'KA') + btn('en', 'EN') +
			'</div>';
	}

	function nav(site) {
		var brand = Object.assign({}, site.brand || {}, { logo_light: LOGO_OVERRIDE });
		var n = site.nav || { links: [], cta: {} };
		var links = (n.links || []).map(function (l) { return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>'; }).join('');
		var logo = brand.logo_light ? '<img src="' + esc(brand.logo_light) + '" alt="Casa Calda">' : 'Casa Calda';
		var ls = langSwitcher();
		return '' +
			'<nav class="nav" id="nav">' +
				'<a href="index.html" class="nav__logo">' + logo + '</a>' +
				'<div class="nav__links">' + links + '</div>' +
				ls +
				'<button class="nav__burger" id="burger" aria-label="Menu"><span></span><span></span></button>' +
			'</nav>' +
			'<div class="mob-nav" id="mobNav">' + links +
			'</div>';
	}

	function footer(site) {
		var f = site.footer || {};
		var brand = Object.assign({}, site.brand || {}, { logo_footer: FOOTER_LOGO_OVERRIDE });
		// Navigation column — every menu item, straight from the live nav config.
		var navLinks = ((site.nav && site.nav.links) || []).map(function (l) {
			return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>';
		}).join('');
		var navCol = '<div class="footer__col"><h5>' + esc(t('footer_nav')) + '</h5>' + navLinks + '</div>';
		// Services column — every service, deep-linking to services.html#<anchor>.
		var svcLinks = (site.services || []).map(function (s) {
			var anchor = s.anchor || s.slug || '';
			return '<a href="services.html' + (anchor ? '#' + esc(anchor) : '') + '">' + esc(s.name) + '</a>';
		}).join('');
		var svcCol = svcLinks ? '<div class="footer__col"><h5>' + esc(t('footer_services')) + '</h5>' + svcLinks + '</div>' : '';
		// Graceful fallback: a backend that predates the `services` payload (e.g.
		// production before the plugin update) gets the CMS-configured footer
		// columns instead, so the footer never loses its columns. Auto-upgrades to
		// the dynamic nav+services columns the moment the API provides services.
		var legacyCols = (f.cols || []).map(function (col) {
			var clinks = (col.links || []).map(function (l) { return '<a href="' + esc(l.href) + '">' + esc(l.label) + '</a>'; }).join('');
			return '<div class="footer__col"><h5>' + esc(col.title) + '</h5>' + clinks + '</div>';
		}).join('');
		var colsHtml = (site.services || []).length ? (navCol + svcCol) : legacyCols;
		var c = f.contacts || {};
		var contactCol = '<div class="footer__col"><h5>' + esc(c.title || t('footer_contact')) + '</h5>' +
			(c.address1 ? '<span>' + esc(c.address1) + '</span>' : '') +
			(c.address2 ? '<span>' + esc(c.address2) + '</span>' : '') +
			(c.email ? '<a href="mailto:' + esc(c.email) + '">' + esc(c.email) + '</a>' : '') +
			(c.phone ? '<a href="tel:' + esc((c.phone || '').replace(/\s/g, '')) + '">' + esc(c.phone) + '</a>' : '') +
			'</div>';
		var socials = (f.socials || []).map(function (s) {
			var ext = /^https?:/i.test(s.href || '') ? ' target="_blank" rel="noopener"' : '';
			return '<a href="' + esc(s.href || '#') + '"' + ext + '><img src="assets/social-' + esc(s.type) + '.svg" alt="' + esc(s.type) + '"></a>';
		}).join('');
		return '' +
			'<footer class="footer" id="footer"><div class="wrap">' +
				'<div class="footer__top">' +
					'<div class="footer__brand">' +
						(brand.logo_footer ? '<img src="' + esc(brand.logo_footer) + '" alt="Casa Calda">' : '') +
						'<p>' + nl2br(f.brand_text || '') + '</p>' +
					'</div>' +
					'<div class="footer__cols">' + colsHtml + contactCol + '</div>' +
				'</div>' +
				'<div class="footer__bottom">' +
					'<span class="footer__copy">' + esc(f.copy || '') + '</span>' +
					'<div class="footer__social">' + socials + '</div>' +
				'</div>' +
			'</div></footer>';
	}

	function btt() {
		return '<button class="btt" id="btt" aria-label="Back to top"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 15l-6-6-6 6"/></svg></button>';
	}

	/* ---------------- SECTION TEMPLATES ---------------- */

	var T = {};

	T.hero = function (d) {
		var overlay = (d.overlay != null && d.overlay !== '') ? ' style="background:rgba(0,0,0,' + Number(d.overlay) + ')"' : '';
		// Hero buttons removed per user request — ignore d.actions from WP
		var heroLogoUrl = LOGO_OVERRIDE;
		return '<section class="hero">' +
			'<div class="hero__bg">' + mediaTag(d.bg, { alt: d.title || 'Casa Calda' }) + '</div>' +
			'<div class="hero__overlay"' + overlay + '></div>' +
			'<div class="hero__content">' +
				'<img class="hero__logo" src="' + esc(heroLogoUrl) + '" alt="Casa Calda">' +
				(d.eyebrow ? '<p class="hero__eyebrow">' + esc(d.eyebrow) + '</p>' : '') +
				(d.title ? '<h1 class="hero__title">' + esc(d.title) + '</h1>' : '') +
			'</div></section>';
	};

	T['page-hero'] = function (d) {
		var crumb = (d.crumb || []).map(function (c) {
			return c.href ? '<a href="' + esc(c.href) + '">' + esc(c.label) + '</a>' : esc(c.label);
		}).join(' &nbsp;/&nbsp; ');
		var overlay = (d.overlay != null && d.overlay !== '') ? ' style="background:rgba(0,0,0,' + Number(d.overlay) + ')"' : '';
		return '<section class="page-hero"><div class="page-hero__bg">' + mediaTag(d.bg, { alt: d.title }) + '</div>' +
			'<div class="page-hero__overlay"' + overlay + '></div>' +
			'<div class="page-hero__content">' +
				(crumb ? '<p class="page-hero__crumb">' + crumb + '</p>' : '') +
				'<h1 class="page-hero__title">' + esc(d.title) + '</h1>' +
			'</div></section>';
	};

	T['intro-split'] = function (d) {
		return '<section class="section" style="padding-bottom:60px"><div class="wrap"><div class="about-split" style="padding:0">' +
			'<div class="anim">' + (d.eyebrow ? '<p class="eyebrow">' + esc(d.eyebrow) + '</p>' : '') +
				'<h2 class="sec-title" style="margin-bottom:20px">' + esc(d.title) + '</h2>' +
				(d.body ? '<p class="about-split__body">' + esc(d.body) + '</p>' : '') + '</div>' +
			'<div class="about-split__img anim">' + (d.image && d.image.url ? '<img src="' + esc(d.image.url) + '" alt="" style="aspect-ratio:16/10;border-radius:12px">' : '') + '</div>' +
		'</div></div></section>';
	};

	T['service-grid'] = function (d) {
		var items = (d.source && d.source.items) || [];
		var cards = items.map(function (s) {
			return '<a href="#' + esc(s.anchor || s.slug) + '" class="svc-page-card anim">' +
				'<div class="svc-page-card__icon">' + (s.icon ? '<img src="' + esc(s.icon) + '" alt="">' : '') + '</div>' +
				'<h3>' + esc(s.name) + '</h3><p>' + esc(s.short) + '</p>' +
				'<span class="svc-page-card__arrow">&rarr;</span></a>';
		}).join('');
		return '<section style="padding:0 0 80px"><div class="wrap"><div class="svc-page-grid">' + cards + '</div></div></section>';
	};

	T['service-detail'] = function (d) {
		var items = (d.source && d.source.items) || [];
		return items.map(function (s, i) {
			var num = ('0' + (i + 1)).slice(-2);
			var even = (i % 2 === 1);
			var rev = even ? ' svc-detail__inner--reverse' : '';
			var numCls = even ? ' svc-detail__num--right' : '';
			var body = s.body ? s.body : (s.short ? '<p>' + esc(s.short) + '</p>' : '');
			var feats = (s.features || []).map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('');
			return '<section class="svc-detail" id="' + esc(s.anchor || s.slug) + '"><div class="wrap">' +
				'<div class="svc-detail__num' + numCls + ' anim">' + num + '</div>' +
				'<div class="svc-detail__inner' + rev + ' anim">' +
					'<div class="svc-detail__text">' + (s.eyebrow ? '<p class="eyebrow">' + esc(s.eyebrow) + '</p>' : '') +
						'<h3>' + esc(s.name) + '</h3>' + body +
						(feats ? '<ul class="svc-detail__list">' + feats + '</ul>' : '') + '</div>' +
					'<div class="svc-detail__img">' + (s.image ? '<img src="' + esc(s.image) + '" alt="' + esc(s.name) + '">' : '') + '</div>' +
				'</div></div></section>';
		}).join('');
	};

	T.process = function (d) {
		var steps = (d.steps || []).map(function (st, i) {
			var num = ('0' + (i + 1)).slice(-2);
			return '<div class="process-step anim"><div class="process-step__num">' + num + '</div>' +
				'<h4>' + esc(st.title) + '</h4><p>' + esc(st.desc) + '</p></div>';
		}).join('');
		return '<section class="section section--gray"><div class="wrap">' +
			'<div class="sec-head anim" style="margin-bottom:56px;text-align:center"><div style="width:100%">' +
			(d.eyebrow ? '<p class="eyebrow" style="text-align:center">' + esc(d.eyebrow) + '</p>' : '') +
			'<h2 class="sec-title" style="text-align:center">' + esc(d.title) + '</h2></div></div>' +
			'<div class="process-grid">' + steps + '</div></div></section>';
	};

	T.statement = function (d) {
		return '<section class="statement"><div class="wrap">' +
			'<span class="statement__line anim"></span>' +
			'<h2 class="statement__text anim" id="statementText">' + esc(d.text) + '</h2>' +
			'</div></section>';
	};

	T.services = function (d) {
		var items = (d.source && d.source.items) || [];
		var cards = items.map(function (s) {
			var anchor = s.anchor || s.slug || '';
			return '<div class="svc-card svc-card--' + esc(s.variant || 'navy') + '"' + (anchor ? ' data-svc-anchor="' + esc(anchor) + '"' : '') + '><div class="svc-card__inner">' +
				'<div class="svc-card__icon">' + (s.icon ? '<img src="' + esc(s.icon) + '" alt="">' : '') + '</div>' +
				'<h3 class="svc-card__title">' + esc(s.name) + '</h3>' +
				'<p class="svc-card__desc">' + esc(s.short) + '</p>' +
			'</div></div>';
		}).join('');
		return '<section class="services" id="services"><div class="wrap">' +
			'<div class="sec-head anim"><div class="sec-head__left">' +
				(d.eyebrow ? '<p class="eyebrow">' + esc(d.eyebrow) + '</p>' : '') +
				'<h2 class="sec-title">' + esc(d.title) + '</h2></div>' +
			'<div class="sec-head__right"><p class="sec-head__desc">' + esc(d.desc || '') + '</p>' +
				'<div class="sec-head__controls">' +
					(d.cta_label ? '<a href="' + esc(d.cta_href || '#') + '" class="btn-text-pill">' + esc(d.cta_label) + '</a>' : '') +
					'<button class="arrow-btn arrow-btn--prev" id="svcPrev">' + SVG_PREV + '</button>' +
					'<button class="arrow-btn arrow-btn--next" id="svcNext">' + SVG_NEXT + '</button>' +
				'</div></div></div>' +
			'<div class="svc-cards anim" id="svcCards">' + cards + '</div>' +
			'</div></section>';
	};

	T.stats = function (d) {
		var items = (d.items || []).map(function (it) {
			return '<div class="anim"><span class="stats__num" data-count="' + esc(it.number) + '">0</span>' +
				'<span class="stats__plus">' + esc(it.suffix || '') + '</span>' +
				'<span class="stats__label">' + esc(it.label) + '</span></div>';
		}).join('');
		return '<section class="stats"><div class="wrap"><div class="stats__grid">' + items + '</div></div></section>';
	};

	T.projects = function (d) {
		var items = (d.source && d.source.items) || [];
		if (d.layout === 'grid') {
			var grid = items.map(function (p) {
				var meta = [p.location, p.year].filter(Boolean).join(' · ');
				return '<a class="proj-grid__card anim" href="project.html?slug=' + esc(p.slug) + '">' +
					'<div class="proj-grid__img">' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' : '') + '</div>' +
					'<div class="proj-grid__info"><span class="proj-grid__tag">' + esc(p.tag || '') + '</span><h3>' + esc(p.name) + '</h3>' +
					'<span class="proj-grid__meta">' + esc(meta) + '</span></div></a>';
			}).join('');
			return '<section class="section"><div class="wrap">' +
				'<div class="sec-head anim" style="margin-bottom:40px"><div class="sec-head__left">' + (d.eyebrow ? '<p class="eyebrow">' + esc(d.eyebrow) + '</p>' : '') + '<h2 class="sec-title">' + esc(d.title) + '</h2></div></div>' +
				'<div class="proj-grid">' + grid + '</div></div></section>';
		}
		var cards = items.map(function (p) {
			return '<article class="ribbon__card" data-slug="' + esc(p.slug) + '">' +
				'<div class="ribbon__media">' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' : '') + '</div>' +
				'<div class="ribbon__meta"><span class="ribbon__subtitle">' + esc(p.tag || '') + '</span><h3 class="ribbon__title">' + esc(p.name) + '</h3></div>' +
			'</article>';
		}).join('');
		return '<section class="projects" id="projects"><div class="wrap">' +
			'<div class="sec-head sec-head--split anim"><div class="sec-head__left">' +
				(d.eyebrow ? '<p class="eyebrow">' + esc(d.eyebrow) + '</p>' : '') + '<h2 class="sec-title">' + esc(d.title) + '</h2></div>' +
			'<div class="sec-head__controls">' + (d.cta_label ? '<a href="' + esc(d.cta_href || '#') + '" class="btn-text-pill">' + esc(d.cta_label) + '</a>' : '') + '</div></div></div>' +
			'<div class="ribbon" id="ribbon" role="region" aria-label="projects">' +
				'<div class="ribbon__controls"><span class="ribbon__counter" id="ribbonCounter">1&mdash;' + items.length + '</span>' +
					'<div class="sec-head__controls">' +
						'<button class="arrow-btn arrow-btn--prev" id="ribbonPrev">' + SVG_PREV + '</button>' +
						'<button class="arrow-btn arrow-btn--next" id="ribbonNext">' + SVG_NEXT + '</button>' +
					'</div></div>' +
				'<div class="ribbon__viewport"><div class="ribbon__track" id="ribbonTrack">' + cards + '</div></div>' +
			'</div></section>';
	};

	T['about-split'] = function (d) {
		var vals = (d.values || []).map(function (v) {
			return '<div class="vals__item"><span class="vals__num">' + esc(v.num) + '</span><div>' +
				'<h4 class="vals__title">' + esc(v.title) + '</h4><p class="vals__desc">' + esc(v.desc) + '</p></div></div>';
		}).join('');
		return '<section class="about" id="about"><div class="wrap" style="display:flex;gap:66px;align-items:center;flex-wrap:wrap">' +
			'<div class="about__text anim"><div class="about__title-wrap">' +
				(d.eyebrow ? '<p class="eyebrow">' + esc(d.eyebrow) + '</p>' : '') + '<h2 class="sec-title">' + esc(d.title) + '</h2></div>' +
				(d.lead ? '<p class="about__lead">' + esc(d.lead) + '</p>' : '') +
				(d.body ? '<p class="about__body">' + esc(d.body) + '</p>' : '') +
				(vals ? '<div class="vals">' + vals + '</div>' : '') +
			'</div>' +
			'<div class="about__img anim">' + mediaTag(d.image, { alt: d.title }) + '</div>' +
		'</div></section>';
	};

	T.team = function (d) {
		var items = (d.source && d.source.items) || [];
		var cards = items.map(function (m) {
			var media = m.video ? '<video src="' + esc(m.video) + '" muted loop playsinline preload="metadata"></video>'
				: (m.photo ? '<img src="' + esc(m.photo) + '" alt="' + esc(m.name) + '">' : '');
			return '<div class="team-card"><div class="team-card__img">' + media + '</div>' +
				'<div class="team-card__info"><p class="team-card__role">' + esc(m.role) + '</p>' +
				'<h3 class="team-card__name">' + esc(m.name) + '</h3>' +
				'<div class="team-card__bio"><p>' + esc(m.bio) + '</p></div></div></div>';
		}).join('');
		return '<section class="team" id="team"><div class="wrap">' +
			'<div class="sec-head anim"><div class="sec-head__left">' +
				(d.eyebrow ? '<p class="eyebrow">' + esc(d.eyebrow) + '</p>' : '') +
				'<h2 class="sec-title">' + esc(d.title) + '</h2>' +
				(d.desc ? '<p class="sec-head__desc" style="max-width:640px;margin-top:8px">' + esc(d.desc) + '</p>' : '') + '</div>' +
				'<div class="sec-head__right"><div class="sec-head__controls">' +
					'<button class="arrow-btn arrow-btn--prev" id="teamPrev">' + SVG_PREV + '</button>' +
					'<button class="arrow-btn arrow-btn--next" id="teamNext">' + SVG_NEXT + '</button>' +
				'</div></div></div>' +
			'<div class="scroll-wrap" id="teamWrap"><div class="team__cards anim" id="teamCards">' + cards + '</div>' +
			'<div class="scroll-dots" id="teamDots"></div></div>' +
			'</div></section>';
	};

	T.partners = function (d) {
		var logos = (d.logos || []).map(function (m) {
			return '<div class="partners-strip__item"><img src="' + esc(url(m)) + '" alt=""></div>';
		}).join('');
		return '<section class="section"><div class="wrap">' +
			(d.title ? '<h2 class="sec-title" style="text-align:center;margin-bottom:32px">' + esc(d.title) + '</h2>' : '') +
			'<div class="partners-strip anim" id="partnersWrap">' + logos + '</div></div></section>';
	};

	T.timeline = function (d) {
		var items = (d.items || []).map(function (it) {
			return '<div class="about-tl"><div class="about-tl__year">' + esc(it.year) + '</div>' +
				'<div class="about-tl__body"><h4>' + esc(it.title) + '</h4><p>' + esc(it.text) + '</p></div></div>';
		}).join('');
		return '<section class="section section--gray"><div class="wrap">' +
			(d.title ? '<h2 class="sec-title" style="text-align:center;margin-bottom:40px">' + esc(d.title) + '</h2>' : '') +
			'<div class="about-timeline" id="aboutTimeline"><span class="timeline__line"></span><span class="timeline__fill" id="tlFill"></span>' + items + '</div>' +
			'</div></section>';
	};

	T['feature-grid'] = function (d, site) {
		var cards = (d.items || []).map(function (c) {
			var anchor = serviceAnchorByName(site, c.title);
			return '<div class="proj-svc-card anim"' + (anchor ? ' data-svc-anchor="' + esc(anchor) + '"' : '') + '><div class="proj-svc-card__icon">' + (c.icon && c.icon.url ? '<img src="' + esc(c.icon.url) + '" alt="">' : '') + '</div>' +
				'<h4>' + esc(c.title) + '</h4>' + (c.desc ? '<p>' + esc(c.desc) + '</p>' : '') + '</div>';
		}).join('');
		return '<section class="proj-services"><div class="wrap">' +
			'<div class="anim">' + (d.eyebrow ? '<p class="eyebrow">' + esc(d.eyebrow) + '</p>' : '') + '<h2 class="sec-title">' + esc(d.title) + '</h2></div>' +
			'<div class="proj-services__grid">' + cards + '</div></div></section>';
	};

	T['team-grid'] = function (d) {
		var items = (d.source && d.source.items) || [];
		var cards = items.map(function (m) {
			var media = m.video ? '<video src="' + esc(m.video) + '" muted loop playsinline preload="metadata"></video>'
				: (m.photo ? '<img src="' + esc(m.photo) + '" alt="' + esc(m.name) + '">' : '');
			return '<div class="team-grid__card anim"><div class="team-grid__img">' + media + '</div>' +
				'<div class="team-grid__info"><p class="team-grid__role">' + esc(m.role) + '</p>' +
				'<h3 class="team-grid__name">' + esc(m.name) + '</h3>' +
				'<p class="team-grid__bio">' + esc(m.bio) + '</p></div></div>';
		}).join('');
		return '<section class="section' + (d.gray ? ' section--gray' : '') + '"><div class="wrap">' +
			'<div class="sec-head anim" style="margin-bottom:48px"><div class="sec-head__left">' +
			(d.eyebrow ? '<p class="eyebrow">' + esc(d.eyebrow) + '</p>' : '') +
			'<h2 class="sec-title">' + esc(d.title) + '</h2></div></div>' +
			'<div class="team-grid" data-stagger>' + cards + '</div></div></section>';
	};

	T['projects-hud'] = function (d) {
		var items = (d.source && d.source.items) || [];
		var first = items[0] || {};
		var crumb = (d.crumb || []).map(function (c) { return c.href ? '<a href="' + esc(c.href) + '">' + esc(c.label) + '</a>' : esc(c.label); }).join(' / ');
		var data = items.map(function (p) {
			return { name: p.name, image: p.image || 'assets/project-main.jpg', tag: p.tag, client: p.client, cat: p.category, area: p.area, year: p.year, status: p.status, slug: p.slug };
		});
		var json = JSON.stringify(data).replace(/</g, '\\u003c');
		return '<section class="proj-hero-hud" id="projHud">' +
			'<div class="proj-hero-hud__bg"><img id="projHudImg" src="' + esc(first.image || 'assets/project-main.jpg') + '" alt="' + esc(first.name || '') + '"></div>' +
			'<div class="proj-hero-hud__overlay"></div>' +
			'<div class="proj-hero-hud__bracket proj-hero-hud__bracket--tl"></div><div class="proj-hero-hud__bracket proj-hero-hud__bracket--tr"></div><div class="proj-hero-hud__bracket proj-hero-hud__bracket--bl"></div><div class="proj-hero-hud__bracket proj-hero-hud__bracket--br"></div>' +
			'<div class="proj-hero-hud__content"><p class="proj-hero-hud__crumb">' + crumb + '</p><h1 class="proj-hero-hud__title">' + esc(d.title || '') + '</h1></div>' +
			'<div class="proj-hero-hud__nav"><span class="proj-hero-hud__counter" id="projHudCounter">01 / ' + ('0' + items.length).slice(-2) + '</span>' +
				'<button class="proj-hero-hud__arrow" id="projHudPrev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg></button>' +
				'<button class="proj-hero-hud__arrow proj-hero-hud__arrow--next" id="projHudNext"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg></button></div>' +
			'<div class="proj-hero-hud__panel">' +
				'<span class="proj-hero-hud__tag" id="projHudTag">' + esc(first.tag || '') + '</span>' +
				'<h3 class="proj-hero-hud__name" id="projHudName">' + esc(first.name || '') + '</h3>' +
				'<div class="proj-hero-hud__row"><span>' + t('client') + '</span><span id="projHudClient">' + esc(first.client || '') + '</span></div>' +
				'<div class="proj-hero-hud__row"><span>' + t('category') + '</span><span id="projHudCat">' + esc(first.category || '') + '</span></div>' +
				'<div class="proj-hero-hud__row"><span>' + t('area') + '</span><span id="projHudArea">' + esc(first.area || '') + '</span></div>' +
				'<div class="proj-hero-hud__row"><span>' + t('year') + '</span><span id="projHudYear">' + esc(first.year || '') + '</span></div>' +
				'<a href="project.html?slug=' + esc(first.slug || '') + '" class="proj-hero-hud__btn">' + t('details') + ' &rarr;</a>' +
			'</div>' +
			'<div class="proj-hero-hud__pin" style="left:28%;top:38%" id="pin1"><div class="proj-hero-hud__pin-dot"></div><div class="proj-hero-hud__pin-line"></div><div class="proj-hero-hud__pin-label" id="pinLabel1"></div></div>' +
			'<div class="proj-hero-hud__pin" style="left:52%;top:22%" id="pin2"><div class="proj-hero-hud__pin-dot"></div><div class="proj-hero-hud__pin-line proj-hero-hud__pin-line--up"></div><div class="proj-hero-hud__pin-label proj-hero-hud__pin-label--top" id="pinLabel2"></div></div>' +
			'<div class="proj-hero-hud__pin" style="left:75%;top:48%" id="pin3"><div class="proj-hero-hud__pin-dot"></div><div class="proj-hero-hud__pin-line"></div><div class="proj-hero-hud__pin-label" id="pinLabel3"></div></div>' +
			'<script type="application/json" id="projHudData">' + json + '</' + 'script>' +
		'</section>';
	};

	T['custom-html'] = function (d) { return txt(d.html || ''); };

	function projectMetaItem(label, val) {
		return val ? '<div class="proj-hero__meta-item"><strong>' + esc(label) + '</strong><span>' + esc(val) + '</span></div>' : '';
	}
	function projectHero(p) {
		return '<section class="proj-hero"><div class="proj-hero__bg">' + (p.image ? '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '">' : '') + '</div>' +
			'<div class="proj-hero__overlay"></div><div class="proj-hero__content">' +
			(p.tag ? '<span class="proj-hero__tag">' + esc(p.tag) + '</span>' : '') +
			'<h1 class="proj-hero__title">' + esc(p.name) + '</h1>' +
			'<div class="proj-hero__meta">' +
				projectMetaItem(t('location'), p.location) + projectMetaItem(t('year'), p.year) +
				projectMetaItem(t('area'), p.area) + projectMetaItem(t('status'), p.status) +
			'</div></div></section>';
	}
	function projectOverview(p) {
		function row(label, val) { return val ? '<div class="proj-specs__row"><span class="proj-specs__label">' + esc(label) + '</span><span class="proj-specs__val">' + esc(val) + '</span></div>' : ''; }
		return '<section class="proj-overview"><div class="wrap"><div class="proj-overview__grid">' +
			'<div class="proj-overview__text anim"><p class="eyebrow">' + t('proj_overview') + '</p>' +
			'<h2>' + esc(p.overview_heading || p.name) + '</h2><div>' + txt(p.overview || '') + '</div></div>' +
			'<div class="proj-specs anim"><h3>' + t('proj_details') + '</h3>' +
				row(t('client'), p.client) + row(t('category'), p.category) + row(t('area'), p.area) +
				row(t('duration'), p.duration) + row(t('location'), p.location) + row(t('status'), p.status) +
			'</div></div></div></section>';
	}
	/* Project photo gallery. Images come from the project entity's `gallery`
	   (cc_media_list → [{url,type,alt}, …]); also tolerates a plain URL array.
	   Renders nothing when empty, so projects without a gallery are unaffected.
	   First item is the tall feature cell, matching the original layout. */
	function projectGallery(p) {
		var imgs = (p && p.gallery) || [];
		if (!imgs.length) { return ''; }
		var cells = imgs.map(function (m, i) {
			var u = (m && m.url) ? m.url : (typeof m === 'string' ? m : '');
			if (!u) { return ''; }
			var tall = (i === 0) ? ' proj-gallery__item--tall' : '';
			var inner = (m && m.type === 'video')
				? '<video src="' + esc(u) + '" muted loop playsinline preload="metadata"></video>'
				: '<img src="' + esc(u) + '" alt="' + esc((m && m.alt) || '') + '" loading="lazy">';
			return '<div class="proj-gallery__item' + tall + '">' + inner + '</div>';
		}).join('');
		return '<section class="proj-gallery"><div class="wrap">' +
			'<div class="anim"><p class="eyebrow">' + t('gallery') + '</p><h2>' + t('gallery_title') + '</h2></div>' +
			'<div class="proj-gallery__grid anim">' + cells + '</div>' +
		'</div></section>';
	}

	T['cta-band'] = function (d) {
		/* Skip the CTA banner on the contact page — it's redundant
		   (the contact form is right there). */
		if (typeof window !== 'undefined' && window.CC_PAGE === 'contact') return '';
		return '<section class="cta-band"><div class="cta-band__bg">' + mediaTag(d.bg, { alt: d.title }) + '</div>' +
			'<div class="cta-band__overlay"></div>' +
			'<div class="cta-band__content"><h2 class="cta-band__title">' + esc(d.title) + '</h2>' +
			(d.desc ? '<p class="cta-band__desc">' + esc(d.desc) + '</p>' : '') +
			(d.button_label ? '<a href="' + esc(d.button_href || '#') + '" class="nav__cta">' + esc(d.button_label) + '</a>' : '') +
			'</div></section>';
	};

	T.contact = function (d, site) {
		var services = (site && site.contact && site.contact.services) || [];
		var opts = services.map(function (s) { return '<option>' + esc(s) + '</option>'; }).join('');
		var socials = (site && site.footer && site.footer.socials) || [];
		var socialLinks = socials.map(function (s) {
			return '<a href="' + esc(s.href || '#') + '"><img src="assets/social-' + esc(s.type) + '.svg" alt="' + esc(s.type) + '"></a>';
		}).join('');
		var ICON_PIN = '<svg viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
		var ICON_PHONE = '<svg viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';
		var ICON_MAIL = '<svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>';
		var tel = (d.phone || '').replace(/[^+\d]/g, '');
		return '<div class="wrap"><div class="contact-intro anim">' +
				(d.eyebrow ? '<p class="eyebrow" style="text-align:center">' + esc(d.eyebrow) + '</p>' : '') +
				'<h2>' + esc(d.title) + '</h2>' + (d.intro ? '<p>' + esc(d.intro) + '</p>' : '') +
			'</div></div>' +
			'<section><div class="wrap"><div class="contact-grid">' +
				'<div class="contact-info">' +
					'<div class="contact-info__card anim"><div class="contact-info__icon">' + ICON_PIN + '</div>' +
						'<div class="contact-info__detail"><h4>' + esc(d.addr_title || t('address')) + '</h4><p>' + nl2br(d.address || '') + '</p></div></div>' +
					(d.phone ? '<div class="contact-info__card anim"><div class="contact-info__icon">' + ICON_PHONE + '</div><div class="contact-info__detail"><h4>' + t('phone') + '</h4><a href="tel:' + esc(tel) + '">' + esc(d.phone) + '</a></div></div>' : '') +
					(d.email ? '<div class="contact-info__card anim"><div class="contact-info__icon">' + ICON_MAIL + '</div><div class="contact-info__detail"><h4>' + t('email') + '</h4><a href="mailto:' + esc(d.email) + '">' + esc(d.email) + '</a></div></div>' : '') +
					(socialLinks ? '<div class="contact-social anim">' + socialLinks + '</div>' : '') +
					(d.map ? '<div class="contact-map anim" style="margin-top:16px"><iframe src="' + esc(d.map) + '" allowfullscreen loading="lazy"></iframe></div>' : '') +
				'</div>' +
				'<div class="contact-form anim"><h3>' + esc(d.form_title || t('form_title')) + '</h3>' + (d.form_intro ? '<p>' + esc(d.form_intro) + '</p>' : '') +
					'<form id="contactForm" novalidate>' +
						'<input type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
						'<div class="form-row"><div class="form-field"><label for="fname">' + t('f_fname') + '</label><input type="text" id="fname" name="fname" placeholder="' + esc(t('ph_fname')) + '"></div>' +
						'<div class="form-field"><label for="lname">' + t('f_lname') + '</label><input type="text" id="lname" name="lname" placeholder="' + esc(t('ph_lname')) + '"></div></div>' +
						'<div class="form-row"><div class="form-field"><label for="email">' + t('email') + '</label><input type="email" id="email" name="email" placeholder="info@example.com"></div>' +
						'<div class="form-field"><label for="phone">' + t('phone') + '</label><input type="tel" id="phone" name="phone" placeholder="+995 5XX XXX XXX"></div></div>' +
						'<div class="form-row form-row--full"><div class="form-field"><label for="service">' + t('f_service') + '</label><select id="service" name="service"><option value="">' + esc(t('ph_service')) + '</option>' + opts + '<option>' + esc(t('opt_other')) + '</option></select></div></div>' +
						'<div class="form-row form-row--full"><div class="form-field"><label for="message">' + t('f_message') + '</label><textarea id="message" name="message" placeholder="' + esc(t('ph_message')) + '"></textarea></div></div>' +
						'<div class="form-submit"><button type="submit" class="btn-pill">' + t('btn_send') + '</button><p id="formStatus" role="status" style="margin-top:14px;font-weight:600"></p></div>' +
					'</form></div>' +
			'</div></div></section>';
	};

	T['rich-text'] = function (d) {
		return '<section class="section"><div class="wrap">' +
			(d.eyebrow ? '<p class="eyebrow">' + esc(d.eyebrow) + '</p>' : '') +
			(d.title ? '<h2 class="sec-title">' + esc(d.title) + '</h2>' : '') +
			'<div class="rich-text">' + txt(d.html || '') + '</div></div></section>';
	};

	T.media = function (d) {
		return '<section class="section"><div class="wrap">' + mediaTag(d.media, { cls: 'media-band', alt: d.caption }) +
			(d.caption ? '<p class="media-caption">' + esc(d.caption) + '</p>' : '') + '</div></section>';
	};

	T.spacer = function (d) { return '<div style="height:' + (parseInt(d.height, 10) || 40) + 'px"></div>'; };

	function section(sec, site) {
		var fn = T[sec.type];
		if (!fn) { return '<!-- unknown section: ' + esc(sec.type) + ' -->'; }
		try { return fn(sec.data || {}, site); }
		catch (e) { console.warn('[CCRender] failed for', sec.type, e); return ''; }
	}

	window.CCRender = { nav: nav, footer: footer, btt: btt, section: section, projectHero: projectHero, projectOverview: projectOverview, projectGallery: projectGallery };
})();
