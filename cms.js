/* Casa Calda — CMS connector.
 *
 * One place that knows how to talk to WordPress. The pages call window.CC_CMS.
 * Uses the ?rest_route= form so it works regardless of WP permalink settings.
 */
(function () {
	'use strict';

	var CC = {
		// WordPress REST root. Local dev = your Local site. Change for production.
		api: 'http://casacalda.local',

		// Published projects, in the editor's chosen order. Resolves to an array
		// of normalized objects (the plugin's "cc" payload), or null on failure
		// so callers can fall back to their existing static markup.
		projects: function () {
			return fetch(this.api + '/?rest_route=/wp/v2/projects&per_page=50&orderby=menu_order&order=asc')
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
			return fetch(this.api + '/?rest_route=/wp/v2/projects&slug=' + encodeURIComponent(slug))
				.then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
				.then(function (rows) { return rows[0] ? rows[0].cc : null; })
				.catch(function (e) {
					console.warn('[CC CMS] project fetch failed:', e.message);
					return null;
				});
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
