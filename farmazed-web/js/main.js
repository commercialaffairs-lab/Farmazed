/* ═══════════════════════════════════════════════
   FARMAZED — Main JavaScript
   Runs after WeCare jQuery / script.js / core.js
═══════════════════════════════════════════════ */

$(document).ready(function () {

    /* ── MOBILE NAV DROPDOWN TOGGLE ── */
    if ($(window).width() <= 768) {
        var $navItems = $('#navlist.sf-menu > li');

        // Mark items that have a sub-menu
        $navItems.each(function () {
            if ($(this).find('> .sub-menu').length) {
                $(this).addClass('fz-has-sub');
            }
        });

        // First tap: open sub-menu. Second tap (already open): navigate.
        $navItems.filter('.fz-has-sub').find('> a').on('click', function (e) {
            var $li = $(this).closest('li');
            if (!$li.hasClass('fz-open')) {
                e.preventDefault();
                $navItems.removeClass('fz-open');
                $li.addClass('fz-open');
            }
            // if already open, let the href navigate normally
        });

        // Close open menu when clicking outside
        $(document).on('click', function (e) {
            if (!$(e.target).closest('#navlist').length) {
                $navItems.removeClass('fz-open');
            }
        });
    }

    /* ── SMOOTH SCROLL for all anchor links ── */
    $('a[href^="#"]').on('click', function (e) {
        var href = this.getAttribute('href');
        if (href.length < 2) return; // href="#" a secas: jQuery 3 lanza error de sintaxis (jQuery 1.8 devolvía un conjunto vacío)
        var target = $(href);
        if (!target.length) return;
        e.preventDefault();
        $('html, body').animate({
            scrollTop: target.offset().top - 80
        }, 600);
    });

    /* ── HERO CONSULTATION FORM (WeCare: #contact-form2) ── */
    $('#contact-form2').on('submit', function (e) {
        e.preventDefault();
        var btn = $('#submit_contact2');
        var orig = btn.val();
        btn.val('✓ Enviado — le contactamos pronto').prop('disabled', true);
        setTimeout(function () {
            $('#contact-form2')[0].reset();
            btn.val(orig).prop('disabled', false);
            $('#msg2').text('');
        }, 4000);
    });

    /* ── COUNTER ANIMATION (for future stats section) ── */
    if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting && !entry.target.classList.contains('counted')) {
                    entry.target.classList.add('counted');
                    var el = entry.target;
                    var target = parseInt(el.getAttribute('data-target'), 10);
                    var step = target / (1800 / 16);
                    var current = 0;
                    var timer = setInterval(function () {
                        current += step;
                        if (current >= target) { current = target; clearInterval(timer); }
                        el.textContent = Math.floor(current);
                    }, 16);
                }
            });
        }, { threshold: 0.5 });
        document.querySelectorAll('.counter').forEach(function (c) { io.observe(c); });
    }

});
