// ── Config ────────────────────────────────────────────────────────────────────
const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTuXNK7TOq8O2WXfMf4fTSxXYqAJVCCGVx2WCpL_LhwTyAb-mLg4EGauKK9jaJEXw/pub?output=csv';

// ── CSV Parsing ───────────────────────────────────────────────────────────────
function parseCSVRow(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (c === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
  const col = (name) => headers.indexOf(name.toLowerCase().trim());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parsed = [];

  lines.slice(1).forEach((line, idx) => {
    const cols = parseCSVRow(line);
    const get = (name) => {
      const i = col(name);
      return i >= 0 ? (cols[i] || '').trim() : '';
    };

    const patientName = get('patient name');
    if (!patientName) return; // skip blank rows

    const rawStatus  = get('status');
    const payer      = get('payer');
    const provider   = get('provider');
    const state      = get('state');
    const diagnosis  = get('diagnosis');
    const dob        = get('dob');
    const notes      = get('notes');
    const submittedStr = get('date submitted');
    const followupStr  = get('follow-up date');

    // Parse dates
    const submittedDate = submittedStr ? new Date(submittedStr) : null;
    const followupDate  = followupStr  ? new Date(followupStr)  : null;

    // staleDays = days since submission
    let staleDays = 0;
    if (submittedDate && !isNaN(submittedDate)) {
      staleDays = Math.max(0, Math.floor((today - submittedDate) / 86400000));
    }

    // due label from follow-up date
    let due = 'No date';
    if (followupDate && !isNaN(followupDate)) {
      const diff = Math.floor((followupDate - today) / 86400000);
      if (diff < 0)      due = 'Overdue';
      else if (diff === 0) due = 'Today';
      else if (diff === 1) due = 'Tomorrow';
      else                due = followupStr;
    }

    // Map raw status → app status
    const statusMap = {
      'denied':       'Blocked',
      'blocked':      'Blocked',
      'pending':      'Open',
      'submitted':    'Open',
      'open':         'Open',
      'in progress':  'In Progress',
      'under review': 'In Progress',
      'approved':     'Monitoring',
      'closed':       'Monitoring',
      'escalated':    'Escalated',
    };
    const status = statusMap[(rawStatus || '').toLowerCase()] || 'Open';

    // Derive priority
    let priority = 'medium';
    if (status === 'Blocked')    priority = 'critical';
    else if (due === 'Overdue' || status === 'Escalated') priority = 'high';
    else if (status === 'Monitoring') priority = 'low';

    // Build notes string
    const noteParts = [];
    if (diagnosis)   noteParts.push(diagnosis);
    if (dob)         noteParts.push(`DOB: ${dob}`);
    if (notes)       noteParts.push(notes);

    parsed.push({
      id:        idx + 1,
      issue:     `SCA – ${patientName}`,
      owner:     provider || 'Unassigned',
      category:  payer    || 'Unknown',
      state:     state    || '—',
      status,
      priority,
      impact:    staleDays, // repurposed: "days open"
      due,
      staleDays,
      notes:     noteParts.join(' · '),
      _rawStatus:    rawStatus,
      _dateSubmitted: submittedDate,
      _followupDate:  followupDate,
      _diagnosis: diagnosis,
    });
  });

  return parsed;
}

// ── Static Data (not yet in sheet) ───────────────────────────────────────────
const systems = [
  { name: 'n8n · Meta · Well-America', severity: 'Failed',  note: 'Auth failure, token blocked sync', owner: 'Dev' },
  { name: 'Google Ads · Ads ingest',   severity: 'Warning', note: 'Config mismatch, monitor closely',  owner: 'Dev' },
  { name: 'Website · Referral form',   severity: 'Healthy', note: 'Patched field mapping',              owner: 'Ops' },
  { name: 'EMR bridge · Claim intake', severity: 'Healthy', note: 'No error in last 24h',              owner: 'Clinical Ops' },
];

const patientFlowStats = {
  activePatients: 228,
  newIntakes: 21,
  avgShowRate: 89.9,
  noShows: 11,
  stateScores: [
    { state: 'WA', pts: 96, note: 'Show rate 91.7%' },
    { state: 'CA', pts: 79, note: 'Show rate 88.2%' },
    { state: 'FL', pts: 35, note: 'Show rate 89.5%' },
    { state: 'NY', pts: 18, note: 'Show rate 90%' },
  ]
};

const kpiDefs = [
  { id: 'blocked',   label: 'Denied / Blocked',       type: 'count'   },
  { id: 'overdue',   label: 'Overdue Follow-ups',      type: 'count'   },
  { id: 'new7d',     label: 'New SCAs (7d)',            type: 'count'   },
  { id: 'nofollowup',label: 'Missing Follow-up Date',  type: 'count'   },
  { id: 'total',     label: 'Total SCA Cases',          type: 'count'   },
  { id: 'approval',  label: 'Approval Rate',            type: 'percent' },
];

// ── Live Data ─────────────────────────────────────────────────────────────────
let issues = [];
let criticalActions = [];

// ── App State ─────────────────────────────────────────────────────────────────
const state = { kpi: null, owner: 'all', st: 'all', category: 'all', status: 'all', q: '' };

const el = {
  kpiGrid:             document.getElementById('kpiGrid'),
  ownerFilter:         document.getElementById('ownerFilter'),
  stateFilter:         document.getElementById('stateFilter'),
  categoryFilter:      document.getElementById('categoryFilter'),
  statusFilter:        document.getElementById('statusFilter'),
  searchInput:         document.getElementById('searchInput'),
  criticalActionsTable:document.getElementById('criticalActionsTable'),
  criticalCount:       document.getElementById('criticalCount'),
  ownerTable:          document.getElementById('ownerTable'),
  issuesTable:         document.getElementById('issuesTable'),
  resultsSummary:      document.getElementById('resultsSummary'),
  revenueRisk:         document.getElementById('revenueRisk'),
  patientFlow:         document.getElementById('patientFlow'),
  systemHealth:        document.getElementById('systemHealth'),
  clearFilters:        document.getElementById('clearFilters'),
  refreshBtn:          document.getElementById('refreshBtn'),
};

// ── Utilities ─────────────────────────────────────────────────────────────────
function uniq(values) { return [...new Set(values)].filter(Boolean).sort(); }
function pct(v)       { return `${v.toFixed(1)}%`; }

function fillSelect(select, label, values) {
  const opts = ['<option value="all">' + label + '</option>']
    .concat(values.map(v => `<option value="${v}">${v}</option>`));
  select.innerHTML = opts.join('');
}

function initFilters() {
  fillSelect(el.ownerFilter,    'All providers', uniq(issues.map(i => i.owner)));
  fillSelect(el.stateFilter,    'All states',    uniq(issues.map(i => i.state)));
  fillSelect(el.categoryFilter, 'All payers',    uniq(issues.map(i => i.category)));
  fillSelect(el.statusFilter,   'All statuses',  uniq(issues.map(i => i.status)));
}

function matchesFilters(i) {
  const q = state.q.trim().toLowerCase();
  const kpiMatch = !state.kpi || (() => {
    if (state.kpi === 'blocked')    return i.status === 'Blocked';
    if (state.kpi === 'overdue')    return i.due === 'Overdue';
    if (state.kpi === 'total')      return true;
    if (state.kpi === 'approval')   return i._rawStatus && i._rawStatus.toLowerCase() === 'approved';
    if (state.kpi === 'nofollowup') return !i._followupDate;
    if (state.kpi === 'new7d') {
      const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
      return i._dateSubmitted && i._dateSubmitted >= sevenAgo;
    }
    return true;
  })();
  return kpiMatch
    && (state.owner === 'all'    || i.owner === state.owner)
    && (state.st === 'all'       || i.state === state.st)
    && (state.category === 'all' || i.category === state.category)
    && (state.status === 'all'   || i.status === state.status)
    && (!q || i.issue.toLowerCase().includes(q)
           || i.notes.toLowerCase().includes(q)
           || i.owner.toLowerCase().includes(q)
           || i.category.toLowerCase().includes(q));
}

function filtered() { return issues.filter(matchesFilters); }

// ── KPIs ──────────────────────────────────────────────────────────────────────
function kpiValue(def) {
  if (!issues.length) return '—';
  const sevenAgo = new Date(); sevenAgo.setDate(sevenAgo.getDate() - 7);
  if (def.id === 'blocked')    return String(issues.filter(i => i.status === 'Blocked').length);
  if (def.id === 'overdue')    return String(issues.filter(i => i.due === 'Overdue').length);
  if (def.id === 'new7d')      return String(issues.filter(i => i._dateSubmitted && i._dateSubmitted >= sevenAgo).length);
  if (def.id === 'nofollowup') return String(issues.filter(i => !i._followupDate).length);
  if (def.id === 'total')      return String(issues.length);
  if (def.id === 'approval') {
    const approved = issues.filter(i => (i._rawStatus || '').toLowerCase() === 'approved').length;
    return pct((approved / issues.length) * 100);
  }
  return '0';
}

function renderKpis() {
  el.kpiGrid.innerHTML = kpiDefs.map(def => {
    const active = state.kpi === def.id ? 'active' : '';
    const val = kpiValue(def);
    // Red for blocked/overdue, green for approval, neutral otherwise
    const dir = (def.id === 'approval') ? 'down' : 'up';
    return `<button type="button" class="kpi ${active}" data-kpi="${def.id}">
      <div class="k">${def.label}</div>
      <div class="v">${val}</div>
    </button>`;
  }).join('');
  el.kpiGrid.querySelectorAll('.kpi').forEach(btn => btn.addEventListener('click', () => {
    const id = btn.getAttribute('data-kpi');
    state.kpi = state.kpi === id ? null : id;
    render();
  }));
}

// ── Render Functions ──────────────────────────────────────────────────────────
function badgePriority(p) { return `<span class="badge priority-${p}">${p}</span>`; }
function badgeStatus(s) {
  const c = s === 'Blocked' ? 'status-blocked' : (s === 'In Progress' ? 'status-progress' : 'status-open');
  return `<span class="${c}">${s}</span>`;
}

function renderIssues() {
  const rows = filtered();
  el.issuesTable.innerHTML = rows.slice(0, 180).map(i => `<tr>
    <td>${i.issue}<div class="muted">${i.notes}</div></td>
    <td>${i.owner}</td>
    <td>${i.category}</td>
    <td>${badgeStatus(i.status)}</td>
    <td>${badgePriority(i.priority)}</td>
    <td>${i.state}</td>
    <td>${i.staleDays}d</td>
    <td>${i.due}</td>
    <td>${i._diagnosis || '—'}</td>
  </tr>`).join('') || '<tr><td colspan="9" style="text-align:center;padding:2rem;">No SCA cases match current filters.</td></tr>';
  el.resultsSummary.textContent = `${rows.length} cases${rows.length > 180 ? ' (showing first 180)' : ''}`;
}

function renderCritical() {
  // Derive critical actions: overdue or blocked, sorted by staleDays desc
  criticalActions = issues
    .filter(i => i.status === 'Blocked' || i.due === 'Overdue')
    .sort((a, b) => b.staleDays - a.staleDays)
    .slice(0, 8)
    .map(i => ({
      issue:      i.issue,
      owner:      i.owner,
      due:        i.due,
      daysOpen:   i.staleDays,
      status:     i.status,
      nextAction: i.notes || 'Review case and follow up with payer',
    }));

  el.criticalActionsTable.innerHTML = criticalActions.length
    ? criticalActions.map(c => `<tr>
        <td>${c.issue}</td>
        <td>${c.owner}</td>
        <td>${c.due}</td>
        <td>${c.daysOpen}d open</td>
        <td>${badgeStatus(c.status)}</td>
        <td>${c.nextAction}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:1.5rem;">No blocked or overdue cases.</td></tr>';
  el.criticalCount.textContent = criticalActions.length
    ? `${criticalActions.length} items need action`
    : 'All clear';
}

function renderOwners() {
  const map = {};
  filtered().forEach(i => {
    if (!map[i.owner]) map[i.owner] = { owner: i.owner, open: 0, overdue: 0, cases: 0, stale: 0 };
    map[i.owner].open   += (i.status !== 'Monitoring') ? 1 : 0;
    map[i.owner].overdue += i.due === 'Overdue' ? 1 : 0;
    map[i.owner].cases  += 1;
    map[i.owner].stale  += i.staleDays >= 7 ? 1 : 0;
  });
  const rows = Object.values(map).sort((a, b) => b.cases - a.cases).slice(0, 8);
  el.ownerTable.innerHTML = rows.length
    ? rows.map(r => `<tr>
        <td>${r.owner}</td><td>${r.open}</td><td>${r.overdue}</td><td>${r.cases}</td><td>${r.stale}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;">No data for current filters.</td></tr>';
}

function renderRevenue() {
  // Show top payers by case count
  const byPayer = {};
  issues.forEach(i => { byPayer[i.category] = (byPayer[i.category] || 0) + 1; });
  const top   = Object.entries(byPayer).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const total = top.reduce((s, [, v]) => s + v, 0);
  el.revenueRisk.innerHTML = top.length
    ? top.map(([payer, count]) => {
        const w = Math.round((count / Math.max(total, 1)) * 100);
        return `<div class="system-item">
          <div class="card-head"><strong>${payer}</strong><strong>${count} cases</strong></div>
          <div class="meter"><span style="width:${w}%"></span></div>
        </div>`;
      }).join('')
    : '<p class="muted" style="padding:1rem;">No data yet.</p>';
}

function renderPatientFlow() {
  const s = patientFlowStats;
  const chips = `<div class="card-head"><strong>Active patients ${s.activePatients}</strong><strong>New intakes ${s.newIntakes}</strong></div>
    <div class="muted">Avg show rate ${pct(s.avgShowRate)} · No-shows ${s.noShows}</div>`;
  const states = s.stateScores.map(x =>
    `<div class="system-item">
      <div class="card-head"><strong>${x.state}</strong><strong>${x.pts} pts</strong></div>
      <div class="meter"><span style="width:${x.pts}%"></span></div>
      <div class="muted">${x.note}</div>
    </div>`
  ).join('');
  el.patientFlow.innerHTML = chips + states;
}

function renderSystems() {
  el.systemHealth.innerHTML = systems.map(s =>
    `<div class="system-item">
      <div class="card-head"><strong>${s.name}</strong><strong>${s.severity}</strong></div>
      <div class="muted">${s.note}</div>
      <div class="muted">Owner: ${s.owner}</div>
    </div>`
  ).join('');
}

function render() {
  renderKpis();
  renderIssues();
  renderCritical();
  renderOwners();
  renderRevenue();
  renderPatientFlow();
  renderSystems();
}

// ── Event Binding ─────────────────────────────────────────────────────────────
function bind() {
  el.ownerFilter.addEventListener('change',    e => { state.owner    = e.target.value; render(); });
  el.stateFilter.addEventListener('change',    e => { state.st       = e.target.value; render(); });
  el.categoryFilter.addEventListener('change', e => { state.category = e.target.value; render(); });
  el.statusFilter.addEventListener('change',   e => { state.status   = e.target.value; render(); });
  el.searchInput.addEventListener('input',     e => { state.q        = e.target.value; render(); });
  el.clearFilters.addEventListener('click', () => {
    state.kpi = null; state.owner = 'all'; state.st = 'all';
    state.category = 'all'; state.status = 'all'; state.q = '';
    el.ownerFilter.value = 'all'; el.stateFilter.value = 'all';
    el.categoryFilter.value = 'all'; el.statusFilter.value = 'all';
    el.searchInput.value = '';
    render();
  });
  el.refreshBtn.addEventListener('click', () => loadData());
}

// ── Data Loading ──────────────────────────────────────────────────────────────
async function loadData() {
  // Show loading state
  el.issuesTable.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;">Loading from Google Sheets…</td></tr>';
  el.criticalActionsTable.innerHTML = '';
  el.criticalCount.textContent = '';

  try {
    const bust = Date.now(); // prevent stale cache
    const res  = await fetch(`${CSV_URL}&cachebust=${bust}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    issues = parseCSV(text);
  } catch (err) {
    console.error('Failed to load sheet:', err);
    el.issuesTable.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#c00;">
      Could not load data from Google Sheets.<br>
      <small>Make sure the sheet is published (File → Share → Publish to web).</small>
    </td></tr>`;
    el.resultsSummary.textContent = 'Load error';
    return;
  }

  initFilters();
  render();

  // Update header status
  const liveEl = document.querySelector('.live-dot');
  if (liveEl) {
    liveEl.textContent = issues.length
      ? `● Live · ${issues.length} cases loaded`
      : '● Connected · Sheet is empty — add rows to see data';
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
bind();
loadData();
