const state = {
  owner: 'all',
  payer: 'all',
  st: 'all',
  status: 'all',
  priority: 'all',
  q: '',
  kpi: null,
};

let model = null;

const el = {
  kpiGrid: document.getElementById('kpiGrid'),
  ownerFilter: document.getElementById('ownerFilter'),
  payerFilter: document.getElementById('payerFilter'),
  stateFilter: document.getElementById('stateFilter'),
  statusFilter: document.getElementById('statusFilter'),
  priorityFilter: document.getElementById('priorityFilter'),
  searchInput: document.getElementById('searchInput'),
  criticalActionsTable: document.getElementById('criticalActionsTable'),
  criticalCount: document.getElementById('criticalCount'),
  ownerTable: document.getElementById('ownerTable'),
  issuesTable: document.getElementById('issuesTable'),
  resultsSummary: document.getElementById('resultsSummary'),
  revenueRisk: document.getElementById('revenueRisk'),
  patientFlow: document.getElementById('patientFlow'),
  systemHealth: document.getElementById('systemHealth'),
  attentionPanel: document.getElementById('attentionPanel'),
  attentionCount: document.getElementById('attentionCount'),
  dataNotes: document.getElementById('dataNotes'),
  dataCoverage: document.getElementById('dataCoverage'),
  clearFilters: document.getElementById('clearFilters'),
  refreshBtn: document.getElementById('refreshBtn'),
  liveDot: document.querySelector('.live-dot'),
};

function uniq(values) {
  return [...new Set(values)].filter(Boolean).sort((a, b) => String(a).localeCompare(String(b)));
}

function fillSelect(select, label, values) {
  select.innerHTML = ['<option value="all">' + label + '</option>']
    .concat(values.map((value) => `<option value="${value}">${value}</option>`))
    .join('');
}

function money(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDate(date) {
  if (!date) return 'No date';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function relativeFollowUp(item) {
  if (!item.followUpDate) return 'No follow-up';
  return item.isOverdue ? 'Overdue' : formatDate(item.followUpDate);
}

function formatKpiValue(card) {
  if (card.format === 'currency') return money(card.value);
  if (card.format === 'percent') return percent(card.value);
  return String(card.value);
}

function filterCases() {
  if (!model) return [];

  const query = state.q.trim().toLowerCase();
  return model.cases.filter((item) => {
    const kpiMatch = !state.kpi || (() => {
      if (state.kpi === 'openCases') return item.rawStatus !== 'Approved';
      if (state.kpi === 'overdue') return item.isOverdue || item.overdueTaskCount > 0;
      if (state.kpi === 'denied') return item.rawStatus === 'Denied' || item.denialCount > 0;
      if (state.kpi === 'claimExposure') return item.pendingClaimAmount > 0;
      if (state.kpi === 'approvalRate') return item.rawStatus === 'Approved';
      if (state.kpi === 'referralConversion') return item.referralStatus === 'Converted';
      return true;
    })();

    return kpiMatch
      && (state.owner === 'all' || item.owner === state.owner)
      && (state.payer === 'all' || item.payer === state.payer)
      && (state.st === 'all' || item.state === state.st)
      && (state.status === 'all' || item.rawStatus === state.status)
      && (state.priority === 'all' || item.priority === state.priority)
      && (!query
        || item.patientName.toLowerCase().includes(query)
        || item.payer.toLowerCase().includes(query)
        || item.owner.toLowerCase().includes(query)
        || item.provider.toLowerCase().includes(query)
        || item.notes.toLowerCase().includes(query)
        || item.diagnosis.toLowerCase().includes(query));
  });
}

function initFilters() {
  fillSelect(el.ownerFilter, 'All owners', uniq(model.cases.map((item) => item.owner)));
  fillSelect(el.payerFilter, 'All payers', uniq(model.cases.map((item) => item.payer)));
  fillSelect(el.stateFilter, 'All states', uniq(model.cases.map((item) => item.state)));
  fillSelect(el.statusFilter, 'All statuses', uniq(model.cases.map((item) => item.rawStatus)));
  fillSelect(el.priorityFilter, 'All priorities', uniq(model.cases.map((item) => item.priority)));
}

function badgePriority(priority) {
  const tone = priority === 'High' ? 'critical' : priority === 'Medium' ? 'medium' : 'low';
  return `<span class="badge priority-${tone}">${priority}</span>`;
}

function badgeStatus(status) {
  const className = status === 'Denied'
    ? 'status-blocked'
    : status === 'Approved'
      ? 'status-approved'
      : 'status-open';
  return `<span class="${className}">${status}</span>`;
}

function renderKpis() {
  el.kpiGrid.innerHTML = model.metrics.cards.map((card) => {
    const active = state.kpi === card.id ? 'active' : '';
    const tone = card.tone || '';
    return `<button type="button" class="kpi ${active} ${tone}" data-kpi="${card.id}">
      <div class="k">${card.label}</div>
      <div class="v">${formatKpiValue(card)}</div>
      <div class="d">${card.id === 'claimExposure' ? `${model.metrics.totals.claims} claims loaded` : `${model.metrics.totals.cases} cases loaded`}</div>
    </button>`;
  }).join('');

  el.kpiGrid.querySelectorAll('.kpi').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.getAttribute('data-kpi');
      state.kpi = state.kpi === id ? null : id;
      render();
    });
  });
}

function renderCritical(filteredCases) {
  const criticalRows = filteredCases
    .filter((item) => item.isOverdue || item.isBlocked)
    .sort((a, b) => {
      const scoreA = (a.isOverdue ? 2 : 0) + (a.isBlocked ? 2 : 0) + a.daysOpen;
      const scoreB = (b.isOverdue ? 2 : 0) + (b.isBlocked ? 2 : 0) + b.daysOpen;
      return scoreB - scoreA;
    })
    .slice(0, 8);

  el.criticalActionsTable.innerHTML = criticalRows.length
    ? criticalRows.map((item) => `<tr>
        <td>${item.patientName}<div class="table-note">${item.provider} · ${item.diagnosis || 'No diagnosis'}</div></td>
        <td>${item.owner}</td>
        <td>${relativeFollowUp(item)}</td>
        <td>${item.daysOpen}d</td>
        <td>${badgeStatus(item.rawStatus)}</td>
        <td>${item.notes || item.attentionReasons.join(' · ') || 'Review case and contact payer'}</td>
      </tr>`).join('')
    : '<tr><td colspan="6" style="text-align:center;padding:1.5rem;">No urgent cases in the current filter scope.</td></tr>';

  el.criticalCount.textContent = criticalRows.length
    ? `${criticalRows.length} action items`
    : 'All clear';
}

function renderOwners(filteredCases) {
  const ownerMap = {};
  filteredCases.forEach((item) => {
    if (!ownerMap[item.owner]) {
      ownerMap[item.owner] = { owner: item.owner, open: 0, overdue: 0, totalCases: 0, stale: 0 };
    }
    ownerMap[item.owner].open += item.rawStatus === 'Approved' ? 0 : 1;
    ownerMap[item.owner].overdue += item.isOverdue ? 1 : 0;
    ownerMap[item.owner].totalCases += 1;
    ownerMap[item.owner].stale += item.isStale ? 1 : 0;
  });

  const rows = Object.values(ownerMap).sort((a, b) => (b.overdue + b.open) - (a.overdue + a.open));
  el.ownerTable.innerHTML = rows.length
    ? rows.map((row) => `<tr>
        <td>${row.owner}</td>
        <td>${row.open}</td>
        <td>${row.overdue}</td>
        <td>${row.totalCases}</td>
        <td>${row.stale}</td>
      </tr>`).join('')
    : '<tr><td colspan="5" style="text-align:center;padding:1.5rem;">No owner activity in current filters.</td></tr>';
}

function renderPayerSummary(filteredCases) {
  const payerMap = {};
  filteredCases.forEach((item) => {
    if (!payerMap[item.payer]) {
      payerMap[item.payer] = { payer: item.payer, openCases: 0, overdue: 0, pendingClaimAmount: 0 };
    }
    payerMap[item.payer].openCases += item.rawStatus === 'Approved' ? 0 : 1;
    payerMap[item.payer].overdue += item.isOverdue ? 1 : 0;
    payerMap[item.payer].pendingClaimAmount += item.pendingClaimAmount;
  });

  const top = Object.values(payerMap)
    .sort((a, b) => (b.pendingClaimAmount + (b.openCases * 500)) - (a.pendingClaimAmount + (a.openCases * 500)))
    .slice(0, 5);
  const maxValue = Math.max(...top.map((item) => item.pendingClaimAmount || item.openCases), 1);

  el.revenueRisk.innerHTML = top.length
    ? top.map((item) => {
      const width = Math.round(((item.pendingClaimAmount || item.openCases) / maxValue) * 100);
      return `<div class="system-item">
        <div class="card-head"><strong>${item.payer}</strong><strong>${money(item.pendingClaimAmount)}</strong></div>
        <div class="meter"><span style="width:${width}%"></span></div>
        <div class="table-note">${item.openCases} open cases · ${item.overdue} overdue follow-ups</div>
      </div>`;
    }).join('')
    : '<p class="muted" style="padding:1rem;">No payer activity in the current filter scope.</p>';
}

function renderPatientFlow(filteredCases) {
  const pendingReferrals = model.summary.referralSummary.pendingReferrals;
  const convertedReferrals = model.summary.referralSummary.convertedReferrals;
  const openTasks = filteredCases.reduce((total, item) => total + item.openTaskCount, 0);
  const topStates = Object.values(filteredCases.reduce((acc, item) => {
    if (!acc[item.state]) acc[item.state] = { state: item.state, cases: 0, referrals: 0 };
    acc[item.state].cases += 1;
    acc[item.state].referrals += item.referralStatus === 'Converted' ? 1 : 0;
    return acc;
  }, {})).sort((a, b) => b.cases - a.cases).slice(0, 4);

  el.patientFlow.innerHTML = `
    <div class="mini-grid">
      <div class="mini-stat"><span class="label">Total referrals</span><span class="value">${model.summary.referralSummary.totalReferrals}</span></div>
      <div class="mini-stat"><span class="label">Converted</span><span class="value">${convertedReferrals}</span></div>
      <div class="mini-stat"><span class="label">Open tasks</span><span class="value">${openTasks}</span></div>
    </div>
    <div class="table-note">Pending referrals ${pendingReferrals} · Active cases ${filteredCases.filter((item) => item.rawStatus !== 'Approved').length}</div>
    ${topStates.map((row) => `<div class="system-item">
      <div class="card-head"><strong>${row.state}</strong><strong>${row.cases} cases</strong></div>
      <div class="meter"><span style="width:${Math.max(20, Math.round((row.cases / Math.max(topStates[0]?.cases || 1, 1)) * 100))}%"></span></div>
      <div class="table-note">${row.referrals} referral matches</div>
    </div>`).join('')}
  `;
}

function renderSystems() {
  el.systemHealth.innerHTML = model.systemHealth.map((item) => `<div class="system-item">
    <div class="card-head"><strong>${item.name}</strong><strong>${item.severity}</strong></div>
    <div class="muted">${item.note}</div>
    <div class="table-note">Owner: ${item.owner}</div>
  </div>`).join('');
}

function renderAttention() {
  el.attentionPanel.innerHTML = model.attention.length
    ? model.attention.map((item) => `<div class="attention-item">
        <div class="attention-top">
          <div>
            <div class="attention-title">${item.patientName}</div>
            <div class="table-note">${item.state} · ${item.payer} · ${item.owner}</div>
          </div>
          <div>${badgePriority(item.priority)}</div>
        </div>
        <div class="muted">${item.notes || 'No case notes provided.'}</div>
        <div class="tag-row">
          ${item.attentionReasons.map((reason) => `<span class="tag ${reason === 'Overdue follow-up' || reason === 'Blocked high-priority' ? 'bad' : reason === 'Missing required fields' ? 'warn' : ''}">${reason}</span>`).join('')}
          ${item.denialCount ? `<span class="tag bad">${item.denialCount} denial${item.denialCount > 1 ? 's' : ''}</span>` : ''}
          ${item.pendingClaimAmount ? `<span class="tag warn">${money(item.pendingClaimAmount)} pending claims</span>` : ''}
        </div>
      </div>`).join('')
    : '<div class="note-card">No cases currently meet the attention rules.</div>';

  el.attentionCount.textContent = `${model.attention.length} surfaced from live rules`;
}

function renderDataNotes() {
  el.dataCoverage.textContent = `${model.metrics.totals.cases} cases · ${model.metrics.totals.referrals} referrals · ${model.metrics.totals.claims} claims`;
  el.dataNotes.innerHTML = `
    <div class="note-card">
      <strong>Field mappings</strong>
      <div class="table-note">${model.mappings.join(' ')}</div>
    </div>
    <div class="note-card">
      <strong>Assumptions</strong>
      <div class="table-note">Cases become attention items from overdue follow-up dates, overdue tasks, stale activity after 7+ days, blocked or denied records, and missing required fields.</div>
    </div>
    <div class="note-card">
      <strong>Gaps</strong>
      <div class="table-note">${model.gaps.join(' ')}</div>
    </div>
  `;
}

function renderIssues(filteredCases) {
  el.issuesTable.innerHTML = filteredCases.length
    ? filteredCases.map((item) => {
      const flags = [
        `${item.claimCount} claim${item.claimCount === 1 ? '' : 's'}`,
        item.denialCount ? `${item.denialCount} denial${item.denialCount === 1 ? '' : 's'}` : null,
        item.missingFields.length ? `Missing: ${item.missingFields.join(', ')}` : null,
      ].filter(Boolean).join(' · ');

      return `<tr>
        <td>${item.patientName}<div class="table-note">${item.provider} · ${item.diagnosis || 'No diagnosis'} · ${item.tierStatus}</div></td>
        <td>${item.owner}</td>
        <td>${item.payer}</td>
        <td>${badgeStatus(item.rawStatus)}</td>
        <td>${badgePriority(item.priority)}</td>
        <td>${item.state}</td>
        <td>${item.daysOpen}d</td>
        <td>${relativeFollowUp(item)}</td>
        <td>${flags || 'No extra flags'}</td>
      </tr>`;
    }).join('')
    : '<tr><td colspan="9" style="text-align:center;padding:2rem;">No cases match the current filters.</td></tr>';

  el.resultsSummary.textContent = `${filteredCases.length} cases shown from ${model.metrics.totals.cases} total live cases`;
}

function render() {
  const filteredCases = filterCases();
  renderKpis();
  renderCritical(filteredCases);
  renderOwners(filteredCases);
  renderPayerSummary(filteredCases);
  renderPatientFlow(filteredCases);
  renderSystems();
  renderAttention();
  renderDataNotes();
  renderIssues(filteredCases);
}

function bind() {
  el.ownerFilter.addEventListener('change', (event) => { state.owner = event.target.value; render(); });
  el.payerFilter.addEventListener('change', (event) => { state.payer = event.target.value; render(); });
  el.stateFilter.addEventListener('change', (event) => { state.st = event.target.value; render(); });
  el.statusFilter.addEventListener('change', (event) => { state.status = event.target.value; render(); });
  el.priorityFilter.addEventListener('change', (event) => { state.priority = event.target.value; render(); });
  el.searchInput.addEventListener('input', (event) => { state.q = event.target.value; render(); });
  el.clearFilters.addEventListener('click', () => {
    state.owner = 'all';
    state.payer = 'all';
    state.st = 'all';
    state.status = 'all';
    state.priority = 'all';
    state.q = '';
    state.kpi = null;
    el.ownerFilter.value = 'all';
    el.payerFilter.value = 'all';
    el.stateFilter.value = 'all';
    el.statusFilter.value = 'all';
    el.priorityFilter.value = 'all';
    el.searchInput.value = '';
    render();
  });
  el.refreshBtn.addEventListener('click', () => loadData());
}

async function loadData() {
  el.issuesTable.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;">Loading CSV-backed operational data…</td></tr>';
  el.resultsSummary.textContent = 'Loading';
  if (el.liveDot) el.liveDot.textContent = '● Refreshing CSV sources…';

  try {
    model = await OpsDataLayer.loadOperationalData();
    initFilters();
    render();
    if (el.liveDot) {
      el.liveDot.textContent = `● Live CSV data · ${model.metrics.totals.cases} cases · ${model.metrics.totals.claims} claims`;
    }
  } catch (error) {
    console.error(error);
    el.issuesTable.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#ff9cae;">Unable to load local CSV data. Keep the files in <code>opscenter/data/</code> and serve the app over HTTP.</td></tr>`;
    el.resultsSummary.textContent = 'Load error';
    if (el.liveDot) el.liveDot.textContent = '● CSV load failed';
  }
}

bind();
loadData();
