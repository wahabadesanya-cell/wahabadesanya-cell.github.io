/* Adesanya AI Advisory — shared site behaviour.
   Kept deliberately small: the mobile nav drawer and nothing else. Each page
   had been carrying its own copy of this (or, on 31 of them, no nav at all). */
(function(){
  var burger = document.getElementById('burger');
  var links  = document.getElementById('navlinks');
  if(!burger || !links) return;

  burger.addEventListener('click', function(){
    var open = links.classList.toggle('open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });

  /* Close on selection — otherwise the drawer stays over the page the reader
     just asked for. */
  links.addEventListener('click', function(e){
    if(e.target.closest('a')){
      links.classList.remove('open');
      burger.setAttribute('aria-expanded','false');
      burger.setAttribute('aria-label','Open menu');
    }
  });

  /* Escape closes it, and returns focus to the control that opened it. */
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && links.classList.contains('open')){
      links.classList.remove('open');
      burger.setAttribute('aria-expanded','false');
      burger.focus();
    }
  });
})();

/* ── Fragment scrolling ────────────────────────────────────────────────────
   Native fragment navigation does not land on this site. Verified three ways
   on a 1280x900 viewport: a fresh load of /index.html#contact, a reload with
   the hash, and a real click on the nav's Contact link from services.html.
   All three finish at scrollY 0 with #contact 9450px down the page. It is not
   the smooth-scroll rule — removing it changes nothing — and it predates the
   design pass (identical on the pre-change file from git).

   That matters because 15 links across 12 pages point at index.html#contact,
   which is the enquiry form and the conversion path from every article. So
   scroll explicitly, twice: once as soon as the DOM is ready, and again after
   load, because the hero canvas and web fonts change the document height
   underneath the first attempt.

   The second pass is skipped if the reader has already scrolled somewhere
   themselves — we are correcting a failed landing, not seizing the scroll. */
(function(){
  function target(){
    if(!location.hash || location.hash.length < 2) return null;
    var h = location.hash;
    try { return document.querySelector(h); } catch(e) {}
    /* A query written after the fragment ("#contact?topic=...") makes the whole
       thing an invalid selector, so querySelector throws and the reader is left
       at the top of the page. Three CTAs on work-with-me.html were shaped that
       way. Those are fixed, but tolerate the shape rather than fail silently. */
    var cut = h.search(/[?&]/);
    if(cut > 1){
      try { return document.querySelector(h.slice(0, cut)); } catch(e) {}
    }
    return null;
  }
  /* The jump has to be made with scroll-behavior switched off inline.
     Measured on this page: with the sheet's `scroll-behavior:smooth` active,
     window.scrollTo(0, 9374) leaves scrollY at 0 — and passing
     {behavior:'auto'} in the options object does not override it either.
     Setting the inline property, jumping, then restoring lands exactly. */
  function land(){
    var el = target();
    if(!el) return;
    var root = document.documentElement;
    var prev = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    var offset = document.querySelector('.nav') ? 76 : 12;
    var y = el.getBoundingClientRect().top + window.pageYOffset - offset;
    window.scrollTo(0, Math.max(0, y));
    root.style.scrollBehavior = prev;
  }
  var settled = false;
  function landIfStranded(){
    if(settled || !location.hash) return;
    var el = target();
    /* 76px is a correct landing; anything further out means the document moved
       under us after we jumped. */
    if(el && Math.abs(el.getBoundingClientRect().top - 76) > 120) land();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', land);
  } else {
    land();
  }

  window.addEventListener('load', function(){
    landIfStranded();
    if(document.fonts && document.fonts.ready){ document.fonts.ready.then(landIfStranded); }

    /* A fixed settle window was not enough in production: the AI-radar feed
       renders after load and changes the document height, which on the
       click-through path left the reader ~1000px past the target. Correct on
       actual height changes instead of on a guess, for a bounded 3 seconds. */
    if(window.ResizeObserver && location.hash){
      var lastH = document.documentElement.scrollHeight;
      var ro = new ResizeObserver(function(){
        var h = document.documentElement.scrollHeight;
        if(h !== lastH){ lastH = h; landIfStranded(); }
      });
      ro.observe(document.body);
      setTimeout(function(){ settled = true; ro.disconnect(); }, 3000);
    } else {
      setTimeout(function(){ landIfStranded(); settled = true; }, 800);
    }
  });
  /* once the reader takes over, stop correcting */
  window.addEventListener('wheel', function(){ settled = true; }, {passive:true, once:true});
  window.addEventListener('touchstart', function(){ settled = true; }, {passive:true, once:true});

  /* same-page hash changes (nav links on the one-pagers) */
  window.addEventListener('hashchange', land);
})();


/* ── Reveal safety net ─────────────────────────────────────────────────────
   index.html and work-with-me.html hide .rv elements at opacity:0 and rely on
   an IntersectionObserver to add .in. If that observer never fires, the
   content stays invisible permanently — and the failure is silent, because
   the markup, the CSS and the test suite all look correct.

   That is not hypothetical: the gateway page had its reveal removed outright
   after exactly this "stuck invisible" mode, and a page opened in a background
   tab (cmd-click, "open in new tab") can load with visibilityState 'hidden',
   where observers may not deliver until the tab is focused.

   So: reveal anything at or above the fold whenever the page becomes visible,
   after load, and on scroll — and reveal everything as a final backstop. When
   the observer works this changes nothing, because .in is already set long
   before any of these fire. */
(function(){
  var rv = document.querySelectorAll('.rv');
  if(!rv.length) return;
  if(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    for(var i=0;i<rv.length;i++) rv[i].classList.add('in');
    return;
  }

  function revealVisible(){
    var any = false;
    for(var i=0;i<rv.length;i++){
      var el = rv[i];
      if(el.classList.contains('in')) continue;
      any = true;
      if(el.getBoundingClientRect().top < window.innerHeight + 100) el.classList.add('in');
    }
    return any;
  }
  function revealAll(){ for(var i=0;i<rv.length;i++) rv[i].classList.add('in'); }

  var ticking = false;
  function onScroll(){
    if(ticking) return;
    ticking = true;
    requestAnimationFrame(function(){ ticking = false; if(!revealVisible()) cleanup(); });
  }
  function cleanup(){ window.removeEventListener('scroll', onScroll); }

  window.addEventListener('scroll', onScroll, {passive:true});
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState === 'visible') revealVisible();
  });
  window.addEventListener('load', function(){
    setTimeout(revealVisible, 600);
    setTimeout(revealAll, 4000);   /* final backstop: content over animation */
  });
})();
