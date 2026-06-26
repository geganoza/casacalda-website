/* Casa Calda — CMS connector.
 *
 * One place that knows how to talk to WordPress. The pages call window.CC_CMS.
 * Uses the ?rest_route= form so it works regardless of WP permalink settings.
 */
(function () {
	'use strict';

	/* Language picked by the visitor (UI switcher writes localStorage.cc_lang).
	   Falls back to Georgian if nothing is set. We pass this to every WP fetch
	   so TranslatePress (or any other WP i18n plugin) can return translated
	   content. Until the WP side actually serves translations, the param is a
	   harmless no-op and pages stay in Georgian. */
	function ccLang() {
		try { return localStorage.getItem('cc_lang') || 'ka'; }
		catch (e) { return 'ka'; }
	}
	function langSuffix() {
		var l = ccLang();
		return l && l !== 'ka' ? '&lang=' + encodeURIComponent(l) : '';
	}

	var CC = {
		// WordPress REST root. Local dev = the Local site; production = the
		// headless WP backend on the cms subdomain.
		api: (function () {
			var h = location.hostname;
			return (h === 'casacalda.local' || h === 'localhost' || h === '127.0.0.1')
				? 'http://casacalda.local'
				: 'https://cms.casacalda.com';
		})(),

		lang: ccLang,

		// Published projects, in the editor's chosen order. Resolves to an array
		// of normalized objects (the plugin's "cc" payload), or null on failure
		// so callers can fall back to their existing static markup.
		projects: function () {
			return fetch(this.api + '/?rest_route=/wp/v2/projects&per_page=50&orderby=menu_order&order=asc' + langSuffix())
				.then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
				.then(function (rows) {
					return rows.map(function (r) { var o = r.cc || {}; o.id = r.id; return o; });
				})
				.catch(function (e) {
					console.warn('[CC CMS] projects fetch failed — using static fallback:', e.message);
					return null;
				});
		},

		// A single project by slug (for project.html — used in the next step).
		project: function (slug) {
			return fetch(this.api + '/?rest_route=/wp/v2/projects&slug=' + encodeURIComponent(slug) + langSuffix())
				.then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
				.then(function (rows) { return rows[0] ? rows[0].cc : null; })
				.catch(function (e) {
					console.warn('[CC CMS] project fetch failed:', e.message);
					return null;
				});
		},

		// The site shell — brand, nav, footer, contact options, published pages.
		site: function () {
			return fetch(this.api + '/?rest_route=/casacalda/v1/site' + langSuffix())
				.then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
				.catch(function (e) { console.warn('[CC CMS] site fetch failed:', e.message); return null; });
		},

		// One page with its sections fully resolved (media + entity sources expanded).
		page: function (slug) {
			return fetch(this.api + '/?rest_route=/casacalda/v1/page&slug=' + encodeURIComponent(slug) + langSuffix())
				.then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
				.catch(function (e) { console.warn('[CC CMS] page fetch failed:', e.message); return null; });
		},

		// POST the contact form to WordPress (stored as an Inquiry + emailed).
		// Sent as form-urlencoded so it's a "simple" CORS request (no preflight).
		sendContact: function (data) {
			var body = new URLSearchParams(data);
			return fetch(this.api + '/?rest_route=/casacalda/v1/contact', { method: 'POST', body: body })
				.then(function (r) {
					return r.json().catch(function () { return {}; }).then(function (j) {
						return { ok: r.ok && j && j.ok === true, data: j };
					});
				});
		}
	};

	window.CC_CMS = CC;
})();
