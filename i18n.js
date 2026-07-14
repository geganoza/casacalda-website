/* Casa Calda — UI string i18n.
 *
 * Translates the hardcoded "chrome" strings baked into render.js and app.js
 * (form labels, project spec labels, status messages, buttons). It does NOT
 * touch CMS content — that comes from WordPress and is translated server-side
 * (see THOMAS_TRANSLATION.md / the Track 2 WP plan). cms.js already appends
 * ?lang=en to every WP fetch, so the day WP serves English, content flips too.
 *
 * Language is stored in localStorage.cc_lang ('ka' default, 'en' available).
 * The same key drives cms.js, the nav switcher (render.js + main.js), and this.
 *
 * Load order matters: this file MUST load before render.js and app.js so that
 * window.CC_I18N exists when they render. Georgian stays the default — if a key
 * or this whole file is missing, callers fall back to the Georgian string.
 */
(function () {
	'use strict';

	/* key → { ka, en }. The `ka` value must match what render.js/app.js used
	   before, so Georgian rendering is byte-for-byte unchanged. */
	var STR = {
		/* ---- project spec labels (project HUD, hero, overview) ---- */
		client:        { ka: 'კლიენტი',           en: 'Client' },
		category:      { ka: 'კატეგორია',         en: 'Category' },
		area:          { ka: 'ფართობი',           en: 'Area' },
		year:          { ka: 'წელი',              en: 'Year' },
		location:      { ka: 'მდებარეობა',        en: 'Location' },
		status:        { ka: 'სტატუსი',           en: 'Status' },
		duration:      { ka: 'ხანგრძლივობა',      en: 'Duration' },
		details:       { ka: 'დეტალურად',         en: 'View project' },
		proj_overview: { ka: 'პროექტის მიმოხილვა', en: 'Project Overview' },
		proj_details:  { ka: 'პროექტის დეტალები',  en: 'Project Details' },
		gallery:       { ka: 'გალერეა',           en: 'Gallery' },
		gallery_title: { ka: 'პროექტის ფოტოები',   en: 'Project Photos' },

		/* ---- contact info cards + footer fallback ---- */
		address:       { ka: 'მისამართი',         en: 'Address' },
		phone:         { ka: 'ტელეფონი',          en: 'Phone' },
		email:         { ka: 'ელ-ფოსტა',          en: 'Email' },
		footer_contact:{ ka: 'კონტაქტი',          en: 'Contact' },
		footer_nav:    { ka: 'ნავიგაცია',         en: 'Navigation' },
		footer_services:{ka: 'ექსპერტიზა',        en: 'Services' },

		/* ---- contact form ---- */
		form_title:    { ka: 'გამოგვიგზავნეთ შეტყობინება', en: 'Send us a message' },
		f_fname:       { ka: 'სახელი',            en: 'First name' },
		f_lname:       { ka: 'გვარი',             en: 'Last name' },
		f_service:     { ka: 'კომპეტენცია',        en: 'Service' },
		f_message:     { ka: 'შეტყობინება',        en: 'Message' },
		ph_fname:      { ka: 'თქვენი სახელი',      en: 'Your first name' },
		ph_lname:      { ka: 'თქვენი გვარი',       en: 'Your last name' },
		ph_service:    { ka: 'აირჩიეთ კომპეტენცია', en: 'Select a service' },
		opt_other:     { ka: 'სხვა',              en: 'Other' },
		ph_message:    { ka: 'აღწერეთ თქვენი პროექტი ან შეკითხვა...', en: 'Describe your project or question…' },
		btn_send:      { ka: 'გაგზავნა',          en: 'Send' },

		/* ---- app.js: bootstrap + form status messages ---- */
		brand_suffix:  { ka: 'თბილი სახლი',        en: 'Casa Calda' },
		err_prefix:    { ka: 'შეცდომა: ',          en: 'Error: ' },
		err_site_load: { ka: 'საიტი დროებით მიუწვდომელია', en: 'The site is temporarily unavailable' },
		err_page_404:  { ka: 'გვერდი ვერ მოიძებნა', en: 'Page not found' },
		err_wp_hint:   { ka: 'გთხოვთ სცადოთ ერთი წუთის შემდეგ.', en: 'Please try again in a moment.' },
		form_required: { ka: 'გთხოვთ შეავსოთ სახელი და ელ-ფოსტა ან ტელეფონი.', en: 'Please enter your name and an email or phone number.' },
		form_sending:  { ka: 'იგზავნება...',       en: 'Sending…' },
		form_thanks:   { ka: 'მადლობა! თქვენი შეტყობინება მიღებულია.', en: 'Thank you! Your message has been received.' },
		form_error:    { ka: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან ან დაგვირეკეთ.', en: 'Something went wrong. Please try again or call us.' },
		form_noconn:   { ka: 'კავშირი ვერ დამყარდა. სცადეთ მოგვიანებით.', en: 'Connection failed. Please try again later.' },

		/* ---- legal / footer legal line (compliance with Georgian E-commerce
		   Law Art. 4(1) — persistent display of legal name + form + address +
		   contact + registration ID). See legal/ source docs 2026-07-09. ---- */
		legal_company: {
			ka: 'შპს „თბილი სახლი"',
			en: 'LLC "Tbili Sakhli"'
		},
		legal_id: {
			ka: 'ს/კ 204976179',
			en: 'ID No. 204976179'
		},
		legal_address: {
			ka: 'ლუბლიანას ქ. 56, 0159 თბილისი, საქართველო',
			en: '56 Ljubljana St., 0159 Tbilisi, Georgia'
		},
		legal_email:   { ka: 'info@casacalda.ge',     en: 'info@casacalda.ge' },
		legal_phone:   { ka: '+995 32 2 311 325',     en: '+995 32 2 311 325' },
		legal_privacy: {
			ka: 'კონფიდენციალურობის პოლიტიკა',
			en: 'Privacy Policy'
		},
		legal_terms: {
			ka: 'მოხმარების პირობები',
			en: 'Terms of Use'
		},

		/* ---- privacy policy page ---- */
		privacy_title:   { ka: 'კონფიდენციალურობის პოლიტიკა',    en: 'Privacy Policy' },
		privacy_updated: { ka: 'ბოლო განახლება: 9 ივლისი, 2026', en: 'Last updated: 9 July 2026' },

		/* ---- terms of use page ---- */
		terms_title:     { ka: 'მოხმარების პირობები',             en: 'Terms of Use' },
		terms_effective: { ka: 'ძალაშია: 2026 წლის 10 ივლისიდან',  en: 'Effective date: 10 July 2026' }
	};

	/* Honor ?lang= on load so an English deep-link (e.g. casacalda.com/?lang=en)
	   sets the language before any fetch or render runs. We do NOT auto-switch
	   from navigator.language — Georgian is the firm default; visitors opt into
	   English via the nav switcher or the ?lang= param. */
	try {
		var q = new URLSearchParams(location.search).get('lang');
		if (q === 'en' || q === 'ka') { localStorage.setItem('cc_lang', q); }
	} catch (e) {}

	function lang() {
		var l;
		try { l = localStorage.getItem('cc_lang'); } catch (e) { l = null; }
		return l === 'en' ? 'en' : 'ka';
	}

	/* Reflect the active language on <html lang> as early as possible (helps
	   screen readers, hyphenation, and :lang() CSS). */
	try { document.documentElement.lang = lang(); } catch (e) {}

	function t(key) {
		var e = STR[key];
		if (!e) { return key; }
		return e[lang()] || e.ka || key;
	}

	window.CC_I18N = { lang: lang, t: t, STR: STR };
})();
