(function () {
    'use strict';

    // ---- LANGUAGE SWITCHER ----
    // Stores the user's pick in localStorage as `cc_lang` ('ka' or 'en').
    // cms.js reads the same key and sends it as ?lang= on every WP fetch.
    // Clicking a button writes the new value and reloads so the page re-fetches
    // content in the chosen language.
    document.querySelectorAll('.lang-switcher__btn').forEach(function (b) {
        b.addEventListener('click', function () {
            var picked = b.getAttribute('data-cc-lang');
            if (!picked) return;
            var cur = 'ka';
            try { cur = localStorage.getItem('cc_lang') || 'ka'; } catch (e) {}
            if (picked === cur) return;
            try { localStorage.setItem('cc_lang', picked); } catch (e) {}
            location.reload();
        });
    });

    // ---- NAV SCROLL ----
    var nav = document.getElementById('nav');
    if (nav) {
        var hasDarkHero = document.querySelector('.hero, .page-hero, .proj-hero-hud');
        if (hasDarkHero) {
            // Pages with dark hero image behind nav: glass pill → solid on scroll
            var updateNav = function () {
                nav.classList.toggle('nav--scrolled', window.scrollY > 60);
            };
            window.addEventListener('scroll', updateNav, { passive: true });
            updateNav(); // run once on load
        } else {
            // Pages without dark hero (projects HUD, etc): always solid
            nav.classList.add('nav--scrolled');
        }
    }

    // ---- BURGER → X + MOBILE NAV ----
    var burger = document.getElementById('burger');
    var mobNav = document.getElementById('mobNav');
    if (burger && mobNav) {
        burger.addEventListener('click', function () {
            var open = mobNav.classList.toggle('mob-nav--open');
            burger.classList.toggle('nav__burger--open', open);
            document.body.style.overflow = open ? 'hidden' : '';
        });
        mobNav.querySelectorAll('a').forEach(function (a) {
            a.addEventListener('click', function () {
                mobNav.classList.remove('mob-nav--open');
                burger.classList.remove('nav__burger--open');
                document.body.style.overflow = '';
            });
        });
    }

    // ---- HERO LOGO FADE ----
    // The Casa Calda logo is centered over the hero video. On the first paint it
    // "brands" the page; after 5s it fades out so the video (which loops) gets
    // clean space to breathe. Once faded the class stays — no reappearance
    // during loop playback, no reappearance until the visitor reloads.
    var heroLogo = document.querySelector('.hero__logo');
    if (heroLogo) {
        setTimeout(function () { heroLogo.classList.add('hero__logo--faded'); }, 5000);
    }

    // ---- STATEMENT WORD SPLIT ----
    var stText = document.getElementById('statementText');
    if (stText) {
        var words = stText.textContent.trim().split(/\s+/);
        var first = words.shift(); // first word gets <em>
        stText.innerHTML = '<em><span class="statement__word" style="transition-delay:0s">' + first + '</span></em> ' + words.map(function (w, i) {
            return '<span class="statement__word" style="transition-delay:' + ((i + 1) * .07).toFixed(2) + 's">' + w + '</span>';
        }).join(' ');
    }

    // ---- SCROLL REVEAL ----
    var anims = document.querySelectorAll('.anim, .anim--scale, .anim--fade, .anim--left, .anim--right, .svc-cards, .svc-page-grid, .process-grid, .stats__grid, .ribbon__track, .team__cards, .vals, .values-grid, .cta-band, .team-grid, .timeline__line, .hud-stats, .contact-map, .about-svc-grid, .about-proj-grid, .partners-strip, .about-stats-grid, .about-values');
    if ('IntersectionObserver' in window) {
        var obs = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) {
                    e.target.classList.add('visible');
                    obs.unobserve(e.target);
                }
            });
        }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
        anims.forEach(function (el) { obs.observe(el); });
    } else {
        anims.forEach(function (el) { el.classList.add('visible'); });
    }

    // ---- COUNTER ANIMATION ----
    var counted = false;
    var counters = document.querySelectorAll('[data-count]');
    function countUp() {
        if (!counters.length || counted) return;
        if (counters[0].getBoundingClientRect().top > window.innerHeight * 0.9) return;
        counted = true;
        counters.forEach(function (el) {
            var target = parseInt(el.getAttribute('data-count'));
            var start = null;
            function step(ts) {
                if (!start) start = ts;
                var p = Math.min((ts - start) / 2000, 1);
                var v = Math.floor((1 - Math.pow(1 - p, 4)) * target);
                el.textContent = v.toLocaleString('en-US');
                if (p < 1) requestAnimationFrame(step);
                else el.textContent = target.toLocaleString('en-US');
            }
            requestAnimationFrame(step);
        });
    }
    window.addEventListener('scroll', countUp, { passive: true });

    // ---- SCROLL DOTS helper ----
    function initScrollDots(scrollEl, dotsEl, wrapEl) {
        if (!scrollEl || !dotsEl) return;
        var cards = scrollEl.children;
        if (!cards.length) return;

        // Build dots
        function buildDots() {
            dotsEl.innerHTML = '';
            var count = cards.length;
            for (var i = 0; i < count; i++) {
                var d = document.createElement('button');
                d.className = 'scroll-dot' + (i === 0 ? ' scroll-dot--active' : '');
                d.setAttribute('aria-label', 'Slide ' + (i + 1));
                d.dataset.idx = i;
                dotsEl.appendChild(d);
            }
        }
        buildDots();

        // Update active dot + fade edge
        function updateDots() {
            var sl = scrollEl.scrollLeft;
            var cardW = cards[0].offsetWidth + 16; // gap
            var active = Math.round(sl / cardW);
            var dots = dotsEl.querySelectorAll('.scroll-dot');
            dots.forEach(function (d, i) {
                d.classList.toggle('scroll-dot--active', i === active);
            });
            // hide right fade when scrolled to end
            if (wrapEl) {
                var atEnd = sl + scrollEl.offsetWidth >= scrollEl.scrollWidth - 10;
                wrapEl.classList.toggle('scroll-wrap--ended', atEnd);
            }
        }
        scrollEl.addEventListener('scroll', updateDots, { passive: true });
        updateDots();

        // Dot click → scroll to card
        dotsEl.addEventListener('click', function (e) {
            var dot = e.target.closest('.scroll-dot');
            if (!dot) return;
            var idx = parseInt(dot.dataset.idx);
            var cardW = cards[0].offsetWidth + 16;
            scrollEl.scrollTo({ left: idx * cardW, behavior: 'smooth' });
        });
    }

    // Init dots for services and team
    initScrollDots(
        document.getElementById('svcCards'),
        document.getElementById('svcDots'),
        document.getElementById('svcWrap')
    );
    // NOTE: the home team strip is NOT wired here — initScrollDots builds one dot
    // per card (39 dots for 39 staff). It's driven by initTeamSlider() below,
    // which pages by the screenful and builds one dot per page.
    initScrollDots(
        document.getElementById('specCards'),
        document.getElementById('specDots'),
        document.getElementById('specWrap')
    );
    initScrollDots(
        document.getElementById('aboutTeamCards'),
        document.getElementById('aboutTeamDots'),
        document.getElementById('aboutTeamWrap')
    );
    initScrollDots(
        document.getElementById('aboutProjCards'),
        document.getElementById('aboutProjDots'),
        document.getElementById('aboutProjWrap')
    );

    // ---- SERVICE CARDS arrow buttons ----
    // (Looping Prev/Next are wired inside the auto-marquee block below, which has the
    // cloned card set + svcHalf needed to wrap seamlessly past either end.)
    var svcCards = document.getElementById('svcCards');
    var svcPrev = document.getElementById('svcPrev');
    var svcNext = document.getElementById('svcNext');

    // ---- SERVICE CARDS auto-marquee (slow leftward cycle) ----
    if (svcCards && svcCards.children.length > 1) {
        // Clone the original card set once so the scroll can wrap seamlessly
        var svcOriginals = Array.prototype.slice.call(svcCards.children);
        svcOriginals.forEach(function (c) { svcCards.appendChild(c.cloneNode(true)); });
        // Snap would jump during continuous motion
        svcCards.style.scrollSnapType = 'none';

        var svcHalf = 0;
        function svcMeasure() { svcHalf = svcCards.scrollWidth / 2; }
        svcMeasure();
        window.addEventListener('resize', svcMeasure);

        var svcPaused = false;
        var svcResumeTimer;
        function svcPauseTemp(ms) {
            svcPaused = true; clearTimeout(svcResumeTimer);
            svcResumeTimer = setTimeout(function () { svcPaused = false; }, ms || 4000);
        }
        svcCards.addEventListener('mouseenter', function () { svcPaused = true; });
        svcCards.addEventListener('mouseleave', function () { svcPaused = false; });
        svcCards.addEventListener('wheel', function () { svcPauseTemp(); }, { passive: true });
        svcCards.addEventListener('touchstart', function () { svcPauseTemp(); }, { passive: true });
        // Looping Prev/Next: animate scrollLeft and wrap into [0, svcHalf) each frame,
        // so the cloned second copy makes the motion seamless past either end.
        var svcAnim = null;
        function svcStep(delta) {
            svcPauseTemp();
            if (svcAnim) { cancelAnimationFrame(svcAnim); }
            var start = svcCards.scrollLeft;
            var t0 = null, dur = 450;
            function frame(t) {
                if (t0 === null) { t0 = t; }
                var p = Math.min((t - t0) / dur, 1);
                var ease = 1 - Math.pow(1 - p, 3);
                var pos = start + delta * ease;
                if (svcHalf > 0) { pos = ((pos % svcHalf) + svcHalf) % svcHalf; }
                svcCards.scrollLeft = pos;
                if (p < 1) { svcAnim = requestAnimationFrame(frame); }
            }
            svcAnim = requestAnimationFrame(frame);
        }
        if (svcPrev) svcPrev.addEventListener('click', function () { svcStep(-356); });
        if (svcNext) svcNext.addEventListener('click', function () { svcStep(356); });

        // Sub-pixel accumulator so very slow motion still progresses each frame
        var svcAccum = 0;
        var svcSpeed = 0.5; // px/frame ≈ 30 px/sec at 60fps
        function svcTick() {
            if (!svcPaused && svcHalf > 0) {
                svcAccum += svcSpeed;
                if (svcAccum >= 1) {
                    var step = Math.floor(svcAccum);
                    svcAccum -= step;
                    var sl = svcCards.scrollLeft + step;
                    if (sl >= svcHalf) sl -= svcHalf;
                    svcCards.scrollLeft = sl;
                }
            }
            requestAnimationFrame(svcTick);
        }
        requestAnimationFrame(svcTick);
    }

    // ---- RIBBON PROJECT CAROUSEL (matching reference) ----
    var ribbonTrack = document.getElementById('ribbonTrack');
    var ribbonPrev = document.getElementById('ribbonPrev');
    var ribbonNext = document.getElementById('ribbonNext');
    var ribbonCounter = document.getElementById('ribbonCounter');
    var ribbon = document.getElementById('ribbon');

    if (ribbonTrack) {
        var DUR = 2000;
        var AUTO_DELAY = 2500;
        var COPIES = 5;
        var IDLE_W, GAP, PAD, STEP;

        // Measure actual pixel values from the DOM — works with vw/px/any unit.
        // The sizer goes INSIDE the ribbon viewport (which is overflow:hidden), not
        // on document.body: appending a var(--r-idle)-wide box to <body> during init
        // could momentarily exceed the mobile viewport width and expand the layout
        // viewport (shifting the fixed nav). The var is inherited, so it resolves the
        // same, and the clip guarantees it can never affect page width.
        function measure() {
            // Host = the .ribbon__viewport (overflow:hidden). A normal-flow, zero-height
            // box here is width-clamped by the viewport and can never overflow the page.
            var host = ribbonTrack.parentElement || ribbonTrack;
            var sizer = document.createElement('div');
            sizer.style.cssText = 'width:var(--r-idle);height:0;visibility:hidden;';
            host.appendChild(sizer);
            IDLE_W = sizer.offsetWidth || 360;
            host.removeChild(sizer);

            var trackStyle = getComputedStyle(ribbonTrack);
            GAP = parseFloat(trackStyle.gap) || 24;
            PAD = parseFloat(getComputedStyle(ribbon || ribbonTrack.parentElement).paddingLeft) || 48;
            STEP = IDLE_W + GAP;
        }
        measure();

        // Clone slides for infinite loop
        var origCards = ribbonTrack.querySelectorAll('.ribbon__card');
        var slideCount = origCards.length;
        var fragment = document.createDocumentFragment();
        for (var copy = 1; copy < COPIES; copy++) {
            origCards.forEach(function (card) {
                fragment.appendChild(card.cloneNode(true));
            });
        }
        ribbonTrack.appendChild(fragment);

        var allCards = ribbonTrack.querySelectorAll('.ribbon__card');
        var startIdx = Math.floor(COPIES / 2) * slideCount;
        var idx = startIdx;
        var jumping = false;
        var rAuto = null;

        // CSS padding-left on viewport handles the left indent
        // Track just needs to slide by idx * STEP
        function getOffset() { return -(idx * STEP); }
        function displayIdx() { return ((idx % slideCount) + slideCount) % slideCount; }

        function render(animate) {
            // Set data-offset on all cards
            allCards.forEach(function (c, i) {
                c.setAttribute('data-offset', i - idx);
            });
            // Slide track
            ribbonTrack.style.transition = animate ? 'transform ' + DUR + 'ms cubic-bezier(.22,1,.36,1)' : 'none';
            ribbonTrack.style.transform = 'translate3d(' + getOffset() + 'px, 0, 0)';
            // Disable card transitions during jump
            if (!animate) {
                allCards.forEach(function (c) { c.style.transition = 'none'; });
                // Re-enable on next frame
                requestAnimationFrame(function () {
                    requestAnimationFrame(function () {
                        allCards.forEach(function (c) { c.style.transition = ''; });
                    });
                });
            }
            // Counter
            if (ribbonCounter) ribbonCounter.textContent = (displayIdx() + 1) + '\u2014' + slideCount;
        }

        // Re-anchor when near edges (silent jump, no animation)
        function reanchor() {
            var low = slideCount;
            var high = (COPIES - 1) * slideCount - 1;
            if (idx < low || idx > high) {
                jumping = true;
                var delta = idx < low ? slideCount : -slideCount;
                idx += delta;
                render(false);
                jumping = false;
            }
        }

        function goTo(newIdx) {
            if (jumping) return;
            idx = newIdx;
            render(true);
            // After transition, check if we need to re-anchor
            setTimeout(reanchor, DUR + 50);
        }

        // Click any card
        allCards.forEach(function (c, i) {
            c.addEventListener('click', function () {
                if (i !== idx) { goTo(i); resetAuto(); }
            });
        });

        if (ribbonPrev) ribbonPrev.addEventListener('click', function () { goTo(idx - 1); resetAuto(); });
        if (ribbonNext) ribbonNext.addEventListener('click', function () { goTo(idx + 1); resetAuto(); });

        // Auto-advance
        function startAuto() {
            clearInterval(rAuto);
            rAuto = setInterval(function () { goTo(idx + 1); }, AUTO_DELAY);
        }
        function resetAuto() {
            clearInterval(rAuto);
            setTimeout(startAuto, AUTO_DELAY);
        }
        if (ribbon) {
            ribbon.addEventListener('mouseenter', function () { clearInterval(rAuto); });
            ribbon.addEventListener('mouseleave', function () { startAuto(); });
        }

        // Handle resize — re-measure actual pixel sizes and reposition
        var resizeTimer;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                measure();
                render(false);
            }, 100);
        });

        // Init
        render(false);
        startAuto();
    }

    // ---- TEAM: hover bio reveal ----
    document.querySelectorAll('.team-card').forEach(function (card) {
        var bio = card.querySelector('.team-card__bio');
        if (!bio) return;
        card.addEventListener('mouseenter', function () {
            bio.style.height = bio.scrollHeight + 'px';
            bio.style.opacity = '1';
        });
        card.addEventListener('mouseleave', function () {
            bio.style.height = '0';
            bio.style.opacity = '0';
        });
    });

    // ---- TEAM: paged slider (arrows + page dots + drag + keyboard) ----
    // The old version scrolled a flat 300px per arrow click while cards are 276px
    // wide (260 + 20 gap), so every click drifted further out of alignment, and the
    // shared dots helper emitted one dot per staff member. This pages by whole
    // screenfuls instead: arrows and dots both land on exact card boundaries, and
    // the ends wrap around so the arrows are never dead.
    function initTeamSlider() {
        var track = document.getElementById('teamCards');
        var dotsEl = document.getElementById('teamDots');
        var wrapEl = document.getElementById('teamWrap');
        var prevBtn = document.getElementById('teamPrev');
        var nextBtn = document.getElementById('teamNext');
        if (!track || !track.children.length) return;

        function t(k) { return (window.CC_I18N && window.CC_I18N.t) ? window.CC_I18N.t(k) : k; }

        var page = 0, pages = 1, stride = 0, maxLeft = 0, dotCount = 0, unit = 0, perPage = 1;

        // Only so many dots read as a row rather than a smear. Above the cap they
        // become a proportional progress scrubber — each dot jumps to the page it
        // sits over. This matters most on phones, where a single 180px card fills
        // the track, so 39 staff = 39 pages and a 1:1 dot row is unusable.
        var MAX_DOTS = 10;
        function pageForDot(i) { return pages < 2 ? 0 : Math.round(i * (pages - 1) / (dotCount - 1)); }
        function dotForPage(p) { return pages < 2 ? 0 : Math.round(p * (dotCount - 1) / (pages - 1)); }

        // Card width + gap are set in CSS and change across breakpoints, so read
        // them back from the DOM rather than hardcoding a step.
        function measure() {
            var cs = getComputedStyle(track);
            var gap = parseFloat(cs.columnGap || cs.gap) || 0;
            var u = track.children[0].getBoundingClientRect().width + gap;
            if (!u) return false;
            unit = u;
            perPage = Math.max(1, Math.floor((track.clientWidth + gap) / unit));
            stride = perPage * unit;
            pages = Math.max(1, Math.ceil(track.children.length / perPage));
            dotCount = Math.min(pages, MAX_DOTS);
            maxLeft = Math.max(0, track.scrollWidth - track.clientWidth);
            return true;
        }

        function buildDots() {
            if (!dotsEl) return;
            dotsEl.innerHTML = '';
            if (pages < 2) return;
            for (var i = 0; i < dotCount; i++) {
                var d = document.createElement('button');
                d.type = 'button';
                d.className = 'scroll-dot' + (i === dotForPage(page) ? ' scroll-dot--active' : '');
                d.setAttribute('aria-label', t('slider_page') + ' ' + (pageForDot(i) + 1) + ' / ' + pages);
                d.dataset.idx = i;
                dotsEl.appendChild(d);
            }
        }

        function paint() {
            if (!dotsEl) return;
            var active = dotForPage(page);
            var dots = dotsEl.querySelectorAll('.scroll-dot');
            for (var i = 0; i < dots.length; i++) {
                dots[i].classList.toggle('scroll-dot--active', i === active);
                dots[i].setAttribute('aria-current', i === active ? 'true' : 'false');
            }
            // No scroll-wrap--ended toggle here: initScrollDots sets that class for
            // an end-of-strip fade, but no rule for it exists anywhere in style.css.
            // Setting it would cost a layout-forcing scrollLeft read on every paint
            // — and read the pre-scroll position anyway, since paint() runs
            // synchronously after a smooth scrollTo() has only just been queued.
        }

        // Wraps at both ends, so neither arrow is ever a no-op.
        function goTo(i, smooth) {
            if (!stride && !measure()) return;   // never measured (hidden at load) — retry now
            // Past either end we cut straight back rather than animate: smooth-
            // scrolling the full 39-card width reads as a violent blur, and at a
            // 1.5s autoplay beat it would still be moving when the next tick fires.
            var wrapped = (i < 0 || i >= pages);
            if (i < 0) i = pages - 1;
            if (i >= pages) i = 0;
            page = i;
            track.scrollTo({
                left: Math.min(i * stride, maxLeft),
                // scrollTo({behavior:'smooth'}) is NOT suppressed by the OS
                // reduce-motion setting the way CSS scroll-behavior is, so an
                // arrow click would still animate a full ~1100px slide. Cut.
                behavior: (smooth === false || wrapped || reduceMotion) ? 'auto' : 'smooth'
            });
            paint();
        }

        function syncFromScroll() {
            if (!stride) return;
            // The final page is a partial one, so its scroll position is clamped to
            // maxLeft — well short of (pages-1)*stride. Rounding alone reads that
            // back as the page BEFORE last, which would leave autoplay ticking
            // between the two forever instead of wrapping. Being at the end of the
            // track is what defines the last page.
            page = (track.scrollLeft >= maxLeft - 1)
                ? pages - 1
                : Math.max(0, Math.min(pages - 1, Math.round(track.scrollLeft / stride)));
            paint();
        }

        measure();
        buildDots();
        paint();

        /* ---- autoplay: advance a page every 1.5s, wrapping at the end ----
           Stops while the visitor is looking at it: hover on desktop, tap on
           touch. Also stops on a deliberate interaction (4s), a backgrounded tab,
           and the section being off-screen. */
        var AUTO_MS = 1500;
        var RESUME_MS = 4000;   // matches the services marquee's pause-after-touch
        var autoTimer = null, onScreen = false, focused = false, held = false, holdTimer;
        var pointerOver = false;   // desktop: cursor is on the slider
        var tapPaused = false;     // touch: tapped to stop (tap again to resume)
        /* Watched, not sampled once: a visitor who turns reduce-motion on
           mid-session would otherwise keep the 1.5s autoplay until they reload. */
        var rmQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
        var reduceMotion = !!(rmQuery && rmQuery.matches);
        if (rmQuery && rmQuery.addEventListener) {
            rmQuery.addEventListener('change', function (e) {
                reduceMotion = e.matches;
                if (reduceMotion) { stopAuto(); } else { startAuto(); }
            });
        }

        function tick() {
            if (pointerOver || tapPaused || focused || held || document.hidden || !onScreen) return;
            goTo(page + 1);
        }
        function startAuto() {
            if (autoTimer || reduceMotion || pages < 2) return;
            autoTimer = setInterval(tick, AUTO_MS);
        }
        function stopAuto() { clearInterval(autoTimer); autoTimer = null; }
        // Any deliberate move (arrow, dot, key, swipe, drag) holds autoplay off
        // briefly so it doesn't yank the strip out from under someone mid-browse.
        function hold() {
            held = true;
            clearTimeout(holdTimer);
            holdTimer = setTimeout(function () { held = false; }, RESUME_MS);
        }

        /* Keyboard focus parks it indefinitely — that's the stop mechanism
           keyboard-only visitors can actually reach (WCAG 2.2.2), since they
           can't hover. Bound to the TRACK, not the section: focusin on the
           section meant clicking an arrow left the button focused and autoplay
           dead for good, because nothing ever moved focus back out. mousedown on
           the track preventDefault()s, so a mouse click never focuses it either. */
        var sectionEl = document.getElementById('team') || wrapEl;

        /* Keyboard focus parks it indefinitely — the stop mechanism keyboard-only
           visitors can reach (WCAG 2.2.2). Bound on the section so it covers the
           dots and arrows, which sit OUTSIDE the track: tabbing onto a dot used to
           leave the strip jumping every 1.5s under the very control you were
           aiming at. Gated on :focus-visible so a MOUSE click on an arrow doesn't
           latch it — that fires focusin too, and nothing would ever move focus
           back out, which killed autoplay outright in an earlier revision. */
        function keyboardFocused(el) {
            if (!el || !el.matches) { return false; }
            try { return el.matches(':focus-visible'); }
            catch (e) { return true; }   // no :focus-visible support — err on pausing
        }
        if (sectionEl) {
            sectionEl.addEventListener('focusin', function (e) { focused = keyboardFocused(e.target); });
            sectionEl.addEventListener('focusout', function () { focused = false; });
        }

        /* Hover pause, scoped to the slider itself — the card strip, its dots and
           the two arrows — NOT the whole #team section, which is a full-width
           ~600px band including the heading and its padding. Pausing on all of it
           meant a visitor who had merely scrolled the section into view was
           usually resting the cursor somewhere inside, so it never moved.

           Keyed on pointerType rather than a (hover: hover) media query: a
           touchscreen laptop reports hover:hover, so a query would bind the hover
           branch AND skip tap-to-pause, and a finger tap there fires a synthetic
           enter with no matching leave — autoplay stuck with no way back. Reading
           the actual pointer that generated the event gets both inputs right on
           the same device. */
        var hoverEvents = ('PointerEvent' in window)
            ? { enter: 'pointerenter', leave: 'pointerleave', mouseOnly: true }
            : { enter: 'mouseenter', leave: 'mouseleave', mouseOnly: false };
        [wrapEl, prevBtn, nextBtn].forEach(function (el) {
            if (!el) return;
            el.addEventListener(hoverEvents.enter, function (e) {
                if (!hoverEvents.mouseOnly || e.pointerType === 'mouse') pointerOver = true;
            });
            el.addEventListener(hoverEvents.leave, function (e) {
                if (!hoverEvents.mouseOnly || e.pointerType === 'mouse') pointerOver = false;
            });
        });

        /* Touch: a tap on the cards stops it, another tap starts it again. Tracked
           through the touch events rather than click so a swipe — or a page scroll
           that happens to start on a card — isn't mistaken for a tap. Bound
           unconditionally so hybrid devices get it alongside hover. */
        {
            var tapX = 0, tapY = 0, tapMoved = false;
            track.addEventListener('touchstart', function (e) {
                var p = e.touches[0];
                if (!p) return;
                tapX = p.clientX; tapY = p.clientY; tapMoved = false;
            }, { passive: true });
            track.addEventListener('touchmove', function (e) {
                var p = e.touches[0];
                if (!p) return;
                if (Math.abs(p.clientX - tapX) > 8 || Math.abs(p.clientY - tapY) > 8) tapMoved = true;
            }, { passive: true });
            track.addEventListener('touchend', function () {
                if (tapMoved) return;
                tapPaused = !tapPaused;
                // The touchstart above also fires hold(). Left alone, a tap meant
                // to RESUME would sit still for another 4s and read as the tap
                // having done nothing — so clear the hold when un-pausing.
                if (!tapPaused) { held = false; clearTimeout(holdTimer); }
            }, { passive: true });
        }

        if (sectionEl && 'IntersectionObserver' in window) {
            new IntersectionObserver(function (entries) {
                // LAST record, not the first: a fast flick past the section can
                // queue an enter and a leave in one callback batch, and reading
                // entries[0] latches the stale one — leaving autoplay either dead
                // on a section sitting in view, or ticking on one that isn't.
                onScreen = entries[entries.length - 1].isIntersecting;
            }, { threshold: 0.15 }).observe(sectionEl);
        } else {
            onScreen = true;   // no IO support — just run
        }

        // A background tab throttles timers and fires them in a burst on return;
        // dropping the interval while hidden avoids that catch-up lurch.
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) { stopAuto(); } else { startAuto(); }
        });

        startAuto();

        /* One place that re-derives metrics after a reflow, so every caller gets
           the same rebuild guard and the same autoplay bookkeeping.

           Keeps the leftmost VISIBLE CARD, not the page index. perPage changes at
           the 900/600px breakpoints, so page 3 is cards 12-15 at one width and
           cards 6-7 at another — preserving the index alone throws the reader
           backwards past six people with no visible cause. */
        function remeasure() {
            var leadingCard = unit ? Math.round(track.scrollLeft / unit) : 0;
            var wasPages = pages, wasDots = dotCount;
            if (!measure()) return false;
            if (pages !== wasPages || dotCount !== wasDots) buildDots();
            page = Math.max(0, Math.min(pages - 1, Math.floor(leadingCard / perPage)));
            goTo(page, false);
            // A first measure() that failed leaves pages at 1, so startAuto() bails
            // and nothing ever retried it — autoplay was dead with no recovery.
            if (pages < 2) { stopAuto(); } else { startAuto(); }
            return true;
        }

        /* Card widths come from CSS, so the initial measure is normally right —
           but a webfont swap can reflow the strip. NOT hung off window's load
           event: app.js injects main.js only after the CMS fetch resolves, by
           which point load has almost always already fired, so that listener would
           never run. fonts.ready resolves either way. */
        if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
            document.fonts.ready.then(remeasure).catch(function () {});
        }

        if (prevBtn) prevBtn.addEventListener('click', function () { hold(); goTo(page - 1); });
        if (nextBtn) nextBtn.addEventListener('click', function () { hold(); goTo(page + 1); });

        if (dotsEl) dotsEl.addEventListener('click', function (e) {
            var dot = e.target.closest('.scroll-dot');
            if (dot) { hold(); goTo(pageForDot(parseInt(dot.dataset.idx, 10))); }
        });

        track.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowRight') { e.preventDefault(); hold(); goTo(page + 1); }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); hold(); goTo(page - 1); }
        });

        // A touch swipe is a deliberate move that never reaches the handlers above
        // — it just scrolls the container natively. Wheel events are NOT included:
        // scrolling the page with the cursor over the strip fires wheel on the
        // track, so holding on it meant autoplay was suppressed for 4s every time
        // someone simply scrolled past the section.
        track.addEventListener('touchstart', hold, { passive: true });

        // Native scroll (touch swipe, trackpad, drag below) only moves the
        // viewport — settle the page index once it stops so the dots agree.
        var settle;
        track.addEventListener('scroll', function () {
            clearTimeout(settle);
            settle = setTimeout(syncFromScroll, 90);
        }, { passive: true });

        // Mouse drag. Snapping is suspended mid-drag so the strip tracks the
        // cursor 1:1, then restored on release so it settles on a card edge.
        var dragging = false, startX = 0, startLeft = 0, moved = false;
        track.addEventListener('mousedown', function (e) {
            if (e.button !== 0) return;
            hold();
            dragging = true; moved = false;
            startX = e.clientX; startLeft = track.scrollLeft;
            track.style.scrollSnapType = 'none';
            track.style.cursor = 'grabbing';
            e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            var dx = startX - e.clientX;
            if (Math.abs(dx) > 3) moved = true;
            track.scrollLeft = startLeft + dx;
        });
        function endDrag() {
            if (!dragging) return;
            dragging = false;
            track.style.scrollSnapType = '';
            track.style.cursor = '';
            // The `stride &&` guard matters: if the first measure() failed, stride
            // is 0 and Math.round(0/0) is NaN. goTo(NaN) passes its re-measure
            // guard, then fails every comparison, so page becomes NaN and the
            // slider is stuck at scroll 0 for good — arrows and autoplay included.
            if (moved && stride) goTo(Math.round(track.scrollLeft / stride));
        }
        document.addEventListener('mouseup', endDrag);
        // Releasing outside the window never fires document.mouseup, which would
        // leave dragging latched on and scroll-snap disabled: after that, merely
        // moving the mouse anywhere on the page would drag the strip.
        document.addEventListener('mouseleave', endDrag);
        window.addEventListener('blur', endDrag);

        var rt;
        window.addEventListener('resize', function () {
            clearTimeout(rt);
            rt = setTimeout(remeasure, 150);
        });
    }
    initTeamSlider();

    // ---- ABOUT PROJECTS: drag to scroll + arrow buttons ----
    var aboutProjCards = document.getElementById('aboutProjCards');
    var aboutProjPrev = document.getElementById('aboutProjPrev');
    var aboutProjNext = document.getElementById('aboutProjNext');
    if (aboutProjCards) {
        if (aboutProjPrev) aboutProjPrev.addEventListener('click', function () {
            aboutProjCards.scrollBy({ left: -300, behavior: 'smooth' });
        });
        if (aboutProjNext) aboutProjNext.addEventListener('click', function () {
            aboutProjCards.scrollBy({ left: 300, behavior: 'smooth' });
        });
        var apDrag = false, apX = 0, apSL = 0;
        aboutProjCards.addEventListener('mousedown', function (e) {
            apDrag = true; apX = e.clientX; apSL = aboutProjCards.scrollLeft;
            aboutProjCards.style.cursor = 'grabbing'; e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!apDrag) return;
            aboutProjCards.scrollLeft = apSL + (apX - e.clientX);
        });
        document.addEventListener('mouseup', function () {
            if (apDrag) { apDrag = false; aboutProjCards.style.cursor = 'grab'; }
        });
    }

    // ---- ABOUT TEAM: drag to scroll + arrow buttons ----
    var aboutTeamCards = document.getElementById('aboutTeamCards');
    var aboutTeamPrev = document.getElementById('aboutTeamPrev');
    var aboutTeamNext = document.getElementById('aboutTeamNext');
    if (aboutTeamCards) {
        if (aboutTeamPrev) aboutTeamPrev.addEventListener('click', function () {
            aboutTeamCards.scrollBy({ left: -300, behavior: 'smooth' });
        });
        if (aboutTeamNext) aboutTeamNext.addEventListener('click', function () {
            aboutTeamCards.scrollBy({ left: 300, behavior: 'smooth' });
        });
        var atDrag = false, atX = 0, atSL = 0;
        aboutTeamCards.addEventListener('mousedown', function (e) {
            atDrag = true; atX = e.clientX; atSL = aboutTeamCards.scrollLeft;
            aboutTeamCards.style.cursor = 'grabbing'; e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!atDrag) return;
            aboutTeamCards.scrollLeft = atSL + (atX - e.clientX);
        });
        document.addEventListener('mouseup', function () {
            if (atDrag) { atDrag = false; aboutTeamCards.style.cursor = 'grab'; }
        });
    }

    // ---- SPECIALISTS: drag to scroll + arrow buttons ----
    var specCards = document.getElementById('specCards');
    var specPrev = document.getElementById('specPrev');
    var specNext = document.getElementById('specNext');
    if (specCards) {
        if (specPrev) specPrev.addEventListener('click', function () {
            specCards.scrollBy({ left: -300, behavior: 'smooth' });
        });
        if (specNext) specNext.addEventListener('click', function () {
            specCards.scrollBy({ left: 300, behavior: 'smooth' });
        });
        var sDrag = false, sX = 0, sSL = 0;
        specCards.addEventListener('mousedown', function (e) {
            sDrag = true; sX = e.clientX; sSL = specCards.scrollLeft;
            specCards.style.cursor = 'grabbing'; e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!sDrag) return;
            specCards.scrollLeft = sSL + (sX - e.clientX);
        });
        document.addEventListener('mouseup', function () {
            if (sDrag) { sDrag = false; specCards.style.cursor = 'grab'; }
        });
    }

    // ---- ABOUT TIMELINE SCROLL-FILL ----
    var timeline = document.getElementById('aboutTimeline');
    var tlFill = document.getElementById('tlFill');
    if (timeline && tlFill) {
        var tlItems = timeline.querySelectorAll('.about-tl');
        function updateTimeline() {
            var rect = timeline.getBoundingClientRect();
            var timelineTop = timeline.offsetTop;
            var timelineH = timeline.offsetHeight;
            // How far the viewport center has traveled through the timeline
            var scrollCenter = window.scrollY + window.innerHeight * 0.45;
            var progress = (scrollCenter - timelineTop) / timelineH;
            progress = Math.min(Math.max(progress, 0), 1);
            tlFill.style.height = (progress * timelineH) + 'px';
            // Mark items as reached
            tlItems.forEach(function (item) {
                var itemTop = item.offsetTop + timelineTop;
                if (scrollCenter >= itemTop) {
                    item.classList.add('about-tl--reached');
                } else {
                    item.classList.remove('about-tl--reached');
                }
            });
        }
        window.addEventListener('scroll', updateTimeline, { passive: true });
        updateTimeline();
    }

    // ---- ABOUT PAGE SCROLLSPY ----
    var spyLinks = document.querySelectorAll('[data-spy]');
    if (spyLinks.length) {
        var spySections = [];
        spyLinks.forEach(function (link) {
            var sec = document.getElementById(link.dataset.spy);
            if (sec) spySections.push({ el: sec, link: link });
        });
        function updateSpy() {
            var scrollY = window.scrollY + 160;
            var active = spySections[0];
            for (var i = 0; i < spySections.length; i++) {
                if (spySections[i].el.offsetTop <= scrollY) active = spySections[i];
            }
            spyLinks.forEach(function (l) { l.classList.remove('about-sidebar__link--active'); });
            if (active) active.link.classList.add('about-sidebar__link--active');
        }
        window.addEventListener('scroll', updateSpy, { passive: true });
        updateSpy();
    }

    // ---- BACK TO TOP ----
    var btt = document.getElementById('btt');
    if (btt) {
        window.addEventListener('scroll', function () {
            btt.classList.toggle('btt--visible', window.scrollY > 600);
        }, { passive: true });
        btt.addEventListener('click', function () {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // ---- SMOOTH SCROLL for anchors ----
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
        a.addEventListener('click', function (e) {
            var h = a.getAttribute('href');
            if (h === '#') return;
            var t = document.querySelector(h);
            if (t) {
                e.preventDefault();
                // Close mobile nav if open
                if (mobNav && mobNav.classList.contains('mob-nav--open')) {
                    mobNav.classList.remove('mob-nav--open');
                    if (burger) burger.classList.remove('nav__burger--open');
                    document.body.style.overflow = '';
                }
                window.scrollTo({ top: t.offsetTop - 80, behavior: 'smooth' });
            }
        });
    });

    // ---- STAFF VIDEOS: play on hover only ----
    // First-frame visibility: Safari (and Chrome inconsistently) won't paint the
    // first frame of a paused video with preload="metadata" — it stays a blank
    // box until something tells it to render a frame. Two-step fix:
    //   1. When the team section is about to enter the viewport, bump preload
    //      to "auto" so the video data downloads (avoid eager-load when the
    //      visitor never scrolls there).
    //   2. On `canplay`, seek currentTime to a hair past zero. Safari/Chrome
    //      both decode and paint the seeked frame even while paused, so the
    //      poster-like first-frame appears with no `poster` attribute needed.
    document.querySelectorAll('.team-card__img video, .team-grid__img video').forEach(function (v) {
        v.pause();
        var primeFirstFrame = function () {
            // 0.05s avoids Safari edge-case where currentTime=0 doesn't trigger a paint
            try { v.currentTime = 0.05; } catch (e) {}
        };
        if (v.readyState >= 2) {
            primeFirstFrame();
        } else {
            v.addEventListener('loadeddata', primeFirstFrame, { once: true });
            v.addEventListener('canplay', primeFirstFrame, { once: true });
        }
        var card = v.closest('.team-card, .team-grid__card') || v.parentElement;
        card.addEventListener('mouseenter', function () { var p = v.play(); if (p && p.catch) { p.catch(function () {}); } });
        card.addEventListener('mouseleave', function () { v.pause(); v.currentTime = 0.05; });
    });

    // First-frame paint strategy — the whole point of this block is that mobile
    // Safari (WebKit) renders a blank rectangle for a paused <video> with
    // preload="metadata" until *something* actually decodes and paints a frame.
    // The seek-to-0.05 trick works on desktop Chrome/Firefox but does nothing on
    // iOS: WebKit strictly honors preload="metadata" (zero frame bytes fetched)
    // AND ignores runtime preload="auto" flips (they don't re-trigger fetch).
    //
    // Reliable idiom on iOS: **play-then-pause dance**. With muted + playsinline
    // + autoplay-allowed context, calling .play() forces WebKit to buffer + decode
    // + composite a frame. We immediately pause. Net effect: the frame stays on
    // screen, video is paused, everything below the fold quietly primes as its
    // section scrolls into view.
    //
    // Observation is per CARD, rooted on the scroll container when there is one
    // (see primeContainerProgressively below) — a viewport-rooted per-video
    // observer never fires for cards parked past a horizontal strip's right edge,
    // which is why this was originally written at section level instead.
    function primeVideoForPaint(v) {
        // A poster paints the first frame for free, so there is nothing to force.
        // Priming anyway would download the clip purely to show a frame the poster
        // is already showing — the whole point of emitting poster= in render.js.
        if (v.getAttribute('poster')) return;
        // Explicit .load() forces WebKit to re-evaluate preload = "auto".
        try { v.preload = 'auto'; v.load(); } catch (e) {}
        var done = false;
        var finish = function () {
            if (done) return; done = true;
            try {
                v.pause();
                // Seek slightly forward so the paused frame is a proper decoded
                // frame, not the first-byte black.
                v.currentTime = 0.05;
            } catch (e) {}
        };
        var attemptPlay = function () {
            if (done) return;
            var p = v.play();
            if (p && p.then) {
                p.then(function () {
                    // Give WebKit ~1-2 frames to paint, then pause.
                    setTimeout(finish, 60);
                }).catch(function () {
                    // Autoplay blocked (very rare when muted+playsinline).
                    // Fall back to plain seek — better than nothing.
                    try { v.currentTime = 0.05; } catch (e) {}
                });
            } else {
                // No promise (older browsers) — just seek and hope.
                try { v.currentTime = 0.05; } catch (e) {}
            }
        };
        if (v.readyState >= 2) attemptPlay();
        else v.addEventListener('loadeddata', attemptPlay, { once: true });
    }

    /* Prime CARD BY CARD, not the whole section at once. Priming is deliberately
       expensive per video — preload="auto" + .load() + .play() + .pause() — and
       the section holds 39 of them. Firing all 39 together meant 39 MP4s fighting
       over a 6-connection pool and the video decoder the moment the section came
       into view, which is exactly when the home slider is trying to animate. That
       storm is what made it stutter.

       The strip is a horizontal scroller, so a viewport-rooted observer never
       fires for cards parked past its right edge (the reason this was written at
       section level originally). Rooting the observer ON the scroller fixes that:
       cards prime as they page into view, a handful at a time. */
    function primeContainerProgressively(container) {
        var horizontal = container.scrollWidth > container.clientWidth + 1;
        var cardObserver = new IntersectionObserver(function (entries, obs) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.querySelectorAll('video').forEach(primeVideoForPaint);
                obs.unobserve(entry.target);
            });
        }, horizontal ? { root: container, rootMargin: '200px' } : { rootMargin: '300px' });
        Array.prototype.forEach.call(container.children, function (card) { cardObserver.observe(card); });
    }

    var teamContainers = document.querySelectorAll('.team, .team-grid');
    var allTeamVideos = document.querySelectorAll('.team-card__img video, .team-grid__img video');
    if (teamContainers.length && 'IntersectionObserver' in window) {
        // Outer gate stays: nothing loads at all until the section nears the
        // viewport, so a visitor who never scrolls down pays nothing.
        var teamSectionObserver = new IntersectionObserver(function (entries, obs) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                var strip = entry.target.querySelector('.team__cards') || entry.target;
                primeContainerProgressively(strip);
                obs.unobserve(entry.target);
            });
        }, { rootMargin: '300px' });
        teamContainers.forEach(function (c) { teamSectionObserver.observe(c); });
    } else {
        // No IO support → prime all videos immediately
        allTeamVideos.forEach(primeVideoForPaint);
    }

    // ---- PROJECTS HUD HERO (cycling) ----
    var projHud = document.getElementById('projHud');
    if (projHud) {
        var hudData = [];
        try { hudData = JSON.parse((document.getElementById('projHudData') || {}).textContent || '[]'); } catch (e) {}
        if (hudData.length) {
            var hIdx = 0, hCount = hudData.length;
            var hImg = document.getElementById('projHudImg');
            var hCounter = document.getElementById('projHudCounter');
            var pad = function (n) { return ('0' + n).slice(-2); };
            var setT = function (id, v) { var el = document.getElementById(id); if (el) el.textContent = v || ''; };
            var hudRender = function () {
                var p = hudData[hIdx];
                if (hImg) { hImg.src = p.image; hImg.alt = p.name || ''; }
                if (hCounter) hCounter.textContent = pad(hIdx + 1) + ' / ' + pad(hCount);
                setT('projHudName', p.name); setT('projHudTag', p.tag); setT('projHudClient', p.client);
                setT('projHudCat', p.cat); setT('projHudArea', p.area); setT('projHudYear', p.year);
                var btn = projHud.querySelector('.proj-hero-hud__btn');
                if (btn && p.slug) btn.setAttribute('href', 'project.html?slug=' + encodeURIComponent(p.slug));
                var pins = [p.tag, p.area, p.status].filter(Boolean);
                setT('pinLabel1', pins[0]); setT('pinLabel2', pins[1]); setT('pinLabel3', pins[2]);
            };
            hudRender();
            var hPrev = document.getElementById('projHudPrev'), hNext = document.getElementById('projHudNext');
            var hStep = function (dir) { hIdx = (hIdx + dir + hCount) % hCount; hudRender(); };
            if (hPrev) hPrev.addEventListener('click', function () { hStep(-1); });
            if (hNext) hNext.addEventListener('click', function () { hStep(1); });
            var hAuto = setInterval(function () { hStep(1); }, 6000);
            projHud.addEventListener('mouseenter', function () { clearInterval(hAuto); });
            projHud.addEventListener('mouseleave', function () { hAuto = setInterval(function () { hStep(1); }, 6000); });
        }
    }

    // ---- ABOUT projects-preview grid (filled from WP) ----
    var aboutProjGrid = document.getElementById('aboutProjGrid');
    if (aboutProjGrid && window.CC_CMS) {
        CC_CMS.projects().then(function (list) {
            if (!list || !list.length) { return; }
            aboutProjGrid.innerHTML = list.slice(0, 3).map(function (p) {
                return '<a href="project.html?slug=' + encodeURIComponent(p.slug || '') + '" class="about-proj-card">' +
                    '<img src="' + (p.image || '') + '" alt="' + (p.name || '') + '" loading="lazy">' +
                    '<div class="about-proj-card__info"><span>' + (p.tag || '') + '</span><h4>' + (p.name || '') + '</h4></div></a>';
            }).join('');
        });
    }

})();
