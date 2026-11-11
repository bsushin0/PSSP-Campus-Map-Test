/* PSSP Digital Testing Site: numbered map pages for the printed building list.
   Used by map/admin.html. It is given the same items the printed list is made from, each with its list
   number in it._n, and it returns the HTML for the map pages: one overview map and a set of zoomed detail
   maps. Every badge on a map carries the same number as the list, so an SP can look a building up either way.
   It only reads the map data it is handed. No passcodes or answers live in this file. */
(function(root){
  'use strict';

  var MM_W = 195, MM_H = 230;   /* nominal map box on a letter page, in mm (the page scales it to fit) */
  var BADGE_H = 3;            /* badge height in mm at the nominal scale */
  var FONT = 2.25;              /* badge number size in mm */
  
  var CSS =
    '#blist .mp{break-before:page;height:249mm;display:flex;flex-direction:column;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '#blist .mp *{-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
    '#blist .mh{display:flex;gap:5mm;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #000;padding-bottom:2mm;margin-bottom:2mm}' +
    '#blist .mh h1{border:0;padding:0;font:700 12pt/1.15 system-ui,Arial,sans-serif;margin:0}' +
    '#blist .mh .ms{font:600 9pt/1.2 system-ui,Arial,sans-serif;margin:1mm 0 1.2mm}' +
    '#blist .mh .mg{font:7pt/1.5 system-ui,Arial,sans-serif;color:#000}' +
    '#blist .mh svg.loc{flex:none;width:34mm;height:auto;border:.25mm solid #000;background:#fff}' +
    '#blist .mw{position:relative;flex:1 1 0;min-height:60mm;border:.3mm solid #000;background:#fff}' +
    '#blist .mw svg{position:absolute;inset:0;width:100%;height:100%;display:block}' +
    '#blist .mk{flex:none;margin:2mm 0 0;padding:0;list-style:none;columns:3;column-gap:4mm;font:7pt/1.25 system-ui,Arial,sans-serif}' +
    '#blist .mk li{break-inside:avoid;display:flex;gap:1.6mm;align-items:baseline;padding:.25mm 0;border-bottom:.2mm dotted #999}' +
    '#blist .mk li b{font:700 7pt/1.25 ui-monospace,Menlo,Consolas,monospace;flex:none}' +
    '#blist .mk li span{min-width:0}' +
    '#blist .mk h3{margin:0 0 1mm;font:700 7.6pt/1 system-ui,Arial,sans-serif;text-transform:uppercase;letter-spacing:.06em;column-span:all}' +
    '#blist .bd{display:inline-block;flex:none;min-width:5.2mm;box-sizing:border-box;text-align:center;font:700 7pt/1.3 system-ui,Arial,sans-serif;border:.25mm solid #000;border-radius:2mm;padding:0 .8mm;background:#fff;color:#000}' +
    '#blist .bd.rq{background:#000;color:#fff}' +
    '#blist .bd.ex{border-style:dotted;border-color:#555;color:#555}' +
    '#blist .bd.sq{border-radius:.4mm}';

  function esc(s){ return String(s).replace(/[&<>"]/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); }
  function r1(v){ return Math.round(v * 10) / 10; }

  /* Paths in the map data are plain absolute polylines (M, L, Z), so reading the numbers is enough. */
  function lines(d){
    var out = [];
    String(d || '').split(/M/i).forEach(function(seg){
      var n = (seg.match(/-?\d+(?:\.\d+)?/g) || []).map(Number), pts = [];
      for(var i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
      if(pts.length > 1) out.push(pts);
    });
    return out;
  }
  function bboxOf(ls){
    var b = [1e9, 1e9, -1e9, -1e9];
    ls.forEach(function(pts){ pts.forEach(function(p){ b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); }); });
    return b;
  }
  function sampleLines(ls, step){
    return ls.map(function(pts){
      var out = [pts[0]];
      for(var i = 1; i < pts.length; i++){
        var a = pts[i - 1], b = pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.ceil(L / step));
        for(var j = 1; j <= k; j++) out.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k]);
      }
      return out;
    });
  }
  var inRect = function(p, r){ return p[0] >= r.x0 && p[0] < r.x1 && p[1] >= r.y0 && p[1] < r.y1; };

  /* the longest unbroken stretch of a street that lies inside a rectangle */
  function bestRun(samples, rect){
    var best = null;
    samples.forEach(function(line){
      var cur = [];
      function flush(){ if(cur.length && (!best || cur.length > best.length)) best = cur; cur = []; }
      line.forEach(function(p){ if(inRect(p, rect)) cur.push(p); else flush(); });
      flush();
    });
    return best;
  }

  /* ---------- placing the number badges so they do not sit on top of each other ---------- */
  function overlaps(r, t, gap){ return r.x0 < t.x1 + gap && r.x1 > t.x0 - gap && r.y0 < t.y1 + gap && r.y1 > t.y0 - gap; }
  var DIRS = [0, 180, -90, 90, -45, -135, 45, 135];
  function ringCands(cx, cy, w, h){
    var out = [[cx, cy]];
    for(var k = 1; k <= 6; k++) DIRS.forEach(function(a){
      var t = a * Math.PI / 180;
      out.push([cx + Math.cos(t) * k * (w * 0.62 + h * 0.5), cy + Math.sin(t) * k * h * 1.08]);
    });
    return out;
  }
  function place(entries, rect, s0, taken){
    var gap = 0.3 / s0;
    entries.forEach(function(e){
      var hit = null;
      for(var i = 0; i < e.cands.length && !hit; i++){
        var c = e.cands[i], r = { x0: c[0] - e.w / 2, y0: c[1] - e.h / 2, x1: c[0] + e.w / 2, y1: c[1] + e.h / 2 };
        if(r.x0 < rect.x0 + gap || r.x1 > rect.x1 - gap || r.y0 < rect.y0 + gap || r.y1 > rect.y1 - gap) continue;
        if(taken.some(function(t){ return overlaps(r, t, gap); })) continue;
        hit = { c: c, r: r };
      }
      if(!hit){      /* no free spot: keep it as close to its place as the page allows */
        var c0 = e.cands[0], cx = Math.min(rect.x1 - e.w / 2 - gap, Math.max(rect.x0 + e.w / 2 + gap, c0[0])), cy = Math.min(rect.y1 - e.h / 2 - gap, Math.max(rect.y0 + e.h / 2 + gap, c0[1]));
        hit = { c: [cx, cy], r: { x0: cx - e.w / 2, y0: cy - e.h / 2, x1: cx + e.w / 2, y1: cy + e.h / 2 } };
      }
      taken.push(hit.r); e.pos = hit.c;
    });
  }

  function badgeSize(n, s0, sq){
    var d = String(n).length, h = BADGE_H / s0, w = Math.max(BADGE_H, 1.38 * d + 1.5) / s0;
    return { w: w, h: h };
  }
  function badgeSvg(it, x, y, w, h, s0){
    var n = it._n, sq = it.kind === 's', rx = sq ? 0.5 / s0 : h / 2, sw = 0.28 / s0;
    var fill = it.rq ? '#000' : '#fff', stroke = it.ex ? '#555' : '#000', txt = it.rq ? '#fff' : (it.ex ? '#555' : '#000');
    return '<rect x="' + r1(x - w / 2) + '" y="' + r1(y - h / 2) + '" width="' + r1(w) + '" height="' + r1(h) + '" rx="' + r1(rx) + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + r1(sw * 10) / 10 + '"' + (it.ex ? ' stroke-dasharray="' + r1(0.7 / s0) + ' ' + r1(0.7 / s0) + '"' : '') + '/>' +
      '<text x="' + r1(x) + '" y="' + r1(y + 0.1 / s0) + '" font-size="' + r1(FONT / s0) + '" fill="' + txt + '" text-anchor="middle" dominant-baseline="central" font-family="system-ui,Segoe UI,Arial,sans-serif" font-weight="700">' + n + '</text>';
  }
  function badgeHtml(it){ return '<span class="bd' + (it.rq ? ' rq' : '') + (it.ex ? ' ex' : '') + (it.kind === 's' ? ' sq' : '') + '">' + it._n + '</span>'; }

  function niceLen(s0){
    var nice = [25, 50, 100, 200, 250, 500, 1000], len = nice[0];
    nice.forEach(function(n){ if(n * s0 <= 45) len = n; });
    return len;
  }
  function scaleBar(rect, s0){
    var len = niceLen(s0), x = rect.x0 + 4 / s0, y = rect.y1 - 5.5 / s0, h = 1.1 / s0, pad = 1.8 / s0;
    return '<rect x="' + r1(x - pad) + '" y="' + r1(y - 3.6 / s0) + '" width="' + r1(len + pad * 2) + '" height="' + r1(7.8 / s0) + '" fill="#fff" fill-opacity=".85"/>' +
      '<rect x="' + r1(x) + '" y="' + r1(y) + '" width="' + len + '" height="' + r1(h) + '" fill="#000"/>' +
      '<path d="M' + r1(x) + ' ' + r1(y - 1 / s0) + 'v' + r1(h + 2 / s0) + 'M' + r1(x + len) + ' ' + r1(y - 1 / s0) + 'v' + r1(h + 2 / s0) + '" stroke="#000" stroke-width="' + r1(0.25 / s0 * 10) / 10 + '"/>' +
      '<text x="' + r1(x) + '" y="' + r1(y - 1.9 / s0) + '" font-size="' + r1(2.3 / s0) + '" font-family="system-ui,Arial,sans-serif" font-weight="600" fill="#000">' + len + ' m</text>';
  }
  function northArrow(rect, s0){
    var x = rect.x1 - 6 / s0, y = rect.y0 + 11 / s0, u = 1 / s0;
    return '<rect x="' + r1(x - 4 * u) + '" y="' + r1(y - 9 * u) + '" width="' + r1(8 * u) + '" height="' + r1(16 * u) + '" fill="#fff" fill-opacity=".85"/>' +
      '<path d="M' + r1(x) + ' ' + r1(y - 7 * u) + 'L' + r1(x + 2.4 * u) + ' ' + r1(y + 1 * u) + 'L' + r1(x) + ' ' + r1(y - 0.8 * u) + 'L' + r1(x - 2.4 * u) + ' ' + r1(y + 1 * u) + 'Z" fill="#000"/>' +
      '<text x="' + r1(x) + '" y="' + r1(y + 4.6 * u) + '" font-size="' + r1(2.8 * u) + '" font-family="system-ui,Arial,sans-serif" font-weight="700" text-anchor="middle" fill="#000">N</text>';
  }

  /* ---------- build ---------- */
  function build(o){
    var D = o.data, items = o.items;
    if(!D || !items || !items.length) return '';
    var date = o.date || '';

    var recs = [];      /* one record per item: its index, kind, anchor and street samples */
    items.forEach(function(it, i){
      var r = { it: it, i: i, c: it.c && it.c.length === 2 ? [+it.c[0], +it.c[1]] : null };
      if(it.kind === 's'){ r.samples = sampleLines(lines(it.d).concat(lines(it.dd)), 6); }
      recs.push(r);
    });

    /* detail area: every building and place, with a little room around it */
    var ext = [1e9, 1e9, -1e9, -1e9];
    function grow(x, y){ ext[0] = Math.min(ext[0], x); ext[1] = Math.min(ext[1], y); ext[2] = Math.max(ext[2], x); ext[3] = Math.max(ext[3], y); }
    recs.forEach(function(r){
      if(r.it.kind !== 'b' || !r.c) return;
      if(r.it.rg){ grow(r.c[0], r.c[1]); }
      else { var b = bboxOf(lines(r.it.d)); if(b[0] < 1e8){ grow(b[0], b[1]); grow(b[2], b[3]); } else grow(r.c[0], r.c[1]); }
    });
    var hasDetail = ext[0] < 1e8;

    /* shared drawing, defined once and re-used by every map */
    var defs = '';
    if(D.ctx) defs += '<path id="pm-ctx" d="' + D.ctx + '" fill="#e4e4e4"/>';
    if(D.rc) defs += '<path id="pm-rc" d="' + D.rc + '" fill="none" stroke="#b5b5b5" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>';
    (D.gf || []).forEach(function(g, k){ defs += '<path id="pm-g' + k + '" d="' + g.d + '" fill="#f1f1f1" stroke="#999" stroke-width="1" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>'; });
    recs.forEach(function(r){
      var it = r.it;
      if(it.kind === 's'){
        var wd = Math.max(6, +it.wd || 10);
        defs += '<g id="pm-i' + r.i + '" fill="none" stroke="#c2c2c2" stroke-width="' + wd + '" stroke-linecap="round" stroke-linejoin="round"><path d="' + it.d + '"/>' + (it.dd ? '<path d="' + it.dd + '" stroke-dasharray="9 7" stroke-linecap="butt"/>' : '') + '</g>';
      } else if(it.rg){
        defs += '<path id="pm-i' + r.i + '" d="' + it.d + '" fill="#000" fill-opacity=".07" stroke="#444" stroke-width="1.3" stroke-dasharray="6 4" vector-effect="non-scaling-stroke"/>';
      } else {
        defs += '<path id="pm-i' + r.i + '" d="' + it.d + '" fill="' + (it.lm ? '#ececec' : '#b9b9b9') + '" stroke="#333" stroke-width="' + (it.lm ? 1.1 : 0.8) + '"' + (it.lm ? ' stroke-dasharray="4 3"' : '') + ' stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
      }
    });
    var defsSvg = '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>' + defs + '</defs></svg>';

    function base(rect){
      var s = '<rect x="' + r1(rect.x0 - 5) + '" y="' + r1(rect.y0 - 5) + '" width="' + r1(rect.x1 - rect.x0 + 10) + '" height="' + r1(rect.y1 - rect.y0 + 10) + '" fill="#fff"/>';
      if(D.ctx) s += '<use href="#pm-ctx"/>';
      (D.gf || []).forEach(function(g, k){ s += '<use href="#pm-g' + k + '"/>'; });
      if(D.rc) s += '<use href="#pm-rc"/>';
      recs.forEach(function(r){ if(r.it.kind === 's') s += '<use href="#pm-i' + r.i + '"/>'; });
      recs.forEach(function(r){ if(r.it.kind === 'b' && r.it.rg) s += '<use href="#pm-i' + r.i + '"/>'; });
      recs.forEach(function(r){ if(r.it.kind === 'b' && !r.it.rg) s += '<use href="#pm-i' + r.i + '"/>'; });
      return s;
    }
    function golfLabels(rect, s0){
      var s = '';
      (D.gf || []).forEach(function(g){
        if(g.c && g.c[0] > rect.x0 && g.c[0] < rect.x1 && g.c[1] > rect.y0 && g.c[1] < rect.y1)
          s += '<text x="' + r1(g.c[0]) + '" y="' + r1(g.c[1]) + '" font-size="' + r1(2.4 / s0) + '" font-family="system-ui,Arial,sans-serif" font-weight="600" letter-spacing="' + r1(0.3 / s0) + '" text-anchor="middle" dominant-baseline="central" fill="#777">' + esc((g.t || 'GOLF COURSE').toUpperCase()) + '</text>';
      });
      return s;
    }

    /* what gets a badge inside a rectangle: buildings and places by their centre, streets by their longest stretch */
    function labelsIn(rect, s0, opts){
      var out = [], minRun = opts && opts.minRun || 40;
      recs.forEach(function(r){
        var it = r.it;
        if(it.kind === 's'){
          if(opts && opts.noStreets) return;
          var run = bestRun(r.samples, rect);
          if(!run || run.length * 6 < Math.min(minRun, r.samples.reduce(function(a, l){ return a + l.length * 6; }, 0) * 0.9)) return;
          var sz = badgeSize(it._n, s0), cands = [];
          [0.5, 0.35, 0.65, 0.2, 0.8, 0.1, 0.9].forEach(function(f){ cands.push(run[Math.min(run.length - 1, Math.round((run.length - 1) * f))]); });
          out.push({ r: r, it: it, w: sz.w, h: sz.h, cands: cands, order: 2, anchor: null });
        } else {
          if(!r.c || !inRect(r.c, rect)) return;
          if(opts && opts.onlyAreas && !it.rg) return;
          var sz2 = badgeSize(it._n, s0);
          out.push({ r: r, it: it, w: sz2.w, h: sz2.h, cands: ringCands(r.c[0], r.c[1], sz2.w, sz2.h), order: it.rg ? 0 : 1, anchor: r.c, size: +it.w || 0 });
        }
      });
      out.sort(function(a, b){ return a.order - b.order || (b.size || 0) - (a.size || 0) || a.it._n - b.it._n; });
      return out;
    }

    function drawLabels(entries, s0){
      var back = '', front = '';
      entries.forEach(function(e){
        var x = e.pos[0], y = e.pos[1];
        if(e.anchor){
          var dist = Math.hypot(x - e.anchor[0], y - e.anchor[1]);
          if(dist > e.h * 0.62){
            back += '<line x1="' + r1(e.anchor[0]) + '" y1="' + r1(e.anchor[1]) + '" x2="' + r1(x) + '" y2="' + r1(y) + '" stroke="#000" stroke-width="' + r1(0.2 / s0 * 10) / 10 + '"/>' +
              '<circle cx="' + r1(e.anchor[0]) + '" cy="' + r1(e.anchor[1]) + '" r="' + r1(0.55 / s0) + '" fill="#000"/>';
          }
        }
        front += badgeSvg(e.it, x, y, e.w, e.h, s0);
      });
      return back + front;
    }

    /* ---------- one page: the whole patrol map ---------- */
    if(!hasDetail) return '';
    var pad = 25, rect = { x0: ext[0] - pad, y0: ext[1] - pad, x1: ext[2] + pad, y1: ext[3] + pad };
    /* streets that run only outside the buildings (the patrol boundary) still need a badge: widen the page to reach them */
    recs.forEach(function(r){
      if(r.it.kind !== 's') return;
      var total = 0; r.samples.forEach(function(l){ total += l.length * 6; });
      var run = bestRun(r.samples, rect);
      if(run && run.length * 6 >= Math.min(60, total * 0.9)) return;
      var best = null, bd = 1e12;
      r.samples.forEach(function(l){ l.forEach(function(p){
        var dx = Math.max(rect.x0 - p[0], 0, p[0] - rect.x1), dy = Math.max(rect.y0 - p[1], 0, p[1] - rect.y1), dd = dx * dx + dy * dy;
        if(dd < bd){ bd = dd; best = p; }
      }); });
      if(best){ rect.x0 = Math.min(rect.x0, best[0] - 90); rect.x1 = Math.max(rect.x1, best[0] + 90); rect.y0 = Math.min(rect.y0, best[1] - 60); rect.y1 = Math.max(rect.y1, best[1] + 60); }
    });
    /* match the page shape so nothing is wasted */
    var A = MM_W / MM_H, cw = rect.x1 - rect.x0, chh = rect.y1 - rect.y0;
    if(cw / chh > A){ var nh = cw / A, dy2 = (nh - chh) / 2; rect.y0 -= dy2; rect.y1 += dy2; }
    else { var nw = chh * A, dx2 = (nw - cw) / 2; rect.x0 -= dx2; rect.x1 += dx2; }
    var s0 = MM_W / (rect.x1 - rect.x0);
    var ents = labelsIn(rect, s0), taken = [];
    place(ents, rect, s0, taken);
    var svg = '<svg viewBox="' + r1(rect.x0) + ' ' + r1(rect.y0) + ' ' + r1(rect.x1 - rect.x0) + ' ' + r1(rect.y1 - rect.y0) + '" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">' +
      base(rect) + golfLabels(rect, s0) + drawLabels(ents, s0) + scaleBar(rect, s0) + northArrow(rect, s0) + '</svg>';
    var legend = '<span class="bd rq">12</span> required to pass &nbsp;<span class="bd">12</span> other item &nbsp;<span class="bd ex">12</span> left out of the test &nbsp;&middot;&nbsp; round badge = building or place, <span class="bd sq">12</span> = street &nbsp;&middot;&nbsp; dashed outline = landmark or area &nbsp;&middot;&nbsp; a dot and a line point to the item when its badge had to move aside';
    var pages = '<section class="mp"><div class="mh"><div><h1>PSSP Campus Map Test: building and street map</h1><div class="ms">Each number matches the numbered list. ' + ents.length + ' of ' + items.length + ' items shown' + (date ? ' &middot; Printed ' + esc(date) : '') + '</div><div class="mg">' + legend + '</div></div></div><div class="mw">' + svg + '</div></section>';

    return '<style>' + CSS + '</style>' + defsSvg + pages;
  }

  root.PSSPMapPrint = { build: build };
})(typeof window !== 'undefined' ? window : this);
