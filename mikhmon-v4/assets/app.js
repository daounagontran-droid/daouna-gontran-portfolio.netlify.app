/* Mikhmon V4 - interactions de l'interface */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Thème clair/sombre (préférence locale prioritaire sur le réglage serveur).
  var root = document.documentElement;
  try { var t = localStorage.getItem('mk-theme'); if (t) root.dataset.theme = t; } catch (e) {}
  var tt = $('#themeToggle');
  if (tt) tt.addEventListener('click', function () {
    root.dataset.theme = root.dataset.theme === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('mk-theme', root.dataset.theme); } catch (e) {}
    if (window.mkChart) window.mkChart.draw();
  });

  // Menu mobile.
  var burger = $('#burger'), sidebar = $('#sidebar');
  if (burger) burger.addEventListener('click', function (e) { e.stopPropagation(); sidebar.classList.toggle('open'); });
  document.addEventListener('click', function (e) { if (sidebar && !sidebar.contains(e.target)) sidebar.classList.remove('open'); });

  // Confirmation des actions destructrices.
  document.addEventListener('submit', function (e) {
    var f = e.target, msg = f.dataset.confirm;
    var btn = e.submitter;
    if (!msg && f.dataset.confirmRemove && btn && btn.value === 'remove') msg = f.dataset.confirmRemove;
    if (msg && !window.confirm(msg)) e.preventDefault();
  });

  // Cases "tout cocher".
  $$('[data-check-all]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      $$('tbody input[type=checkbox]', cb.closest('table')).forEach(function (c) {
        if (c.closest('tr').style.display !== 'none') c.checked = cb.checked;
      });
    });
  });

  // Afficher / masquer les mots de passe.
  $$('.secret').forEach(function (el) {
    el.title = 'Cliquer pour afficher';
    el.addEventListener('click', function () {
      el.textContent = el.textContent === '••••' ? (el.dataset.secret || '(vide)') : '••••';
    });
  });

  // Tri des tableaux.
  $$('table[data-sortable]').forEach(function (table) {
    $$('thead th', table).forEach(function (th, idx) {
      if (th.querySelector('input') || !th.textContent.trim()) return;
      th.dataset.sort = '';
      th.addEventListener('click', function () {
        var asc = th.dataset.sort !== 'asc';
        $$('thead th', table).forEach(function (o) { if (o.dataset.sort !== undefined) o.dataset.sort = ''; });
        th.dataset.sort = asc ? 'asc' : 'desc';
        var body = table.tBodies[0];
        var rows = $$('tr', body).filter(function (r) { return r.cells.length > 1; });
        var key = function (r) {
          var s = (r.cells[idx] ? r.cells[idx].textContent : '').trim();
          var n = parseSize(s);
          return n === null ? s.toLowerCase() : n;
        };
        rows.sort(function (a, b) {
          var x = key(a), y = key(b);
          var c = (typeof x === 'number' && typeof y === 'number') ? x - y : String(x).localeCompare(String(y), 'fr', { numeric: true });
          return asc ? c : -c;
        });
        rows.forEach(function (r) { body.appendChild(r); });
      });
    });
  });
  function parseSize(s) {
    var m = s.match(/^([\d\s.,]+)\s*(B|KiB|MiB|GiB|TiB)?\b/);
    if (!m || !/\d/.test(m[1])) return null;
    var v = parseFloat(m[1].replace(/\s/g, '').replace(',', '.'));
    var mult = { B: 1, KiB: 1024, MiB: 1048576, GiB: 1073741824, TiB: 1099511627776 }[m[2]] || 1;
    return isNaN(v) ? null : v * mult;
  }

  // Infos du profil dans le générateur.
  var gp = $('#genProfile'), gi = $('#genProfileInfo');
  if (gp && gi) {
    var upd = function () { gi.textContent = gp.selectedOptions[0] ? gp.selectedOptions[0].dataset.info : ''; };
    gp.addEventListener('change', upd); upd();
  }

  function getJSON(url, cb) {
    var x = new XMLHttpRequest();
    x.open('GET', url);
    x.onload = function () { try { cb(JSON.parse(x.responseText)); } catch (e) {} };
    x.send();
  }

  // Statistiques en direct du tableau de bord.
  var live = $('[data-live]');
  if (live) {
    var every = Math.max(3, +live.dataset.reload || 10) * 1000;
    setInterval(function () {
      if (document.hidden) return;
      getJSON(live.dataset.live, function (d) {
        if (d.error) return;
        var set = function (k, v) { var el = $('[data-k="' + k + '"]'); if (el) el.textContent = v; };
        set('clock', d.clock); set('active', d.active); set('uptime', d.uptime); set('cpu', d.cpu); set('mem', d.mem);
        var bar = $('[data-k="cpu-bar"]'); if (bar) bar.style.width = d.cpu + '%';
      });
    }, every);
  }

  // Graphique de trafic (canvas, sans dépendance).
  var canvas = $('#trafficChart');
  if (canvas) {
    var points = [], maxPts = 40, src = canvas.dataset.src;
    var ifSel = $('#trafficIface');
    if (ifSel) ifSel.addEventListener('change', function () {
      src = src.replace(/&iface=[^&]*/, '') + '&iface=' + encodeURIComponent(ifSel.value); points = []; draw();
    });
    var fmt = function (b) {
      var u = ['bps', 'kbps', 'Mbps', 'Gbps'], i = 0;
      while (b >= 1000 && i < 3) { b /= 1000; i++; }
      return (i ? b.toFixed(1) : Math.round(b)) + ' ' + u[i];
    };
    var draw = function () {
      var dpr = window.devicePixelRatio || 1, w = canvas.clientWidth, h = +canvas.getAttribute('height');
      canvas.width = w * dpr; canvas.height = h * dpr; canvas.style.height = h + 'px';
      var c = canvas.getContext('2d'); c.scale(dpr, dpr); c.clearRect(0, 0, w, h);
      var css = getComputedStyle(document.documentElement);
      var grid = css.getPropertyValue('--border'), muted = css.getPropertyValue('--muted');
      var max = 1000;
      points.forEach(function (p) { max = Math.max(max, p.rx, p.tx); });
      max *= 1.15;
      var padL = 70, padB = 6, gw = w - padL - 6, gh = h - padB - 8;
      c.font = '11px system-ui'; c.fillStyle = muted; c.strokeStyle = grid; c.lineWidth = 1;
      for (var i = 0; i <= 4; i++) {
        var y = 8 + gh * i / 4;
        c.beginPath(); c.moveTo(padL, y); c.lineTo(w - 6, y); c.stroke();
        c.fillText(fmt(max * (1 - i / 4)), 4, y + 4);
      }
      var line = function (key, color) {
        if (points.length < 2) return;
        c.beginPath();
        points.forEach(function (p, i) {
          var x = padL + gw * (i + maxPts - points.length) / (maxPts - 1), y = 8 + gh * (1 - p[key] / max);
          i ? c.lineTo(x, y) : c.moveTo(x, y);
        });
        c.strokeStyle = color; c.lineWidth = 2; c.stroke();
        c.lineTo(padL + gw, 8 + gh); c.lineTo(padL + gw * (maxPts - points.length) / (maxPts - 1), 8 + gh); c.closePath();
        c.globalAlpha = .12; c.fillStyle = color; c.fill(); c.globalAlpha = 1;
      };
      line('rx', css.getPropertyValue('--green')); line('tx', css.getPropertyValue('--blue'));
    };
    window.mkChart = { draw: draw };
    var tick = function () {
      if (document.hidden) return;
      getJSON(src, function (d) {
        if (d.error) { $('#rxNow').textContent = d.error; return; }
        points.push(d); if (points.length > maxPts) points.shift();
        $('#rxNow').textContent = fmt(d.rx); $('#txNow').textContent = fmt(d.tx);
        draw();
      });
    };
    tick(); setInterval(tick, Math.max(2, +canvas.dataset.reload || 5) * 1000);
    window.addEventListener('resize', draw);
    draw();
  }
})();
