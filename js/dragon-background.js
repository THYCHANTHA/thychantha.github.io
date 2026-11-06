(function () {
  'use strict';

  function isDisabled() {
    try {
      if (localStorage.getItem('portfolioDragonBg') === 'off') return true;
    } catch (error) {}
    return new URLSearchParams(window.location.search).get('dragon') === 'off';
  }

  function initCosmicBackground() {
    var background = document.getElementById('cosmicBackground');
    var dragon = document.getElementById('glassDragon');
    var head = document.getElementById('dragonHead');

    if (isDisabled()) {
      if (background) background.classList.add('is-disabled');
      return;
    }

    if (!background) return;

    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isMobile = window.matchMedia('(max-width: 768px)').matches;

    if (reducedMotion) return;

    var parallaxTargetX = 0;
    var parallaxTargetY = 0;
    var parallaxCurrentX = 0;
    var parallaxCurrentY = 0;
    var dragonTargetX = 0;
    var dragonTargetY = 0;
    var dragonCurrentX = 0;
    var dragonCurrentY = 0;
    var headTargetX = 0;
    var headTargetY = 0;
    var headCurrentX = 0;
    var headCurrentY = 0;
    var running = true;

    window.addEventListener('mousemove', function (event) {
      var x = (event.clientX / window.innerWidth - 0.5) * 2;
      var y = (event.clientY / window.innerHeight - 0.5) * 2;

      if (!isMobile) {
        parallaxTargetX = x * 28;
        parallaxTargetY = y * 18;
      }

      if (dragon) {
        dragonTargetX = x * 10;
        dragonTargetY = y * -8;
        headTargetX = x * 16;
        headTargetY = y * -12;
      }
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) requestAnimationFrame(tick);
    });

    function tick() {
      if (!running) return;

      parallaxCurrentX += (parallaxTargetX - parallaxCurrentX) * 0.04;
      parallaxCurrentY += (parallaxTargetY - parallaxCurrentY) * 0.04;

      background.style.setProperty('--parallax-x', parallaxCurrentX + 'px');
      background.style.setProperty('--parallax-y', parallaxCurrentY + 'px');

      if (dragon && !isMobile) {
        dragonCurrentX += (dragonTargetX - dragonCurrentX) * 0.045;
        dragonCurrentY += (dragonTargetY - dragonCurrentY) * 0.045;
        headCurrentX += (headTargetX - headCurrentX) * 0.06;
        headCurrentY += (headTargetY - headCurrentY) * 0.06;

        dragon.style.setProperty('--dragonMouseX', dragonCurrentX + 'deg');
        dragon.style.setProperty('--dragonMouseY', dragonCurrentY + 'deg');

        if (head) {
          head.style.setProperty('--headTiltY', headCurrentX + 'deg');
          head.style.setProperty('--headTiltX', headCurrentY + 'deg');
        }
      }

      requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCosmicBackground);
  } else {
    initCosmicBackground();
  }
})();
