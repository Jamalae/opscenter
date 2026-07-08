/* Workforce State Coverage Map
   Renders a D3 choropleth inside #wfStateMap, driven by the same
   published workbook that OpsSheets already uses. */
(function () {
  'use strict';

  var SOURCE_OVERRIDES = window.OPS_CENTER_SOURCE_OVERRIDES || {};
  var CSV_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTUQ5bqosxRzkSWO_xPAp6EauqGTV01N0meOZekSRzW93Z3DbPGbU4xpFnrvAgH4QhQF5QZHi7wp1-r/pub';
  var GID_WORKFORCE = '1575031700';
  var GID_NEWHIRING = '1396856298';
  var TOPO_URL = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json';

  var SA = {Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",Delaware:"DE",Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH","New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",Wisconsin:"WI",Wyoming:"WY","District of Columbia":"DC"};
  var AS = {};
  Object.keys(SA).forEach(function (k) { AS[SA[k]] = k; });

  var allEmp = [];
  var stateData = {};
  var selState = null;
  var filt = 'all';

  function parseCSV(text) {
    var rows = [];
    var lines = text.split(/\r?\n/);
    for (var li = 0; li < lines.length; li++) {
      var line = lines[li];
      if (!line.trim()) continue;
      var row = [], i = 0, field = '', inQ = false;
      while (i <= line.length) {
        var ch = line[i];
        if (inQ) {
          if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 2; }
          else if (ch === '"') { inQ = false; i++; }
          else { field += (ch || ''); i++; }
        } else {
          if (ch === '"') { inQ = true; i++; }
          else if (ch === ',' || i === line.length) { row.push(field.trim()); field = ''; i++; }
          else { field += ch; i++; }
        }
      }
      rows.push(row);
    }
    return rows;
  }

  function normState(s) {
    if (!s) return null;
    s = s.trim();
    if (SA[s]) return s;
    var u = s.toUpperCase();
    if (AS[u]) return AS[u];
    var l = s.toLowerCase();
    for (var n in SA) { if (n.toLowerCase() === l) return n; }
    return null;
  }

  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

  function getColor(n) {
    if (n === 0) return '#1a1f35';
    if (n <= 2) return '#312e81';
    if (n <= 5) return '#4338ca';
    if (n <= 10) return '#6366f1';
    if (n <= 20) return '#818cf8';
    return '#a5b4fc';
  }

  function getCsvUrl(overrideKey, gid) {
    var override = SOURCE_OVERRIDES[overrideKey];
    if (override && override !== 'disabled') return override;
    return CSV_BASE + '?gid=' + gid + '&single=true&output=csv';
  }

  function fetchText(url, bust) {
    return fetch(url + (url.indexOf('?') >= 0 ? '&' : '?') + 'cachebust=' + bust).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }

  function normalizeHeader(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function rowToObject(headers, row) {
    var obj = {};
    for (var i = 0; i < headers.length; i++) {
      obj[headers[i]] = row[i] || '';
    }
    return obj;
  }

  function getValue(obj, aliases) {
    for (var i = 0; i < aliases.length; i++) {
      var key = normalizeHeader(aliases[i]);
      if (obj[key] != null && String(obj[key]).trim()) return String(obj[key]).trim();
    }
    return '';
  }

  function init() {
    var bust = Date.now();
    Promise.all([
      fetchText(getCsvUrl('currentWorkforce', GID_WORKFORCE), bust),
      fetchText(getCsvUrl('newHiring', GID_NEWHIRING), bust),
      fetch(TOPO_URL).then(function (r) { return r.json(); })
    ]).then(function (results) {
      var cwText = results[0], nhText = results[1], topo = results[2];
      var cw = parseCSV(cwText);
      for (var i = 1; i < cw.length; i++) {
        var r = cw[i];
        if (!r || r.length < 4) continue;
        var nm = r[0] || '', st = (r[2] || '').trim(), raw = r[3] || '', sp = r[5] || '', ct = r[6] || '', lic = r[4] || '';
        var parts = raw.split(/[,\/]/).map(function (s) { return s.trim(); }).filter(Boolean);
        for (var p = 0; p < parts.length; p++) {
          var state = normState(parts[p]);
          if (state && nm) allEmp.push({ name: nm, state: state, specialty: sp, source: 'active', status: st, contract: ct, license: lic, extra: '' });
        }
      }
      var nh = parseCSV(nhText);
      var nhHeaders = (nh[0] || []).map(normalizeHeader);
      for (var j = 1; j < nh.length; j++) {
        var rn = nh[j];
        if (!rn || rn.length < 4) continue;
        var nhRow = rowToObject(nhHeaders, rn);
        var nm2 = getValue(nhRow, ['Candidate Name', 'Name']) || rn[0] || '';
        var raw2 = getValue(nhRow, ['Licensed state', 'State']) || rn[2] || '';
        var sp2 = getValue(nhRow, ['License Type', 'Speciality', 'Specialty']) || rn[3] || '';
        var is2 = getValue(nhRow, ['Status', 'Interview Status']) || '';
        var rate = getValue(nhRow, ['Rate', 'Comments']) || '';
        var parts2 = raw2.split(/[,\/]/).map(function (s) { return s.trim(); }).filter(Boolean);
        for (var q = 0; q < parts2.length; q++) {
          var state2 = normState(parts2[q]);
          if (state2 && nm2) allEmp.push({ name: nm2, state: state2, specialty: sp2, source: 'hiring', status: is2, contract: '', license: '', extra: rate ? '$' + rate + '/hr' : '' });
        }
      }
      allEmp.forEach(function (e) {
        if (!stateData[e.state]) stateData[e.state] = { active: [], hiring: [] };
        stateData[e.state][e.source].push(e);
      });
      var allStates = {};
      allEmp.forEach(function (e) { allStates[e.state] = true; });
      var ac = allEmp.filter(function (e) { return e.source === 'active'; }).length;
      var hc = allEmp.filter(function (e) { return e.source === 'hiring'; }).length;
      setText('wf-states', Object.keys(allStates).length);
      setText('wf-active', ac);
      setText('wf-hiring', hc);
      setText('wf-total', ac + hc);
      setText('wfMapSummary', Object.keys(allStates).length + ' states · ' + ac + ' active · ' + hc + ' hiring');
      drawMap(topo);
    }).catch(function (err) {
      var el = document.getElementById('wfStateMap');
      if (el) el.innerHTML = '<p style="color:#ef4444;padding:20px;">Error loading workforce map: ' + err.message + '</p>';
    });
  }

  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function drawMap(topo) {
    var container = document.getElementById('wfStateMap');
    if (!container) return;
    container.innerHTML = '';
    var svg = d3.select(container).append('svg')
      .attr('viewBox', '0 0 960 600')
      .attr('width', '100%')
      .style('max-height', '500px');
    var projection = d3.geoAlbersUsa().scale(1200).translate([480, 300]);
    var path = d3.geoPath(projection);
    var states = topojson.feature(topo, topo.objects.states).features;
    svg.selectAll('path').data(states).join('path')
      .attr('d', path)
      .attr('stroke', 'rgba(255,255,255,0.15)')
      .attr('stroke-width', 1)
      .attr('fill', function (d) {
        var sd = stateData[d.properties.name];
        var n = sd ? sd.active.length + sd.hiring.length : 0;
        return getColor(n);
      })
      .attr('cursor', 'pointer')
      .on('click', function (ev, d) {
        selState = d.properties.name;
        showDetail();
        svg.selectAll('path').attr('stroke', 'rgba(255,255,255,0.15)').attr('stroke-width', 1);
        d3.select(this).attr('stroke', '#a5b4fc').attr('stroke-width', 2.5);
      });
    svg.selectAll('text').data(states).join('text')
      .attr('x', function (d) { var c = path.centroid(d); return c[0] || 0; })
      .attr('y', function (d) { var c = path.centroid(d); return c[1] || 0; })
      .attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .attr('font-size', '11px').attr('font-weight', '600').attr('pointer-events', 'none')
      .attr('fill', function (d) {
        var sd = stateData[d.properties.name];
        var n = sd ? sd.active.length + sd.hiring.length : 0;
        return n > 0 ? '#fff' : 'rgba(255,255,255,0.15)';
      })
      .text(function (d) {
        var sd = stateData[d.properties.name];
        var n = sd ? sd.active.length + sd.hiring.length : 0;
        return n > 0 ? (SA[d.properties.name] || '') + ' ' + n : '';
      });
    var leg = document.getElementById('wfMapLegend');
    if (leg) {
      var items = [
        { c: '#1a1f35', l: '0' }, { c: '#312e81', l: '1-2' }, { c: '#4338ca', l: '3-5' },
        { c: '#6366f1', l: '6-10' }, { c: '#818cf8', l: '11-20' }, { c: '#a5b4fc', l: '20+' }
      ];
      leg.innerHTML = items.map(function (it) {
        return '<span style="display:flex;align-items:center;gap:6px;"><span style="width:14px;height:10px;border-radius:2px;background:' + it.c + ';border:1px solid rgba(255,255,255,0.15);"></span>' + it.l + '</span>';
      }).join('');
    }
  }

  function showDetail() {
    var panel = document.getElementById('workforce-detail-card');
    if (!panel || !selState) return;
    panel.style.display = '';
    var sd = stateData[selState] || { active: [], hiring: [] };
    var tot = sd.active.length + sd.hiring.length;
    setText('wfDetailTitle', selState + ' (' + (SA[selState] || '') + ')');
    setText('wfDetailSub', tot + ' employee' + (tot !== 1 ? 's' : '') + ' - ' + sd.active.length + ' active, ' + sd.hiring.length + ' hiring');
    wfRenderList();
  }

  window.closeWfDetail = function () {
    var panel = document.getElementById('workforce-detail-card');
    if (panel) panel.style.display = 'none';
    selState = null;
  };

  window.wfFilter = function (f) {
    filt = f;
    document.querySelectorAll('[data-wf]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-wf') === f);
    });
    wfRenderList();
  };

  window.wfRenderList = function () {
    if (!selState) return;
    var sd = stateData[selState] || { active: [], hiring: [] };
    var list = filt === 'all' ? sd.active.concat(sd.hiring) : filt === 'active' ? sd.active : sd.hiring;
    var q = (document.getElementById('wfSearch') || {}).value || '';
    q = q.toLowerCase();
    if (q) list = list.filter(function (e) { return (e.name + ' ' + e.specialty + ' ' + e.status).toLowerCase().indexOf(q) >= 0; });
    list.sort(function (a, b) { return a.source !== b.source ? (a.source === 'active' ? -1 : 1) : a.name.localeCompare(b.name); });
    var el = document.getElementById('wfEmpList');
    if (!el) return;
    if (!list.length) { el.innerHTML = '<p class="muted" style="text-align:center;padding:20px;">No employees match your filters</p>'; return; }
    el.innerHTML = list.map(function (e) {
      var srcClass = e.source === 'active' ? 'badge badge-green' : 'badge badge-pink';
      var srcLabel = e.source === 'active' ? 'Active' : 'Hiring';
      var det = [];
      if (e.specialty) det.push(e.specialty);
      if (e.license) det.push('Lic: ' + e.license);
      if (e.contract) det.push(e.contract);
      if (e.status && e.source === 'hiring') det.push(e.status);
      if (e.extra) det.push(e.extra);
      return '<div class="note-card" style="margin-bottom:6px;padding:10px 14px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
        '<strong>' + esc(e.name) + '</strong>' +
        '<span class="' + srcClass + '">' + srcLabel + '</span>' +
        '</div>' +
        (det.length ? '<div class="muted" style="font-size:12px;margin-top:4px;">' + esc(det.join(' · ')) + '</div>' : '') +
        '</div>';
    }).join('');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
