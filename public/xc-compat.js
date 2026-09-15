/* Xtream Codes UI Manager - CSP-safe compatibility layer (external script).
   The login screen is a full page here (not a Bootstrap modal), so the stock
   showLoginModal/hideLoginModal are adapted. No visual changes. */
(function () {
  'use strict';

  // Splash: CSS animation fades it out; drop the node right after.
  window.setTimeout(function () {
    var s = document.getElementById('splash');
    if (s) {
      s.style.opacity = '0';
      window.setTimeout(function () { if (s && s.parentNode) s.parentNode.removeChild(s); }, 900);
    }
  }, 2600);

  // app.js compatibility: login is a full page here, not a Bootstrap modal.
  window.showLoginModal = function () {
    var l = document.getElementById('login-modal');
    if (l) l.classList.remove('d-none');
    var sh = document.getElementById('app-shell');
    if (sh) { sh.classList.add('d-none'); sh.classList.remove('d-flex'); }
    var nb = document.getElementById('main-navbar');
    if (nb) nb.classList.add('d-none');
    var mc = document.getElementById('main-content');
    if (mc) mc.classList.add('d-none');
  };

  window.hideLoginModal = function () {
    var l = document.getElementById('login-modal');
    if (l) l.classList.add('d-none');
    var sh = document.getElementById('app-shell');
    if (sh) { sh.classList.remove('d-none'); sh.classList.add('d-flex'); }
  };

  function syncSidebarActive(view) {
    var links = document.querySelectorAll('#sidebar .nav-link[data-view]');
    for (var i = 0; i < links.length; i++) {
      var a = links[i];
      var on = a.getAttribute('data-view') === view;
      if (on) {
        a.classList.add('active');
        a.style.color = '#ff6b35';
      } else {
        a.classList.remove('active');
        a.style.color = '#9ca3af';
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (typeof window.switchView === 'function') {
      var original = window.switchView;
      window.switchView = function (v) {
        original(v);
        syncSidebarActive(v);
      };
    }
    // Show sidebar + hide mobile navbar once logged in (CSP-safe replacement
    // for the legacy inline sync helper).
    window.setInterval(function () {
      var nb = document.getElementById('main-navbar');
      var sb = document.getElementById('sidebar');
      if (nb && sb && !nb.classList.contains('d-none')) {
        sb.classList.remove('d-none');
        sb.classList.add('d-flex');
        nb.classList.add('d-none');
      }
      var a = document.getElementById('language-selector');
      var b = document.getElementById('language-selector-side');
      if (a && b && a.value !== b.value) b.value = a.value;
    }, 500);
    // Sidebar language selector drives the main one (app.js listens on main).
    var side = document.getElementById('language-selector-side');
    var main = document.getElementById('language-selector');
    if (side && main) {
      side.addEventListener('change', function () {
        main.value = side.value;
        main.dispatchEvent(new Event('change'));
      });
      main.addEventListener('change', function () {
        var o = side.querySelector('option[value="' + main.value + '"]');
        if (o) side.value = main.value;
      });
    }
    // Remember-me: prefill saved credentials, persist on submit.
    try {
      var lu = document.getElementById('login-username');
      var lp = document.getElementById('login-password');
      var rm = document.getElementById('remember-me');
      if (lu && window.localStorage.getItem('xtreme_remember') === '1') {
        var su = window.localStorage.getItem('xtreme_user');
        var sp = window.localStorage.getItem('xtreme_pass');
        if (su && !lu.value) lu.value = su;
        if (sp && lp && !lp.value) lp.value = sp;
      }
      var lf = document.getElementById('login-form');
      if (lf) lf.addEventListener('submit', function () {
        try {
          if (rm && rm.checked) {
            window.localStorage.setItem('xtreme_remember', '1');
            if (lu) window.localStorage.setItem('xtreme_user', lu.value);
            if (lp) window.localStorage.setItem('xtreme_pass', lp.value);
          } else {
            window.localStorage.removeItem('xtreme_remember');
            window.localStorage.removeItem('xtreme_pass');
          }
        } catch (e) { /* storage unavailable */ }
      });
    } catch (e) { /* storage unavailable */ }
    // Forgot-password link opens the info modal.
    var fl = document.getElementById('forgot-password-link');
    if (fl) fl.addEventListener('click', function (e) {
      e.preventDefault();
      var m = document.getElementById('forgot-password-modal');
      if (m && window.bootstrap && window.bootstrap.Modal) {
        window.bootstrap.Modal.getOrCreateInstance(m).show();
      }
    });
  });
})();
