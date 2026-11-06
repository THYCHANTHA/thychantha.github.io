/* folio.js - interactions for the THY Chantha portfolio. No dependencies. */
(function () {
  'use strict';

  var doc = document;
  var root = doc.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (sel, ctx) { return (ctx || doc).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); };

  /* ---------- Header: scrolled state + mobile menu ---------- */
  var header = $('#siteHeader');
  var nav = $('#siteNav');
  var toggle = $('#navToggle');

  function onScroll() { if (header) header.classList.toggle('scrolled', window.scrollY > 8); }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  function setMenu(open) {
    if (!nav || !toggle) return;
    nav.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    doc.body.classList.toggle('no-scroll', open);
  }
  if (toggle) {
    toggle.addEventListener('click', function () { setMenu(toggle.getAttribute('aria-expanded') !== 'true'); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setMenu(false); });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) { setMenu(false); toggle.focus(); }
    });
    window.matchMedia('(min-width: 861px)').addEventListener('change', function (e) { if (e.matches) setMenu(false); });
  }

  /* ---------- Split headline into animated words ---------- */
  $$('[data-split]').forEach(function (el) {
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = doc.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(' ')); return; }
            var w = doc.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            var s = doc.createElement('span'); s.textContent = part; s.style.setProperty('--i', i++);
            w.appendChild(s); frag.appendChild(w);
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1) { walk(child); }
      });
    })(el);
    el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  });

  /* ---------- Reveal on scroll ---------- */
  var revealTargets = $$('.reveal, [data-split]');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    revealTargets.forEach(function (el, idx) {
      if (el.classList.contains('reveal') && el.parentElement && el.parentElement.classList.contains('grid-projects')) {
        el.style.setProperty('--d', (idx % 3) * 0.08 + 's');
      }
      io.observe(el);
    });
  } else {
    revealTargets.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Internal links: smooth in-page scroll + page fade ---------- */
  function samePage(url) {
    var a = url.pathname.replace(/index\.php$/, '').replace(/\/$/, '');
    var b = location.pathname.replace(/index\.php$/, '').replace(/\/$/, '');
    return a === b;
  }
  doc.addEventListener('click', function (e) {
    var a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.target || a.hasAttribute('download') || a.hasAttribute('data-project') || a.hasAttribute('data-lightbox')) return;
    var url;
    try { url = new URL(a.href, location.href); } catch (err) { return; }
    if (url.origin !== location.origin) return;
    if (url.hash && samePage(url) && url.search === location.search) {
      var target = doc.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
        history.replaceState(null, '', url.hash);
        if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
      return;
    }
    if (!reduceMotion && !/\.(pdf|zip|jpe?g|png|webp)$/i.test(url.pathname)) {
      e.preventDefault();
      root.classList.add('leaving');
      setTimeout(function () { location.href = a.href; }, 240);
    }
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) root.classList.remove('leaving'); });

  /* ---------- Horizontal sliders ---------- */
  $$('[data-slider]').forEach(function (track) {
    var scope = track.closest('[data-slider-scope]') || doc;
    var prev = $('[data-slider-prev]', scope), next = $('[data-slider-next]', scope);
    function step() { var s = track.querySelector('.slide'); return s ? s.getBoundingClientRect().width + 18 : 320; }
    function update() {
      if (prev) prev.disabled = track.scrollLeft <= 4;
      if (next) next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
    }
    if (prev) prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    if (next) next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: reduceMotion ? 'auto' : 'smooth' }); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); next && next.click(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prev && prev.click(); }
    });
    update();
  });

  /* ---------- Category filters ---------- */
  $$('[data-filters]').forEach(function (bar) {
    var scope = $(bar.getAttribute('data-filters'));
    if (!scope) return;
    var items = $$('[data-group]', scope);
    var status = $('[data-filter-status]', bar.parentNode);
    var empty = $('[data-filter-empty]', bar.parentNode);
    bar.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      $$('.chip', bar).forEach(function (c) { c.setAttribute('aria-pressed', c === chip ? 'true' : 'false'); });
      var val = chip.getAttribute('data-value');
      var shown = 0;
      items.forEach(function (it) {
        var match = val === 'all' || it.getAttribute('data-group') === val;
        it.hidden = !match;
        if (match) { shown++; it.classList.add('in'); }
      });
      if (status) status.textContent = shown + (shown === 1 ? ' item' : ' items') + ' shown';
      if (empty) empty.hidden = shown !== 0;
    });
  });

  /* ---------- Certificates: show all toggle ---------- */
  $$('[data-collapse]').forEach(function (btn) {
    var list = $(btn.getAttribute('data-collapse'));
    if (!list) return;
    btn.addEventListener('click', function () {
      var collapsed = list.classList.toggle('collapsed');
      btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      btn.textContent = collapsed ? btn.getAttribute('data-more') : btn.getAttribute('data-less');
    });
  });

  /* ---------- Focus handling shared by overlays ---------- */
  var FOCUSABLE = 'a[href], button:not([disabled]), input, textarea, select, [tabindex]:not([tabindex="-1"])';
  function trapTab(container, e) {
    if (e.key !== 'Tab') return;
    var f = $$(FOCUSABLE, container).filter(function (n) { return n.offsetParent !== null || n === doc.activeElement; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  /* ---------- Lightbox ---------- */
  var lb = $('#lightbox');
  if (lb) {
    var lbImg = $('#lbImage'), lbTitle = $('#lbTitle'), lbMeta = $('#lbMeta'), lbCount = $('#lbCount');
    var set = [], idx = 0, opener = null, closing = false;

    function collect(group) {
      return $$('a[data-lightbox]').filter(function (a) {
        return a.getAttribute('data-lightbox') === group && !a.closest('[hidden]');
      });
    }
    function show(i, instant) {
      idx = (i + set.length) % set.length;
      var a = set[idx];
      var apply = function () {
        lbImg.src = a.getAttribute('href');
        lbImg.alt = a.getAttribute('data-alt') || a.getAttribute('data-title') || '';
        lbTitle.textContent = a.getAttribute('data-title') || '';
        lbMeta.textContent = [a.getAttribute('data-cat'), a.getAttribute('data-date')].filter(Boolean).join('  ·  ');
        lbCount.textContent = set.length > 1 ? (idx + 1) + ' / ' + set.length : '';
        lbImg.classList.remove('swap');
      };
      if (instant || reduceMotion) { apply(); return; }
      lbImg.classList.add('swap');
      setTimeout(apply, 140);
      var n = set[(idx + 1) % set.length]; if (n) { var pre = new Image(); pre.src = n.getAttribute('href'); }
    }
    function open(a) {
      set = collect(a.getAttribute('data-lightbox'));
      var i = set.indexOf(a);
      if (i < 0) return;
      opener = a; closing = false;
      lb.hidden = false;
      doc.body.classList.add('no-scroll');
      show(i, true);
      requestAnimationFrame(function () { lb.classList.add('open'); });
      $('.lb-close', lb).focus();
      var single = set.length < 2;
      $('[data-lb-prev]', lb).hidden = single; $('[data-lb-next]', lb).hidden = single;
    }
    function close() {
      if (lb.hidden || closing) return;
      closing = true;
      lb.classList.remove('open');
      setTimeout(function () {
        lb.hidden = true; lbImg.src = ''; closing = false;
        if (!$('.panel.open')) doc.body.classList.remove('no-scroll');
        if (opener) opener.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 320);
    }
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-lightbox]');
      if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); open(a); }
    });
    lb.addEventListener('click', function (e) {
      if (e.target.closest('[data-lb-close]') || e.target === lb) close();
      else if (e.target.closest('[data-lb-prev]')) show(idx - 1);
      else if (e.target.closest('[data-lb-next]')) show(idx + 1);
    });
    doc.addEventListener('keydown', function (e) {
      if (lb.hidden) return;
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      else if (e.key === 'ArrowLeft') show(idx - 1);
      else if (e.key === 'ArrowRight') show(idx + 1);
      else trapTab(lb, e);
    }, true);
    var sx = null;
    lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', function (e) {
      if (sx === null) return;
      var dx = e.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 50 && set.length > 1) show(idx + (dx < 0 ? 1 : -1));
    });
  }

  /* ---------- Project detail panel (loads the same server-rendered page as ?partial=1) ---------- */
  if ($('[data-project]')) {
    var backdrop = doc.createElement('div'); backdrop.className = 'panel-backdrop'; backdrop.hidden = true;
    var panel = doc.createElement('aside'); panel.className = 'panel'; panel.hidden = true;
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', 'Project details');
    panel.innerHTML = '<div class="panel-bar"><span class="muted">Project details</span><button class="panel-close" type="button" aria-label="Close project details">&times;</button></div><div class="panel-inner" id="panelInner"></div>';
    doc.body.appendChild(backdrop); doc.body.appendChild(panel);
    var inner = $('#panelInner', panel), pOpener = null, loading = 0;

    function openPanel(link, fromPop) {
      var token = ++loading;
      var url = new URL(link.href, location.href);
      var slug = link.getAttribute('data-project');
      if (!panel.classList.contains('open')) pOpener = link;
      backdrop.hidden = false; panel.hidden = false;
      doc.body.classList.add('no-scroll');
      requestAnimationFrame(function () { backdrop.classList.add('open'); panel.classList.add('open'); });
      inner.setAttribute('aria-busy', 'true');
      url.pathname = url.pathname.replace(/\/?$/, '/partial.html'); url.search = '';
      fetch(url.toString(), { headers: { 'X-Requested-With': 'fetch' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .then(function (html) {
          if (token !== loading) return;
          inner.innerHTML = html; inner.removeAttribute('aria-busy');
          panel.scrollTop = 0;
          panel.querySelector('.panel-close').focus({ preventScroll: true });
          if (!fromPop) history.pushState({ project: slug }, '', '#project-' + slug);
        })
        .catch(function () { location.href = link.href; });
    }
    function closePanel(fromPop) {
      if (!panel.classList.contains('open')) return;
      loading++;
      panel.classList.remove('open'); backdrop.classList.remove('open');
      if (!fromPop && /^#project-/.test(location.hash)) history.pushState(null, '', location.pathname + location.search);
      setTimeout(function () {
        panel.hidden = true; backdrop.hidden = true; inner.innerHTML = '';
        if (!lb || lb.hidden) doc.body.classList.remove('no-scroll');
        if (pOpener) pOpener.focus({ preventScroll: true });
      }, reduceMotion ? 0 : 600);
    }
    doc.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-project]');
      if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.button) { e.preventDefault(); openPanel(a); return; }
      if (e.target === backdrop || e.target.closest('.panel-close')) closePanel();
    });
    doc.addEventListener('keydown', function (e) {
      if (!panel.classList.contains('open') || (lb && !lb.hidden)) return;
      if (e.key === 'Escape') closePanel(); else trapTab(panel, e);
    });
    window.addEventListener('popstate', function () {
      var m = location.hash.match(/^#project-(.+)$/);
      if (m) { var l = $('a[data-project="' + m[1] + '"]'); if (l) { openPanel(l, true); return; } }
      closePanel(true);
    });
    var initial = location.hash.match(/^#project-(.+)$/);
    if (initial) { var il = $('a[data-project="' + initial[1] + '"]'); if (il) openPanel(il, true); }
  }

  /* ---------- Contact form ---------- */
  var form = $('#contactForm');
  if (form) {
    var status = $('#formStatus');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('button[type="submit"]', form);
      status.className = 'form-status'; status.textContent = 'Sending…'; btn.disabled = true;
      fetch(form.getAttribute('action') || './', { method: 'POST', body: new FormData(form), headers: { 'X-Requested-With': 'fetch' } })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          status.textContent = d.message || (d.success ? 'Message sent.' : 'Something went wrong.');
          status.classList.add(d.success ? 'ok' : 'err');
          if (d.success) form.reset();
        })
        .catch(function () {
          status.textContent = 'Could not send right now. Please email me directly.'; status.classList.add('err');
        })
        .then(function () { btn.disabled = false; });
    });
  }
})();
