(function () {
    'use strict';

    // ---- NAV SCROLL — same on all pages ----
    var nav = document.getElementById('nav');
    if (nav) {
        // Glass pill → solid bar on scroll. Same logic everywhere.
        window.addEventListener('scroll', function () {
            nav.classList.toggle('nav--scrolled', window.scrollY > 60);
        }, { passive: true });
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

    // ---- STATEMENT WORD SPLIT ----
    var stText = document.getElementById('statementText');
    if (stText) {
        var words = stText.textContent.trim().split(/\s+/);
        var last = words.pop(); // last word gets <em>
        stText.innerHTML = words.map(function (w, i) {
            return '<span class="statement__word" style="transition-delay:' + (i * .07).toFixed(2) + 's">' + w + '</span>';
        }).join(' ') + ' <em><span class="statement__word" style="transition-delay:' + (words.length * .07).toFixed(2) + 's">' + last + '</span></em>';
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

    // ---- SERVICE CARDS arrow buttons ----
    var svcCards = document.getElementById('svcCards');
    var svcPrev = document.getElementById('svcPrev');
    var svcNext = document.getElementById('svcNext');
    if (svcCards && svcPrev && svcNext) {
        svcPrev.addEventListener('click', function () {
            svcCards.scrollBy({ left: -356, behavior: 'smooth' });
        });
        svcNext.addEventListener('click', function () {
            svcCards.scrollBy({ left: 356, behavior: 'smooth' });
        });
    }

    // ---- RIBBON PROJECT CAROUSEL (matching reference) ----
    var ribbonTrack = document.getElementById('ribbonTrack');
    var ribbonPrev = document.getElementById('ribbonPrev');
    var ribbonNext = document.getElementById('ribbonNext');
    var ribbonCounter = document.getElementById('ribbonCounter');
    var ribbon = document.getElementById('ribbon');

    if (ribbonTrack) {
        var DUR = 2000;
        var AUTO_DELAY = 7000;
        var COPIES = 5;
        var IDLE_W, GAP, PAD, STEP;

        // Measure actual pixel values from the DOM — works with vw/px/any unit
        function measure() {
            // Temporarily create a sizer div that inherits the CSS var
            var sizer = document.createElement('div');
            sizer.style.cssText = 'position:absolute;visibility:hidden;width:var(--r-idle);height:0;';
            document.body.appendChild(sizer);
            IDLE_W = sizer.offsetWidth || 360;
            document.body.removeChild(sizer);

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

    // ---- PARTNERS TOGGLE ----
    var partnersToggle = document.getElementById('partnersToggle');
    var partnersWrap = document.getElementById('partnersWrap');
    if (partnersToggle && partnersWrap) {
        partnersToggle.addEventListener('click', function () {
            var open = partnersWrap.classList.toggle('partners-wrap--open');
            partnersToggle.querySelector('.partners-toggle__text').textContent = open ? 'ნაკლების ნახვა' : 'მეტის ნახვა';
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

})();
