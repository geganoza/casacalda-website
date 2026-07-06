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
    initScrollDots(
        document.getElementById('teamCards'),
        document.getElementById('teamDots'),
        document.getElementById('teamWrap')
    );
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

    // ---- TEAM: drag to scroll + arrow buttons ----
    var teamCards = document.getElementById('teamCards');
    var teamPrev = document.getElementById('teamPrev');
    var teamNext = document.getElementById('teamNext');
    if (teamCards) {
        if (teamPrev) teamPrev.addEventListener('click', function () {
            teamCards.scrollBy({ left: -300, behavior: 'smooth' });
        });
        if (teamNext) teamNext.addEventListener('click', function () {
            teamCards.scrollBy({ left: 300, behavior: 'smooth' });
        });
        // Drag
        var tDrag = false, tX = 0, tSL = 0;
        teamCards.addEventListener('mousedown', function (e) {
            tDrag = true; tX = e.clientX; tSL = teamCards.scrollLeft;
            teamCards.style.cursor = 'grabbing'; e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!tDrag) return;
            teamCards.scrollLeft = tSL + (tX - e.clientX);
        });
        document.addEventListener('mouseup', function () {
            if (tDrag) { tDrag = false; teamCards.style.cursor = 'grab'; }
        });
    }

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

    // Lazy-promote preload metadata→auto and paint the first frame by observing
    // the section CONTAINER, not each video. This is essential for mobile:
    //   - iOS Safari + iOS Chrome (both WebKit) strictly honor preload="metadata"
    //     and fetch zero frame bytes, so a currentTime seek can't paint anything.
    //   - The About page uses a horizontal team-grid scroller; cards past the
    //     viewport's right edge never individually intersect, so per-video
    //     observation would leave them blank forever on mobile.
    // Observing the section means every video inside gets promoted the moment
    // the section itself intersects — regardless of individual card position.
    // (Prior implementation at commit 3523767 observed individual videos and
    // caused this exact regression; reverting per the 2026-07-06 investigation.)
    var teamContainers = document.querySelectorAll('.team, .team-grid');
    var allTeamVideos = document.querySelectorAll('.team-card__img video, .team-grid__img video');
    if (teamContainers.length && 'IntersectionObserver' in window) {
        var teamSectionObserver = new IntersectionObserver(function (entries, obs) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.querySelectorAll('video').forEach(function (v) {
                    if (v.preload !== 'auto') v.preload = 'auto';
                    // Seek a hair past zero so Safari/Chrome paint that frame while paused.
                    var reprime = function () { try { if (v.paused) v.currentTime = 0.05; } catch (e) {} };
                    if (v.readyState >= 2) reprime();
                    else v.addEventListener('loadeddata', reprime, { once: true });
                });
                obs.unobserve(entry.target);
            });
        }, { rootMargin: '300px' });
        teamContainers.forEach(function (c) { teamSectionObserver.observe(c); });
    } else {
        // No IO support → just upgrade preload immediately
        allTeamVideos.forEach(function (v) { v.preload = 'auto'; });
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
