const state = {
  view: 'executive',
  stateFilter: 'all',
  specialtyFilter: 'all',
  statusFilter: 'all',
  sourceFilter: 'all',
  search: '',
  selectedCoverageState: 'all',
  insuranceState: 'all',
  mapMode: 'enrollment', // 'enrollment' or 'priority'
};

let model = null;
let insuranceMap = null;
let insuranceMapLayer = null;
let insuranceGeoJson = null;
let insuranceLoadPromise = null;

const views = [
  { id: 'executive', label: 'Executive Dashboard' },
  { id: 'ops', label: 'Ops Center' },
  { id: 'intake', label: 'Intake / Referral Reporting' },
  { id: 'aging', label: 'Aging / AR' },
  { id: 'credentialing', label: 'Credentialing Pipeline' },
  { id: 'staff', label: 'Staff Metrics' },
  { id: 'hubstaff', label: 'Hubstaff' },
  { id: 'insurance', label: 'State Insurance Maps' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'minutes', label: 'Meeting Minutes' },
];

const el = {
  viewNav: document.getElementById('viewNav'),
  stateFilter: document.getElementById('stateFilter'),
  specialtyFilter: document.getElementById('specialtyFilter'),
  statusFilter: document.getElementById('statusFilter'),
  sourceFilter: document.getElementById('sourceFilter'),
  searchInput: document.getElementById('searchInput'),
  refreshBtn: document.getElementById('refreshBtn'),
  clearFilters: document.getElementById('clearFilters'),
  liveStatus: document.getElementById('liveStatus'),
  sourceMeta: document.getElementById('sourceMeta'),
  executiveKpis: document.getElementById('executiveKpis'),
  executiveSummary: document.getElementById('executiveSummary'),
  executiveHeadline: document.getElementById('executiveHeadline'),
  executiveNarrative: document.getElementById('executiveNarrative'),
  executiveInsights: document.getElementById('executiveInsights'),
  watchlistPanel: document.getElementById('watchlistPanel'),
  opsKpis: document.getElementById('opsKpis'),
  criticalActionsTable: document.getElementById('criticalActionsTable'),
  criticalCount: document.getElementById('criticalCount'),
  ownerTable: document.getElementById('ownerTable'),
  revenueRisk: document.getElementById('revenueRisk'),
  patientFlow: document.getElementById('patientFlow'),
  systemHealth: document.getElementById('systemHealth'),
  issuesTable: document.getElementById('issuesTable'),
  resultsSummary: document.getElementById('resultsSummary'),
  intakeSummary: document.getElementById('intakeSummary'),
  intakeKpis: document.getElementById('intakeKpis'),
  intakeFlow: document.getElementById('intakeFlow'),
  referralSourcePanel: document.getElementById('referralSourcePanel'),
  interviewTable: document.getElementById('interviewTable'),
  intakeTable: document.getElementById('intakeTable'),
  agingSummary: document.getElementById('agingSummary'),
  agingPrivacyBadge: document.getElementById('agingPrivacyBadge'),
  agingKpis: document.getElementById('agingKpis'),
  agingSpotlight: document.getElementById('agingSpotlight'),
  agingSourceMeta: document.getElementById('agingSourceMeta'),
  agingStateTable: document.getElementById('agingStateTable'),
  agingMonthTable: document.getElementById('agingMonthTable'),
  agingInsuranceSummary: document.getElementById('agingInsuranceSummary'),
  agingPatientSummary: document.getElementById('agingPatientSummary'),
  agingInsuranceTable: document.getElementById('agingInsuranceTable'),
  agingPatientTable: document.getElementById('agingPatientTable'),
  staffSummary: document.getElementById('staffSummary'),
  staffKpis: document.getElementById('staffKpis'),
  staffInsights: document.getElementById('staffInsights'),
  coveragePanel: document.getElementById('coveragePanel'),
  workforceTable: document.getElementById('workforceTable'),
  hireTable: document.getElementById('hireTable'),
  coveredStatesCount: document.getElementById('coveredStatesCount'),
  stateCoverageNotice: document.getElementById('stateCoverageNotice'),
  stateCoverageStats: document.getElementById('stateCoverageStats'),
  stateAtlas: document.getElementById('stateAtlas'),
  stateCoverageSummary: document.getElementById('stateCoverageSummary'),
  stateCoverageSelect: document.getElementById('stateCoverageSelect'),
  stateCoverageInsights: document.getElementById('stateCoverageInsights'),
  hubstaffSummary: document.getElementById('hubstaffSummary'),
  hubstaffTimestamp: document.getElementById('hubstaffTimestamp'),
  hubstaffKpis: document.getElementById('hubstaffKpis'),
  hubstaffStatus: document.getElementById('hubstaffStatus'),
  hubstaffReadiness: document.getElementById('hubstaffReadiness'),
  hubstaffMetricsTable: document.getElementById('hubstaffMetricsTable'),
  hubstaffNotes: document.getElementById('hubstaffNotes'),
  insuranceStateSelect: document.getElementById('insuranceStateSelect'),
  insuranceValidationBanner: document.getElementById('insuranceValidationBanner'),
  insuranceSelectionSummary: document.getElementById('insuranceSelectionSummary'),
  insuranceStatus: document.getElementById('insuranceStatus'),
  insuranceKpis: document.getElementById('insuranceKpis'),
  insuranceSourceMeta: document.getElementById('insuranceSourceMeta'),
  insuranceMapTitle: document.getElementById('insuranceMapTitle'),
  insuranceMapSub: document.getElementById('insuranceMapSub'),
  insuranceCountyMap: document.getElementById('insuranceCountyMap'),
  insuranceCountyTable: document.getElementById('insuranceCountyTable'),
  insuranceSourceCatalog: document.getElementById('insuranceSourceCatalog'),
  insurancePlanTable: document.getElementById('insurancePlanTable'),
  insuranceMapLegend: document.getElementById('insuranceMapLegend'),
  insuranceMarketingSummary: document.getElementById('insuranceMarketingSummary'),
  mapModeToggle: document.querySelector('.map-mode-toggle'),
  credentialingKpis: document.getElementById('credentialingKpis'),
  credentialingByStatus: document.getElementById('credentialingByStatus'),
  credentialingStuckTable: document.getElementById('credentialingStuckTable'),
  credentialingSummary: document.getElementById('credentialingSummary'),
  credentialingTable: document.getElementById('credentialingTable'),
  licenseAlertsPanel: document.getElementById('licenseAlertsPanel'),
  licenseAlertsSummary: document.getElementById('licenseAlertsSummary'),
  // Marketing view
  marketingKpis: document.getElementById('marketingKpis'),
  marketingSummary: document.getElementById('marketingSummary'),
  marketingPlatformBreakdown: document.getElementById('marketingPlatformBreakdown'),
  marketingAccountBreakdown: document.getElementById('marketingAccountBreakdown'),
  marketingWeeklyTrend: document.getElementById('marketingWeeklyTrend'),
  marketingCalendarStatus: document.getElementById('marketingCalendarStatus'),
  marketingPostCount: document.getElementById('marketingPostCount'),
  marketingPostTable: document.getElementById('marketingPostTable'),
  marketingPriorityKpis: document.getElementById('marketingPriorityKpis'),
  marketingPriorityExplainer: document.getElementById('marketingPriorityExplainer'),
  marketingPriorityTable: document.getElementById('marketingPriorityTable'),
  // Meeting Minutes view
  minutesKpis: document.getElementById('minutesKpis'),
  minutesSummary: document.getElementById('minutesSummary'),
  minutesTable: document.getElementById('minutesTable'),
  minutesActionItems: document.getElementById('minutesActionItems'),
  minutesActionSummary: document.getElementById('minutesActionSummary'),
  minutesLatest: document.getElementById('minutesLatest'),
  minutesLatestSummary: document.getElementById('minutesLatestSummary'),
};

function uniq(values) {
  return OpsSheets.utils.uniq(values);
}

function fillSelect(select, label, values) {
  const options = ['<option value="all">' + label + '</option>']
    .concat(values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
    .join('');
  select.innerHTML = options;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function money(value) {
  if (!Number.isFinite(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function wholeNumber(value) {
  if (!Number.isFinite(value)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(date) {
  if (!date) return 'No date';
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
}

function formatDateTime(date) {
  if (!date) return 'not available yet';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function badgePriority(priority) {
  const tone = priority === 'High' ? 'critical' : priority === 'Medium' ? 'medium' : 'low';
  return `<span class="badge priority-${tone}">${escapeHtml(priority)}</span>`;
}

function badgeStatus(status) {
  const value = String(status || 'Open');
  const lowered = value.toLowerCase();
  let className = 'status-open';
  if (/signed|selected|healthy|completed|done|active/.test(lowered)) className = 'status-approved';
  if (/warning|pending|waiting|review/.test(lowered)) className = 'status-warning';
  if (/blocked|unavailable|no show|failed|denied/.test(lowered)) className = 'status-blocked';
  return `<span class="badge ${className}">${escapeHtml(value)}</span>`;
}

// Match a row's raw `state` value (which may be "AZ", "Arizona",
// "AZ, FL", "FL NY GA", "MAINE", etc.) against a selected 2-letter code.
function stateMatchesFilter(rawState, selectedCode) {
  if (selectedCode === 'all') return true;
  const validStates = OpsInsurance.validStates || {};
  const nameToCode = {};
  Object.keys(validStates).forEach((code) => {
    nameToCode[validStates[code].toLowerCase()] = code;
  });
  const pieces = OpsSheets.utils.splitStates(rawState || '');
  if (pieces.length) {
    if (pieces.includes(selectedCode)) return true;
  }
  // Fall back to interpreting the raw value as a full state name.
  const code = nameToCode[String(rawState || '').trim().toLowerCase()];
  return code === selectedCode;
}

function matchesFilters(textParts, values) {
  const query = state.search.trim().toLowerCase();
  const searchable = textParts.join(' ').toLowerCase();
  return (!query || searchable.includes(query))
    && stateMatchesFilter(values.state, state.stateFilter)
    && (state.specialtyFilter === 'all' || values.specialty === state.specialtyFilter)
    && (state.statusFilter === 'all' || values.status === state.statusFilter)
    && (state.sourceFilter === 'all' || values.source === state.sourceFilter);
}

function getFilteredIssues() {
  if (!model) return [];
  return model.issues.filter((item) =>
    matchesFilters(
      [item.name, item.state, item.owner, item.status, item.detail, item.source, item.risk],
      {
        state: item.state,
        specialty: '',
        status: item.status,
        source: item.source,
      }
    )
  );
}

function getFilteredInterviews() {
  if (!model) return [];
  return model.dataset.interviews.filter((item) =>
    matchesFilters(
      [item.name, item.position, item.state, item.phase, item.status, item.notes, item.source],
      {
        state: item.state,
        specialty: item.position,
        status: item.status,
        source: item.source,
      }
    )
  );
}

function getFilteredIntakeRows() {
  if (!model) return [];
  return model.dataset.newHiring.filter((item) =>
    matchesFilters(
      [item.name, item.state, item.specialty, item.interviewStatus, item.credentialing, item.referralSource, item.source],
      {
        state: item.state,
        specialty: item.specialty,
        status: item.interviewStatus,
        source: item.source,
      }
    )
  );
}

function getFilteredWorkforceRows() {
  if (!model) return [];
  return model.dataset.currentWorkforce.filter((item) =>
    matchesFilters(
      [item.providerName, item.licensedState, item.specialty, item.contractType, item.futureLicense, item.source],
      {
        state: item.licensedState,
        specialty: item.specialty,
        status: item.contractType,
        source: item.source,
      }
    )
  );
}

function getFilteredHireRows() {
  if (!model) return [];
  return model.dataset.finalHires.filter((item) =>
    matchesFilters(
      [item.name, item.title, item.states, item.comments, item.source],
      {
        state: '',
        specialty: item.title,
        status: '',
        source: item.source,
      }
    )
  );
}

function renderViewNav() {
  if (!el.viewNav.dataset.initialized) {
    el.viewNav.innerHTML = views.map((view) => `
      <button type="button" class="view-tab" data-view="${view.id}">
        ${escapeHtml(view.label)}
      </button>
    `).join('');

    el.viewNav.addEventListener('click', (event) => {
      const button = event.target.closest('.view-tab');
      if (!button) return;
      setActiveView(button.getAttribute('data-view'));
    });
    el.viewNav.dataset.initialized = 'true';
  }

  el.viewNav.querySelectorAll('.view-tab').forEach((button) => {
    button.classList.toggle('active', button.getAttribute('data-view') === state.view);
  });
}

function setActiveView(viewId) {
  if (!views.some((view) => view.id === viewId) || state.view === viewId) return;
  state.view = viewId;
  document.querySelectorAll('.view').forEach((section) => section.classList.remove('active'));
  document.getElementById(`view-${state.view}`).classList.add('active');
  render();
}

function renderSourceMeta() {
  el.sourceMeta.innerHTML = model.sourceMeta.map((item) => `
    <div class="source-item">
      <div>
        <strong>${escapeHtml(item.label)}</strong>
        <div class="table-note">${escapeHtml(item.sheetName)}</div>
      </div>
      <div style="text-align:right">
        ${badgeStatus(item.source === 'live' ? 'Live' : item.source === 'cache' ? 'Cache fallback' : 'Unavailable')}
        <div class="table-note">${item.rowCount} rows</div>
      </div>
    </div>
  `).join('');
}

function renderExecutiveKpis() {
  const criticalIssues = model.issues.filter((item) => item.priority === 'High').length;
  const liveFailures = model.sourceMeta.filter((item) => item.source === 'unavailable').length;
  const over90Balance = model.aging?.metrics?.over90Total || 0;
  const cards = [
    { label: 'Critical Today', value: criticalIssues, tone: criticalIssues ? 'bad' : 'good', detail: 'High-priority blockers needing action' },
    { label: 'Pipeline In Motion', value: model.metrics.openInterviews, tone: 'warn', detail: `${model.metrics.totalCandidates} tracked candidates across recruiting sheets` },
    { label: 'Active Coverage', value: model.metrics.statesCovered, tone: 'accent', detail: `${model.metrics.activeWorkforce} active providers across licensed states` },
    { label: 'Aged 90+ AR', value: over90Balance ? money(over90Balance) : 'N/A', tone: over90Balance ? 'bad' : '', detail: over90Balance ? 'Oldest AR exposure from the safe feeder' : 'Aging feed not connected yet' },
    { label: 'Signed / Final', value: model.metrics.finalSigned, tone: 'good', detail: 'Final Sheet records ready to activate' },
    { label: 'Source Health', value: liveFailures ? `${liveFailures} down` : 'Healthy', tone: liveFailures ? 'bad' : 'good', detail: liveFailures ? 'Workbook tabs missing live or cached data' : 'All primary workbook tabs reachable' },
  ];

  el.executiveKpis.innerHTML = cards.map((card) => `
    <article class="kpi ${card.tone}">
      <div class="k">${escapeHtml(card.label)}</div>
      <div class="v">${escapeHtml(card.value)}</div>
      <div class="d">${escapeHtml(card.detail)}</div>
    </article>
  `).join('');
}

function renderExecutiveInsights() {
  const issues = getFilteredIssues();
  const interviewsByStatus = summarizeCounts(model.dataset.interviews.map((item) => item.status || 'Unknown'));
  const hiringBySpecialty = summarizeCounts(model.dataset.newHiring.map((item) => item.specialty || 'Unknown'));
  const workforceByContract = summarizeCounts(model.dataset.currentWorkforce.map((item) => item.contractType || 'Unknown'));
  const sourceFailures = model.sourceMeta.filter((item) => item.source === 'unavailable').length;
  const criticalIssues = issues.filter((item) => item.priority === 'High').length;
  const topAgingState = model.aging?.spotlight?.topState || null;
  const over90Balance = model.aging?.metrics?.over90Total || 0;

  const headline = sourceFailures
    ? `${sourceFailures} source issue${sourceFailures === 1 ? '' : 's'}`
    : criticalIssues
      ? `${criticalIssues} critical item${criticalIssues === 1 ? '' : 's'}`
      : 'Daily flow is stable';
  const headlineTone = sourceFailures ? 'status-blocked' : criticalIssues ? 'status-warning' : 'status-approved';

  el.executiveSummary.textContent = `${model.metrics.issueCount} open issues · ${model.metrics.activeWorkforce} active providers · refreshed ${formatDate(model.loadedAt)}`;
  el.executiveHeadline.className = `badge ${headlineTone}`;
  el.executiveHeadline.textContent = headline;
  el.executiveNarrative.textContent = sourceFailures
    ? 'The fastest win today is restoring missing live sources before teams make staffing or AR decisions from stale context.'
    : over90Balance
      ? `Operations is carrying ${money(over90Balance)} in 90+ day AR while the hiring and credentialing pipeline continues to move.`
      : 'No source outages are blocking the dashboard, so the focus can stay on hiring flow, activation readiness, and state coverage.';

  el.executiveInsights.innerHTML = [
    {
      title: 'Hiring Flow',
      summary: `${model.metrics.openInterviews} open interviews · ${model.metrics.finalSigned} final hires`,
      body: renderMetricList(interviewsByStatus.slice(0, 5), 'rows'),
    },
    {
      title: 'Demand Mix',
      summary: `${model.metrics.totalCandidates} candidates in motion`,
      body: renderMetricList(hiringBySpecialty.slice(0, 5), 'candidates'),
    },
    {
      title: topAgingState ? `AR Pressure: ${topAgingState.state}` : 'Coverage Mix',
      summary: topAgingState
        ? `${money(topAgingState.total)} total AR · ${money(topAgingState.over90)} aged 90+`
        : `${model.metrics.statesCovered} states covered`,
      body: renderMetricList(workforceByContract.slice(0, 5), 'providers'),
    },
  ].map((card) => `
    <div class="insight-card">
      <strong>${escapeHtml(card.title)}</strong>
      <div class="table-note">${escapeHtml(card.summary)}</div>
      <div class="metric-list">${card.body}</div>
    </div>
  `).join('');
}

function renderWatchlist() {
  const watchlist = getFilteredIssues().slice(0, 6);
  el.watchlistPanel.innerHTML = watchlist.length
    ? watchlist.map((item) => `
      <div class="attention-item">
        <div class="attention-top">
          <div>
            <div><strong>${escapeHtml(item.name)}</strong></div>
            <div class="table-note">${escapeHtml(item.source)} · ${escapeHtml(item.state)} · ${escapeHtml(item.owner)}</div>
          </div>
          <div>${badgePriority(item.priority)}</div>
        </div>
        <div class="muted">${escapeHtml(item.detail)}</div>
        <div class="tag-row">
          <span class="tag bad">${escapeHtml(item.risk)}</span>
          <span class="tag">${escapeHtml(item.status)}</span>
          <span class="tag warn">${escapeHtml(item.timeline)}</span>
        </div>
      </div>
    `).join('')
    : '<div class="empty-state">No watchlist items match the current filters.</div>';
}

function renderOpsKpis() {
  const issues = getFilteredIssues();
  const critical = issues.filter((item) => item.priority === 'High');
  const credentialing = issues.filter((item) => /license|activation|credential/i.test(item.risk));
  const interviewRisk = issues.filter((item) => /pipeline|interview/i.test(item.risk));
  const coverageRisk = issues.filter((item) => /activation|coverage|license/i.test(item.risk));
  const liveFailures = model.sourceMeta.filter((item) => item.source === 'unavailable');

  const cards = [
    { label: 'Critical Actions', value: critical.length, tone: 'bad', detail: 'High-priority follow-ups today' },
    { label: 'Issues Queue', value: issues.length, tone: 'warn', detail: 'Current filtered queue size' },
    { label: 'Credentialing Risk', value: credentialing.length, tone: 'warn', detail: 'Licensing and activation gaps' },
    { label: 'Interview Risk', value: interviewRisk.length, tone: 'warn', detail: 'Stalled or lost pipeline stages' },
    { label: 'Coverage Risk', value: coverageRisk.length, tone: 'bad', detail: 'Potential staffing drag by state' },
    { label: 'Source Failures', value: liveFailures.length, tone: liveFailures.length ? 'bad' : 'good', detail: 'Tabs without live or cached data' },
  ];

  el.opsKpis.innerHTML = cards.map((card) => `
    <article class="kpi ${card.tone}">
      <div class="k">${escapeHtml(card.label)}</div>
      <div class="v">${escapeHtml(card.value)}</div>
      <div class="d">${escapeHtml(card.detail)}</div>
    </article>
  `).join('');
}

function renderCriticalActions() {
  const critical = getFilteredIssues()
    .sort((a, b) => priorityScore(b.priority) - priorityScore(a.priority))
    .slice(0, 8);

  el.criticalActionsTable.innerHTML = critical.length
    ? critical.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}<div class="table-note">${escapeHtml(item.source)} · ${escapeHtml(item.state)}</div></td>
        <td>${escapeHtml(item.owner)}</td>
        <td>${escapeHtml(item.timeline)}</td>
        <td>${badgeStatus(item.status)}</td>
        <td>${badgePriority(item.priority)}</td>
        <td>${escapeHtml(item.detail)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="empty-state">No critical actions match the current filters.</td></tr>';

  el.criticalCount.textContent = `${critical.length} surfaced for immediate follow-up`;
}

function renderOwnerAccountability() {
  const rows = Object.values(getFilteredIssues().reduce((acc, item) => {
    if (!acc[item.owner]) {
      acc[item.owner] = { owner: item.owner, open: 0, critical: 0, watchlist: 0, coverage: 0 };
    }
    acc[item.owner].open += 1;
    acc[item.owner].critical += item.priority === 'High' ? 1 : 0;
    acc[item.owner].watchlist += /pipeline|activation|blocker|stalled/i.test(item.risk) ? 1 : 0;
    acc[item.owner].coverage += /coverage|license/i.test(item.risk) ? 1 : 0;
    return acc;
  }, {})).sort((a, b) => b.critical - a.critical || b.open - a.open);

  el.ownerTable.innerHTML = rows.length
    ? rows.map((row) => `
      <tr>
        <td>${escapeHtml(row.owner)}</td>
        <td>${row.open}</td>
        <td>${row.critical}</td>
        <td>${row.watchlist}</td>
        <td>${row.coverage}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="empty-state">No owner workload in current filters.</td></tr>';
}

function renderRevenueRisk() {
  const risks = Object.values(getFilteredIssues().reduce((acc, item) => {
    const key = item.state || 'Unknown';
    if (!acc[key]) {
      acc[key] = { state: key, count: 0, high: 0, label: item.state || 'Unknown' };
    }
    acc[key].count += 1;
    acc[key].high += item.priority === 'High' ? 1 : 0;
    return acc;
  }, {})).sort((a, b) => b.high - a.high || b.count - a.count).slice(0, 5);

  const max = Math.max(...risks.map((item) => item.count), 1);
  el.revenueRisk.innerHTML = risks.length
    ? risks.map((item) => `
      <div class="system-item">
        <div class="system-item-top">
          <strong>${escapeHtml(item.label)}</strong>
          <strong>${item.count} risks</strong>
        </div>
        <div class="meter"><span style="width:${Math.round((item.count / max) * 100)}%"></span></div>
        <div class="table-note">${item.high} high-priority items tied to staffing or activation readiness</div>
      </div>
    `).join('')
    : '<div class="empty-state">No revenue-risk proxies match the current filters.</div>';
}

function renderPatientFlow() {
  const interviews = getFilteredInterviews();
  const intake = getFilteredIntakeRows();
  const signed = getFilteredHireRows();
  const workforce = getFilteredWorkforceRows();
  const conversion = intake.length ? (signed.length / intake.length) * 100 : 0;

  el.patientFlow.innerHTML = `
    <div class="mini-kpi-grid">
      <div class="mini-kpi"><div class="k">Intake Candidates</div><div class="v">${intake.length}</div></div>
      <div class="mini-kpi"><div class="k">Interviews</div><div class="v">${interviews.length}</div></div>
      <div class="mini-kpi"><div class="k">Signed / Final</div><div class="v">${signed.length}</div></div>
      <div class="mini-kpi"><div class="k">Active Workforce</div><div class="v">${workforce.length}</div></div>
    </div>
    <div class="table-note">Capacity proxy conversion from intake to signed: ${percent(conversion)}</div>
  `;
}

function renderSystemHealth() {
  const items = model.sourceMeta.map((item) => ({
    title: item.label,
    severity: item.source === 'live' ? 'Healthy' : item.source === 'cache' ? 'Warning' : 'Needs attention',
    note: item.source === 'live'
      ? `${item.rowCount} rows loaded live from Google Sheets`
      : item.source === 'cache'
        ? `${item.rowCount} cached rows loaded after a live fetch failure`
        : (item.error || 'No live or cached data available'),
    owner: item.source === 'unavailable' ? 'Data Ops' : 'System',
  }));

  el.systemHealth.innerHTML = items.map((item) => `
    <div class="system-item">
      <div class="system-item-top">
        <strong>${escapeHtml(item.title)}</strong>
        ${badgeStatus(item.severity)}
      </div>
      <div class="muted">${escapeHtml(item.note)}</div>
      <div class="table-note">Owner: ${escapeHtml(item.owner)}</div>
    </div>
  `).join('');
}

function renderIssuesQueue() {
  const issues = getFilteredIssues();
  el.issuesTable.innerHTML = issues.length
    ? issues.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.source)}</td>
        <td>${escapeHtml(item.state)}</td>
        <td>${escapeHtml(item.owner)}</td>
        <td>${badgeStatus(item.status)}</td>
        <td>${badgePriority(item.priority)}</td>
        <td>${escapeHtml(item.risk)}</td>
        <td>${escapeHtml(item.detail)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="8" class="empty-state">No issues match the current filters.</td></tr>';

  el.resultsSummary.textContent = `${issues.length} issues shown from ${model.metrics.issueCount} total tracked operational issues`;
}

function renderIntakeView() {
  const interviews = getFilteredInterviews();
  const intakeRows = getFilteredIntakeRows();
  const resumeRows = model.dataset.resumePool;
  const selected = interviews.filter((item) => /selected|final interview completed/i.test(item.status)).length;
  const noShow = interviews.filter((item) => /no show/i.test(item.status)).length;
  const credentialed = intakeRows.filter((item) => item.credentialing).length;
  const referralSources = summarizeCounts(intakeRows.map((item) => item.referralSource || 'Unknown'));

  el.intakeSummary.textContent = `${intakeRows.length} intake rows · ${interviews.length} interviews · ${resumeRows.length} resume pool rows`;
  el.intakeKpis.innerHTML = [
    { label: 'Intake Rows', value: intakeRows.length },
    { label: 'Interviewed', value: interviews.length },
    { label: 'Selected / Final', value: selected },
    { label: 'Credentialing Tagged', value: credentialed },
  ].map((card) => `
    <div class="mini-kpi">
      <div class="k">${escapeHtml(card.label)}</div>
      <div class="v">${escapeHtml(card.value)}</div>
    </div>
  `).join('');

  el.intakeFlow.innerHTML = [
    `No-shows currently tracked: <strong>${noShow}</strong>`,
    `Resume pool rows available: <strong>${resumeRows.length}</strong>`,
    `Rows missing referral source: <strong>${intakeRows.filter((item) => !item.referralSource).length}</strong>`,
  ].map((line) => `<div class="note-card">${line}</div>`).join('');

  // Referral source tracking with conversion rates: for each source, count
  // total candidates, how many reached "completed/hired/active" credentialing,
  // and surface a conversion %.
  const sourceStats = {};
  (model.dataset.newHiring || []).forEach((row) => {
    const src = (row.referralSource || '').trim() || 'Unspecified';
    if (!sourceStats[src]) sourceStats[src] = { count: 0, converted: 0, states: new Set() };
    sourceStats[src].count += 1;
    if (row.state) sourceStats[src].states.add(row.state);
    const cred = String(row.credentialing || '').toLowerCase();
    const intv = String(row.interviewStatus || '').toLowerCase();
    if (/complete|active|approved|hired|done/.test(cred) || /completed|selected|hired/.test(intv)) {
      sourceStats[src].converted += 1;
    }
  });
  const sourceRows = Object.entries(sourceStats)
    .map(([src, s]) => ({
      source: src,
      count: s.count,
      converted: s.converted,
      conversion: s.count > 0 ? Math.round((s.converted / s.count) * 100) : 0,
      states: s.states.size,
    }))
    .sort((a, b) => b.count - a.count);
  el.referralSourcePanel.innerHTML = sourceRows.length
    ? `
      <div class="metric-row" style="font-weight:600;border-bottom:1px solid rgba(112,141,230,0.16);padding-bottom:0.4rem">
        <span>Source</span><strong>Candidates · Converted (%) · States</strong>
      </div>
      ${sourceRows.slice(0, 10).map((r) => `
        <div class="metric-row">
          <span>${escapeHtml(r.source)}</span>
          <strong>${r.count} · ${r.converted} (${r.conversion}%) · ${r.states}</strong>
        </div>
      `).join('')}
    `
    : '<div class="empty-state">No referral source data is populated yet.</div>';

  el.interviewTable.innerHTML = interviews.length
    ? interviews.slice(0, 12).map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.position)}</td>
        <td>${escapeHtml(item.state)}</td>
        <td>${escapeHtml(item.phase)}</td>
        <td>${badgeStatus(item.status)}</td>
        <td>${escapeHtml(item.dateLabel || formatDate(item.date))}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="empty-state">No interview rows match the current filters.</td></tr>';

  el.intakeTable.innerHTML = intakeRows.length
    ? intakeRows.slice(0, 12).map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.state)}</td>
        <td>${escapeHtml(item.specialty)}</td>
        <td>${escapeHtml(item.hours)}</td>
        <td>${badgeStatus(item.interviewStatus || 'Open')}</td>
        <td>${escapeHtml(item.credentialing || 'Missing')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="empty-state">No intake rows match the current filters.</td></tr>';
}

function renderAgingView() {
  const aging = model?.aging;
  if (!aging || !el.agingStateTable) return;

  const sourceFailures = aging.sourceMeta.filter((item) => !item.ok);
  const topState = aging.spotlight.topState;
  const hottestMonth = aging.spotlight.hottestMonth;
  const over90Share = aging.metrics.combinedTotal
    ? (aging.metrics.over90Total / aging.metrics.combinedTotal) * 100
    : 0;

  el.agingSummary.textContent = `${aging.metrics.stateCount} states tracked · ${aging.metrics.monthCount} months aggregated · safe feeder only`;
  el.agingPrivacyBadge.textContent = aging.privacy.mode === 'safe-feed' ? 'Aggregate-only feed' : 'Review source';

  el.agingKpis.innerHTML = [
    { label: 'Combined AR', value: money(aging.metrics.combinedTotal), tone: 'accent', detail: 'Insurance + patient aging feed' },
    { label: 'Insurance AR', value: money(aging.metrics.insuranceTotal), tone: 'good', detail: 'Insurance Aging Total tab' },
    { label: 'Patient AR', value: money(aging.metrics.patientTotal), tone: 'warn', detail: 'Patient Aging Total tab' },
    { label: '90+ Day Balance', value: money(aging.metrics.over90Total), tone: 'bad', detail: `${percent(over90Share)} of combined AR` },
    { label: 'Largest State', value: topState ? topState.state : 'N/A', tone: '', detail: topState ? money(topState.total) : 'No aging state totals yet' },
    { label: 'Latest Pressure Month', value: hottestMonth ? hottestMonth.monthLabel : 'N/A', tone: '', detail: hottestMonth ? money(hottestMonth.total) : 'No month totals yet' },
  ].map((card) => `
    <article class="kpi ${card.tone}">
      <div class="k">${escapeHtml(card.label)}</div>
      <div class="v">${escapeHtml(card.value)}</div>
      <div class="d">${escapeHtml(card.detail)}</div>
    </article>
  `).join('');

  el.agingSpotlight.innerHTML = [
    topState
      ? `Highest AR concentration is in <strong>${escapeHtml(topState.state)}</strong> with <strong>${escapeHtml(money(topState.total))}</strong>, including <strong>${escapeHtml(money(topState.over90))}</strong> aged 90+ days.`
      : 'No state concentration data is available yet.',
    hottestMonth
      ? `Largest month on file is <strong>${escapeHtml(hottestMonth.monthLabel)}</strong> at <strong>${escapeHtml(money(hottestMonth.total))}</strong>; 90+ exposure for that month is <strong>${escapeHtml(money(hottestMonth.over90))}</strong>.`
      : 'No month trend data is available yet.',
    sourceFailures.length
      ? `<strong>${sourceFailures.length} aging source tab(s) failed.</strong> The dashboard is showing only the portions that loaded or were cached.`
      : 'The AR tab is reading only the separate aggregate feeder sheet, not the private PHI workbook.',
  ].map((line) => `<div class="note-card">${line}</div>`).join('');

  el.agingSourceMeta.innerHTML = [
    `<div class="note-card">${escapeHtml(aging.privacy.note)}</div>`,
    '<div class="note-card">If these tabs show <strong>Unavailable</strong>, the feeder sheet still requires Google sign-in. For a static site, publish only the aggregate feeder sheet to the web or expose it through a safe Apps Script endpoint.</div>',
    ...aging.sourceMeta.map((item) => `
      <div class="source-item">
        <div>
          <strong>${escapeHtml(item.label)}</strong>
          <div class="table-note">${escapeHtml(item.sheetName)}</div>
          ${item.error ? `<div class="table-note">${escapeHtml(item.error)}</div>` : ''}
        </div>
        <div style="text-align:right">
          ${badgeStatus(item.source === 'live' ? 'Live' : item.source === 'cache' ? 'Cache fallback' : 'Unavailable')}
          <div class="table-note">${item.rowCount} rows</div>
        </div>
      </div>
    `),
    `<div class="note-card"><a class="btn small" href="${escapeHtml(aging.feedUrl)}" target="_blank" rel="noreferrer">Open aging feeder sheet</a></div>`,
  ].join('');

  el.agingStateTable.innerHTML = aging.byState.length
    ? aging.byState.slice(0, 12).map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.state)}</strong><div class="table-note">${row.monthsTracked} months tracked</div></td>
        <td>${escapeHtml(money(row.total))}</td>
        <td>${escapeHtml(money(row.insuranceTotal))}</td>
        <td>${escapeHtml(money(row.patientTotal))}</td>
        <td>${escapeHtml(money(row.over90))}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="empty-state">No state aging totals are available yet.</td></tr>';

  el.agingMonthTable.innerHTML = aging.byMonth.length
    ? aging.byMonth.slice(0, 12).map((row) => `
      <tr>
        <td><strong>${escapeHtml(row.monthLabel)}</strong></td>
        <td>${escapeHtml(money(row.total))}</td>
        <td>${escapeHtml(money(row.insuranceTotal))}</td>
        <td>${escapeHtml(money(row.patientTotal))}</td>
        <td>${escapeHtml(money(row.over90))}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="empty-state">No monthly aging trend is available yet.</td></tr>';

  el.agingInsuranceSummary.textContent = `${aging.insuranceRows.length} aggregate insurance rows`;
  el.agingPatientSummary.textContent = `${aging.patientRows.length} aggregate patient rows`;

  el.agingInsuranceTable.innerHTML = aging.insuranceRows.length
    ? aging.insuranceRows.slice(0, 12).map((row) => `
      <tr>
        <td>${escapeHtml(row.state)}</td>
        <td>${escapeHtml(row.monthLabel)}</td>
        <td>${escapeHtml(money(row.total))}</td>
        <td>${escapeHtml(money(row.current))}</td>
        <td>${escapeHtml(money(row.over90))}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="empty-state">Insurance aging rows are unavailable. Verify the feeder tab is link-accessible.</td></tr>';

  el.agingPatientTable.innerHTML = aging.patientRows.length
    ? aging.patientRows.slice(0, 12).map((row) => `
      <tr>
        <td>${escapeHtml(row.state)}</td>
        <td>${escapeHtml(row.monthLabel)}</td>
        <td>${escapeHtml(money(row.total))}</td>
        <td>${escapeHtml(money(row.current))}</td>
        <td>${escapeHtml(money(row.over90))}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="empty-state">Patient aging rows are unavailable. Verify the feeder tab is link-accessible.</td></tr>';
}

// Credentialing pipeline view: aggregate New Hiring rows by their
// `credentialing` field, surface stuck records, and show the full in-flight
// table. Status buckets are inferred from common values.
function renderCredentialingView() {
  if (!model || !el.credentialingTable) return;
  const rows = (model.dataset.newHiring || []).filter((r) => r.credentialing || r.interviewStatus);

  function classify(c) {
    const s = String(c || '').toLowerCase();
    if (!s) return 'Not started';
    if (/complete|done|active|approved/.test(s)) return 'Complete';
    if (/denied|reject/.test(s)) return 'Denied';
    if (/pending|in.?process|in.?progress|review|submit/.test(s)) return 'In progress';
    if (/wait|hold|stuck|delay/.test(s)) return 'Stuck';
    return 'Other';
  }

  const buckets = {};
  rows.forEach((r) => {
    const b = classify(r.credentialing);
    buckets[b] = (buckets[b] || 0) + 1;
  });

  el.credentialingKpis.innerHTML = [
    { label: 'In flight', value: rows.length, tone: 'good', detail: 'Total candidates with credentialing tracked' },
    { label: 'Complete', value: buckets['Complete'] || 0, tone: 'good', detail: 'Ready to bill' },
    { label: 'In progress', value: buckets['In progress'] || 0, tone: 'warn', detail: 'Active applications' },
    { label: 'Stuck / Pending', value: (buckets['Stuck'] || 0) + (buckets['Other'] || 0), tone: 'warn', detail: 'Need follow-up' },
    { label: 'Denied', value: buckets['Denied'] || 0, tone: 'bad', detail: 'Rejected or REQ Denied' },
    { label: 'Not started', value: buckets['Not started'] || 0, tone: 'muted', detail: 'No credentialing field set' },
  ].map((card) => `
    <article class="kpi ${card.tone}">
      <div class="k">${escapeHtml(card.label)}</div>
      <div class="v">${escapeHtml(card.value)}</div>
      <div class="d">${escapeHtml(card.detail)}</div>
    </article>
  `).join('');

  el.credentialingByStatus.innerHTML = Object.entries(buckets)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `<div class="metric-row"><span>${escapeHtml(k)}</span><strong>${v}</strong></div>`)
    .join('') || '<div class="empty-state">No credentialing rows yet.</div>';

  // Stuck = anything not Complete, not Denied, with a credentialing value
  const stuck = rows
    .filter((r) => {
      const cls = classify(r.credentialing);
      return cls === 'Stuck' || cls === 'Other' || cls === 'In progress';
    })
    .sort((a, b) => String(a.credentialing).localeCompare(String(b.credentialing)));
  el.credentialingStuckTable.innerHTML = stuck.length
    ? stuck.slice(0, 12).map((r) => `
      <tr>
        <td>${escapeHtml(r.name || '—')}</td>
        <td>${escapeHtml(r.state || '—')}</td>
        <td>${escapeHtml(r.specialty || '—')}</td>
        <td>${badgeStatus(r.credentialing || 'Pending')}</td>
        <td class="table-note">${escapeHtml(r.interviewStatus || '')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="empty-state">No stuck or pending credentialing rows.</td></tr>';

  el.credentialingSummary.textContent = `${rows.length} candidates · ${buckets['Complete'] || 0} complete · ${buckets['In progress'] || 0} in progress`;
  el.credentialingTable.innerHTML = rows.length
    ? rows.map((r) => `
      <tr>
        <td>${escapeHtml(r.name || '—')}</td>
        <td>${escapeHtml(r.state || '—')}</td>
        <td>${escapeHtml(r.specialty || '—')}</td>
        <td>${badgeStatus(r.interviewStatus || 'Open')}</td>
        <td>${badgeStatus(r.credentialing || 'Missing')}</td>
        <td>${escapeHtml(r.referralSource || '—')}</td>
        <td>${escapeHtml(r.dea || '—')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="7" class="empty-state">No credentialing data is loaded yet.</td></tr>';
}

function renderStaffView() {
  const workforce = getFilteredWorkforceRows();
  const hires = getFilteredHireRows();
  const specialties = summarizeCounts(workforce.map((item) => item.specialty || 'Unknown'));
  const states = summarizeCounts(workforce.map((item) => item.licensedState || 'Unknown'));
  const futureLicenses = workforce.filter((item) => item.futureLicense).length;
  const companyStateCoverage = {};

  model.dataset.currentWorkforce.forEach((item) => {
    const statesForRow = OpsSheets.utils.splitStates(item.licensedState || '');
    statesForRow.forEach((stateCode) => {
      if (!companyStateCoverage[stateCode]) {
        companyStateCoverage[stateCode] = {
          stateCode,
          workforceRows: 0,
          finalHireRows: 0,
          hiringRows: 0,
          providers: new Set(),
          specialties: new Set(),
          contractTypes: new Set(),
        };
      }
      companyStateCoverage[stateCode].workforceRows += 1;
      if (item.providerName) companyStateCoverage[stateCode].providers.add(item.providerName);
      if (item.specialty) companyStateCoverage[stateCode].specialties.add(item.specialty);
      if (item.contractType) companyStateCoverage[stateCode].contractTypes.add(item.contractType);
    });
  });

  model.dataset.finalHires.forEach((item) => {
    OpsSheets.utils.splitStates(item.states || '').forEach((stateCode) => {
      if (!companyStateCoverage[stateCode]) {
        companyStateCoverage[stateCode] = {
          stateCode,
          workforceRows: 0,
          finalHireRows: 0,
          hiringRows: 0,
          providers: new Set(),
          specialties: new Set(),
          contractTypes: new Set(),
        };
      }
      companyStateCoverage[stateCode].finalHireRows += 1;
      if (item.name) companyStateCoverage[stateCode].providers.add(item.name);
      if (item.title) companyStateCoverage[stateCode].specialties.add(item.title);
    });
  });

  model.dataset.newHiring.forEach((item) => {
    OpsSheets.utils.splitStates(item.state || '').forEach((stateCode) => {
      if (!companyStateCoverage[stateCode]) {
        companyStateCoverage[stateCode] = {
          stateCode,
          workforceRows: 0,
          finalHireRows: 0,
          hiringRows: 0,
          providers: new Set(),
          specialties: new Set(),
          contractTypes: new Set(),
        };
      }
      companyStateCoverage[stateCode].hiringRows += 1;
      if (item.name) companyStateCoverage[stateCode].providers.add(item.name);
      if (item.specialty) companyStateCoverage[stateCode].specialties.add(item.specialty);
    });
  });

  const coveredStates = Object.values(companyStateCoverage)
    .map((item) => ({
      stateCode: item.stateCode,
      workforceRows: item.workforceRows,
      finalHireRows: item.finalHireRows,
      hiringRows: item.hiringRows,
      providerCount: item.providers.size,
      specialtyCount: item.specialties.size,
      contractCount: item.contractTypes.size,
      totalCoverage: item.workforceRows + item.finalHireRows + item.hiringRows,
    }))
    .sort((a, b) => b.totalCoverage - a.totalCoverage || a.stateCode.localeCompare(b.stateCode));
  const coverageLookup = Object.fromEntries(coveredStates.map((item) => [item.stateCode, item]));

  if (!coveredStates.length) {
    state.selectedCoverageState = 'all';
  } else if (
    state.selectedCoverageState === 'all'
    || !coverageLookup[state.selectedCoverageState]
  ) {
    state.selectedCoverageState = coveredStates[0].stateCode;
  }

  const selectedCoverage = coverageLookup[state.selectedCoverageState] || null;

  el.staffSummary.textContent = `${workforce.length} workforce rows · ${hires.length} final hires · ${futureLicenses} future-license notes`;
  el.staffKpis.innerHTML = [
    { label: 'Licensed States', value: states.length },
    { label: 'Specialties', value: specialties.length },
    { label: 'Final Hires', value: hires.length },
    { label: 'Future License Notes', value: futureLicenses },
  ].map((card) => `
    <div class="mini-kpi">
      <div class="k">${escapeHtml(card.label)}</div>
      <div class="v">${escapeHtml(card.value)}</div>
    </div>
  `).join('');

  el.staffInsights.innerHTML = [
    { title: 'Top Specialties', rows: specialties.slice(0, 6), suffix: 'providers' },
    { title: 'Top Licensed States', rows: states.slice(0, 6), suffix: 'licenses' },
  ].map((block) => `
    <div class="note-card">
      <strong>${escapeHtml(block.title)}</strong>
      <div class="metric-list">${renderMetricList(block.rows, block.suffix)}</div>
    </div>
  `).join('');

  el.coveragePanel.innerHTML = states.length
    ? renderMetricList(states.slice(0, 8), 'licenses')
    : '<div class="empty-state">No workforce state coverage is available.</div>';

  // License expiration alerts: bucket workforce rows by days-to-expiration.
  // Workforce rows must include a populated `licenseExpiration` (parsed from
  // the optional "License Expiration" sheet column).
  if (el.licenseAlertsPanel) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const withDate = workforce
      .filter((w) => w.licenseExpiration instanceof Date && !Number.isNaN(w.licenseExpiration.valueOf()))
      .map((w) => {
        const days = Math.round((w.licenseExpiration - today) / 86400000);
        return { ...w, daysToExpiration: days };
      })
      .sort((a, b) => a.daysToExpiration - b.daysToExpiration);

    const expired = withDate.filter((w) => w.daysToExpiration < 0);
    const within30 = withDate.filter((w) => w.daysToExpiration >= 0 && w.daysToExpiration <= 30);
    const within60 = withDate.filter((w) => w.daysToExpiration > 30 && w.daysToExpiration <= 60);
    const within90 = withDate.filter((w) => w.daysToExpiration > 60 && w.daysToExpiration <= 90);

    if (el.licenseAlertsSummary) {
      el.licenseAlertsSummary.textContent = withDate.length
        ? `${expired.length} expired · ${within30.length} ≤30 days · ${within60.length} 31–60 days · ${within90.length} 61–90 days`
        : 'Add a "License Expiration" column to Current Workforce to populate.';
    }

    function fmtRow(w, tone) {
      const dueLabel = w.daysToExpiration < 0
        ? `Expired ${Math.abs(w.daysToExpiration)}d ago`
        : `${w.daysToExpiration}d`;
      return `
        <div class="metric-row">
          <span>
            ${escapeHtml(w.providerName || '—')}
            <span class="table-note">${escapeHtml(w.licensedState || '')} · ${escapeHtml(w.licenseNumber || '')}</span>
          </span>
          <strong class="${tone}">${escapeHtml(dueLabel)} · ${escapeHtml(w.licenseExpirationLabel || '')}</strong>
        </div>
      `;
    }

    const sections = [];
    if (expired.length) {
      sections.push(`<div class="note-card"><strong>Expired (act now)</strong>${expired.map((w) => fmtRow(w, 'status-blocked')).join('')}</div>`);
    }
    if (within30.length) {
      sections.push(`<div class="note-card"><strong>Expiring within 30 days</strong>${within30.map((w) => fmtRow(w, 'status-warning')).join('')}</div>`);
    }
    if (within60.length) {
      sections.push(`<div class="note-card"><strong>Expiring 31–60 days</strong>${within60.map((w) => fmtRow(w, 'status-warning')).join('')}</div>`);
    }
    if (within90.length) {
      sections.push(`<div class="note-card"><strong>Expiring 61–90 days</strong>${within90.map((w) => fmtRow(w)).join('')}</div>`);
    }

    if (!withDate.length) {
      el.licenseAlertsPanel.innerHTML = `
        <div class="empty-state">
          No license expiration dates loaded yet.<br>
          To activate alerts: add a column called <code>License Expiration</code> to the
          Current Workforce sheet (date format MM/DD/YYYY or YYYY-MM-DD) and refresh.
        </div>
      `;
    } else if (!sections.length) {
      el.licenseAlertsPanel.innerHTML = '<div class="empty-state">No licenses expire in the next 90 days. ✓</div>';
    } else {
      el.licenseAlertsPanel.innerHTML = sections.join('');
    }
  }

  el.workforceTable.innerHTML = workforce.length
    ? workforce.slice(0, 18).map((item) => `
      <tr>
        <td>${escapeHtml(item.providerName)}</td>
        <td>${escapeHtml(item.licensedState)}</td>
        <td>${escapeHtml(item.specialty)}</td>
        <td>${escapeHtml(item.contractType)}</td>
        <td>${escapeHtml(item.futureLicense || '—')}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="5" class="empty-state">No workforce rows match the current filters.</td></tr>';

  el.hireTable.innerHTML = hires.length
    ? hires.slice(0, 18).map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.states)}</td>
        <td>${escapeHtml(item.workingHours)}</td>
        <td>${escapeHtml(item.rateLabel || (item.rateValue ? money(item.rateValue) : 'N/A'))}</td>
        <td>${escapeHtml(item.comments)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="6" class="empty-state">No final-hire rows match the current filters.</td></tr>';

  el.coveredStatesCount.textContent = coveredStates.length;
  el.stateCoverageNotice.innerHTML = `
    <strong>State insurance maps are temporarily removed.</strong>
    This section now shows verified company coverage only while the county-level multi-state insurance module is rebuilt on top of real datasets.
  `;
  el.stateCoverageSummary.textContent = selectedCoverage
    ? `${selectedCoverage.stateCode} selected from ${coveredStates.length} covered states`
    : 'No state coverage could be derived from the current company data';
  el.stateCoverageSelect.innerHTML = coveredStates.length
    ? coveredStates.map((item) => `
      <option value="${escapeHtml(item.stateCode)}" ${item.stateCode === state.selectedCoverageState ? 'selected' : ''}>
        ${escapeHtml(item.stateCode)} · ${item.totalCoverage} rows
      </option>
    `).join('')
    : '<option value="all">No states available</option>';
  el.stateCoverageSelect.onchange = (event) => {
    state.selectedCoverageState = event.target.value;
    renderStaffView();
  };

  el.stateCoverageStats.innerHTML = coveredStates.length
    ? [
      { label: 'Covered States', value: coveredStates.length },
      { label: 'Workforce-Licensed States', value: coveredStates.filter((item) => item.workforceRows > 0).length },
      { label: 'Final Hire States', value: coveredStates.filter((item) => item.finalHireRows > 0).length },
      { label: 'Hiring Pipeline States', value: coveredStates.filter((item) => item.hiringRows > 0).length },
    ].map((item) => `
      <div class="metric-row">
        <span>${escapeHtml(item.label)}</span>
        <strong>${escapeHtml(item.value)}</strong>
      </div>
    `).join('')
    : '<div class="empty-state">State coverage rows will appear here when the source data includes them.</div>';

  el.stateAtlas.innerHTML = coveredStates.length
    ? coveredStates.map((item) => `
      <button type="button" class="state-chip-card ${item.stateCode === state.selectedCoverageState ? 'active' : ''}" data-state-code="${escapeHtml(item.stateCode)}">
        <div class="state-chip-top">
          <div class="state-chip-code">${escapeHtml(item.stateCode)}</div>
          <span class="badge status-approved">${item.totalCoverage}</span>
        </div>
        <div class="state-chip-meta">
          <div class="table-note">${item.providerCount} providers</div>
          <div class="table-note">${item.workforceRows} workforce · ${item.finalHireRows} final · ${item.hiringRows} hiring</div>
          <div class="table-note">${item.specialtyCount} specialties · ${item.contractCount} contract types</div>
        </div>
      </button>
    `).join('')
    : '<div class="empty-state">No covered states are available yet.</div>';
  el.stateAtlas.querySelectorAll('.state-chip-card').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedCoverageState = button.getAttribute('data-state-code');
      renderStaffView();
    });
  });

  const selectedWorkforceRows = selectedCoverage
    ? model.dataset.currentWorkforce.filter((item) =>
      OpsSheets.utils.splitStates(item.licensedState || '').includes(selectedCoverage.stateCode)
    )
    : [];
  const selectedFinalRows = selectedCoverage
    ? model.dataset.finalHires.filter((item) =>
      OpsSheets.utils.splitStates(item.states || '').includes(selectedCoverage.stateCode)
    )
    : [];
  const selectedHiringRows = selectedCoverage
    ? model.dataset.newHiring.filter((item) =>
      OpsSheets.utils.splitStates(item.state || '').includes(selectedCoverage.stateCode)
    )
    : [];
  const selectedSpecialties = summarizeCounts([
    ...selectedWorkforceRows.map((item) => item.specialty || 'Unknown'),
    ...selectedFinalRows.map((item) => item.title || 'Unknown'),
    ...selectedHiringRows.map((item) => item.specialty || 'Unknown'),
  ]);
  const selectedContracts = summarizeCounts(selectedWorkforceRows.map((item) => item.contractType || 'Unknown'));
  const selectedProviders = uniq([
    ...selectedWorkforceRows.map((item) => item.providerName).filter(Boolean),
    ...selectedFinalRows.map((item) => item.name).filter(Boolean),
    ...selectedHiringRows.map((item) => item.name).filter(Boolean),
  ]);

  el.stateCoverageInsights.innerHTML = selectedCoverage
    ? [
      {
        title: `${selectedCoverage.stateCode} Coverage Mix`,
        rows: [
          { label: 'Total coverage rows', value: selectedCoverage.totalCoverage },
          { label: 'Providers', value: selectedCoverage.providerCount },
          { label: 'Workforce rows', value: selectedCoverage.workforceRows },
          { label: 'Final hire rows', value: selectedCoverage.finalHireRows },
          { label: 'Hiring rows', value: selectedCoverage.hiringRows },
        ],
        suffix: '',
      },
      {
        title: `${selectedCoverage.stateCode} Top Specialties`,
        rows: selectedSpecialties.slice(0, 8),
        suffix: 'rows',
      },
      {
        title: `${selectedCoverage.stateCode} Contract Mix`,
        rows: selectedContracts.slice(0, 8),
        suffix: 'providers',
      },
      {
        title: `${selectedCoverage.stateCode} Named Coverage`,
        rows: selectedProviders.slice(0, 8).map((label) => ({ label, value: '' })),
        suffix: '',
      },
    ].map((block) => `
      <div class="note-card">
        <strong>${escapeHtml(block.title)}</strong>
        <div class="metric-list">${renderMetricList(block.rows, block.suffix)}</div>
      </div>
    `).join('')
    : '<div class="empty-state">No company-wide state coverage detail is available yet.</div>';
}

function renderHubstaffView() {
  const hubstaff = model?.hubstaff || {
    configured: false,
    source: 'not_configured',
    loadedAt: null,
    stale: false,
    staleReason: '',
    employeeCount: 0,
    trackedHours: 0,
    activityRate: 0,
    payrollEstimate: 0,
    attendanceIssues: 0,
    rows: [],
    topEmployees: [],
  };
  const sourceConfigured = Boolean(hubstaff && hubstaff.configured);
  const isLoading = hubstaff.source === 'loading';
  const isUnavailable = hubstaff.source === 'unavailable';
  const isEmpty = sourceConfigured && !isLoading && !isUnavailable && (!hubstaff.rows || hubstaff.rows.length === 0);
  const employeeCount = model?.hubstaff?.employeeCount || 0;
  const trackedHours = model?.hubstaff?.trackedHours || 0;
  const activityRate = model?.hubstaff?.activityRate || 0;
  const payrollEstimate = model?.hubstaff?.payrollEstimate || 0;
  const topEmployees = hubstaff.topEmployees || [];
  const rows = hubstaff.rows || [];

  el.hubstaffSummary.textContent = isLoading
    ? 'Loading Hubstaff source…'
    : isUnavailable
    ? 'Hubstaff source could not be loaded'
    : sourceConfigured
    ? isEmpty
      ? 'Hubstaff source is connected, but returned no rows'
      : `${employeeCount} active team members · ${trackedHours.toFixed(1)} tracked hours`
    : 'Hubstaff tab is ready, but the live account source is not configured yet';
  el.hubstaffTimestamp.textContent = `Last updated: ${formatDateTime(hubstaff.loadedAt)}`;

  el.hubstaffKpis.innerHTML = [
    { label: 'Active Team Members', value: employeeCount },
    { label: 'Tracked Hours', value: trackedHours.toFixed(1) },
    { label: 'Avg Activity', value: sourceConfigured ? percent(activityRate) : 'N/A' },
    { label: 'Payroll Estimate', value: sourceConfigured ? money(payrollEstimate) : 'N/A' },
  ].map((card) => `
    <div class="mini-kpi">
      <div class="k">${escapeHtml(card.label)}</div>
      <div class="v">${escapeHtml(card.value)}</div>
    </div>
  `).join('');

  el.hubstaffStatus.innerHTML = [
    isLoading
      ? 'Loading state: waiting for the Hubstaff source response.'
      : isUnavailable
        ? `Hubstaff JSON could not be loaded: ${hubstaff.sourceError || 'Unknown error.'}`
      : sourceConfigured
        ? isEmpty
          ? 'Empty state: the Hubstaff JSON endpoint is connected, but it returned no rows for the current snapshot.'
          : `Hubstaff data is connected from Apps Script JSON with ${rows.length} imported rows.`
        : 'Empty state: no Hubstaff source is connected yet. The tab is in place so we can add it without changing the site structure again.',
    hubstaff.stale
      ? `Stale-data flag: ${hubstaff.staleReason || 'the last available Hubstaff data may be out of date.'}`
      : 'Stale-data flag: current snapshot is considered fresh.',
    sourceConfigured
      ? `Attendance issues: ${hubstaff.attendanceIssues || 0} · JSON endpoint: ${hubstaff.sourceUrl || 'Not set'}`
      : 'The safest GitHub Pages pattern is to load Hubstaff data from a sanitized Apps Script JSON endpoint, not from private Hubstaff credentials in browser code.',
  ].map((line) => `<div class="note-card">${line}</div>`).join('');

  el.hubstaffReadiness.innerHTML = sourceConfigured
    ? topEmployees.length
      ? topEmployees.map((row) => `
        <div class="metric-row">
          <span>${escapeHtml(row.employeeName)}</span>
          <strong>${row.trackedHours.toFixed(1)} hrs · ${percent(row.activityPercent)}</strong>
        </div>
      `).join('')
      : '<div class="empty-state">No employee-level Hubstaff rollups are available yet.</div>'
    : [
      'Set `HUBSTAFF_JSON_URL` in `sheets.js` to the published Apps Script Web App endpoint.',
      'The endpoint should return sanitized JSON rows only, never Hubstaff tokens or refresh credentials.',
      'Expected fields: employee_name, team_name, date, tracked_hours, activity_percent, pay_rate, payroll_estimate, attendance_status, source_updated_at.',
    ].map((line) => `<div class="note-card">${line}</div>`).join('');

  if (isLoading) {
    el.hubstaffMetricsTable.innerHTML = '<tr><td colspan="8" class="empty-state">Loading Hubstaff rows…</td></tr>';
  } else if (isUnavailable) {
    el.hubstaffMetricsTable.innerHTML = `<tr><td colspan="8" class="empty-state">${escapeHtml(hubstaff.sourceError || 'Hubstaff JSON could not be loaded.')}</td></tr>`;
  } else if (isEmpty) {
    el.hubstaffMetricsTable.innerHTML = '<tr><td colspan="8" class="empty-state">No Hubstaff rows were returned by the JSON endpoint.</td></tr>';
  } else if (!sourceConfigured) {
    el.hubstaffMetricsTable.innerHTML = '<tr><td colspan="8" class="empty-state">Configure `HUBSTAFF_JSON_URL` to load Hubstaff rows.</td></tr>';
  } else {
    el.hubstaffMetricsTable.innerHTML = rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.employeeName)}</td>
      <td>${escapeHtml(row.teamName || 'Unassigned')}</td>
      <td>${escapeHtml(row.dateLabel || 'N/A')}</td>
      <td>${escapeHtml(row.trackedHours.toFixed(1))}</td>
      <td>${escapeHtml(percent(row.activityPercent))}</td>
      <td>${escapeHtml(money(row.payrollEstimate))}</td>
      <td>${escapeHtml(row.attendanceStatus || 'No flag')}</td>
      <td>${escapeHtml(row.sourceUpdatedAtLabel || 'N/A')}</td>
    </tr>
  `).join('');
  }

  el.hubstaffNotes.innerHTML = [
    sourceConfigured
      ? `Live source: ${hubstaff.sourceUrl || 'Apps Script JSON endpoint'}`
      : 'Hubstaff is now designed for an Apps Script JSON backend rather than direct Hubstaff browser access.',
    sourceConfigured
      ? `Rows loaded: ${rows.length}. Last updated field comes from source_updated_at on the JSON rows.`
      : 'Do not place Hubstaff API keys, refresh tokens, or access tokens in this website code.',
    sourceConfigured
      ? 'If the endpoint changes shape, keep the expected field names stable so the static site does not need a secrets-bearing update.'
      : 'Once the Apps Script Web App URL is set, the tab will fetch the sanitized JSON directly from GitHub Pages.',
  ].map((line) => `<div class="note-card">${line}</div>`).join('');
}

function buildInsuranceBreaks(values) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return [0];
  const percentiles = [0.25, 0.5, 0.75, 1];
  return Array.from(new Set(percentiles.map((point) => {
    const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * point));
    return sorted[index];
  })));
}

function insuranceColor(value, breaks) {
  if (!value) return '#16213d';
  const palette = ['#213a6b', '#295598', '#3f73bb', '#5b8fd0', '#7fafe8'];
  let colorIndex = 0;
  while (colorIndex < breaks.length && value > breaks[colorIndex]) {
    colorIndex += 1;
  }
  return palette[Math.min(colorIndex, palette.length - 1)];
}

async function renderInsuranceMap(selectedStateCode) {
  if (state.view !== 'insurance') return;
  if (!selectedStateCode || !el.insuranceCountyMap) return;
  if (typeof L === 'undefined') {
    el.insuranceCountyMap.innerHTML = '<div class="empty-state">Leaflet did not load, so the county map could not be rendered.</div>';
    return;
  }

  const insuranceStates = model?.insurance?.states || [];
  const selectedState = insuranceStates.find((entry) => entry.state === selectedStateCode);
  if (!selectedState) {
    el.insuranceCountyMap.innerHTML = `<div class="empty-state">No insurance map data is available for ${escapeHtml(selectedStateCode)}.</div>`;
    return;
  }

  if (!insuranceGeoJson) {
    const response = await fetch(model.insurance.geojsonPath, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`County GeoJSON could not be loaded: ${response.status}`);
    }
    insuranceGeoJson = await response.json();
  }

  // Fast lookups for shading: prefer county_fips when present; fall back to
  // county name (lowercased) since the current CSV does not carry FIPS codes.
  const countyLookup = Object.fromEntries(
    selectedState.locations
      .filter((location) => location.county_fips)
      .map((location) => [location.county_fips, location])
  );
  const countyNameLookup = Object.fromEntries(
    selectedState.locations
      .filter((location) => location.county)
      .map((location) => [String(location.county).trim().toLowerCase(), location])
  );

  // Resolve the 2-digit FIPS prefix for this state. We use the static map
  // exposed by OpsInsurance.stateFips first and only fall back to row data.
  const stateFipsMap = (model.insurance && model.insurance.stateFips) || OpsInsurance.stateFips || {};
  const stateFips = stateFipsMap[selectedStateCode]
    || (selectedState.rows.find((row) => row.county_fips)?.county_fips?.slice(0, 2) || '');

  if (!stateFips) {
    el.insuranceCountyMap.innerHTML = `<div class="empty-state">No FIPS prefix is configured for ${escapeHtml(selectedStateCode)}, so the county map cannot be drawn.</div>`;
    return;
  }
  const stateFeatures = insuranceGeoJson.features.filter((feature) => feature.properties.STATE === stateFips);
  const breaks = buildInsuranceBreaks(selectedState.locations.map((location) => location.total_enrollment));
  const mode = state.mapMode === 'priority' ? 'priority' : 'enrollment';

  // Marketing-priority palette: red (no in-network) → yellow → green (high in-network share).
  // Choosing 5 buckets to match the existing enrollment palette length.
  const priorityPalette = ['#7a1f1f', '#a64a2a', '#c8861f', '#9bbf3a', '#3f9d5a'];
  function priorityColor(share) {
    if (share <= 0) return priorityPalette[0];
    if (share < 0.2) return priorityPalette[1];
    if (share < 0.4) return priorityPalette[2];
    if (share < 0.7) return priorityPalette[3];
    return priorityPalette[4];
  }

  if (!insuranceMap) {
    insuranceMap = L.map(el.insuranceCountyMap, {
      attributionControl: false,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 12,
    }).addTo(insuranceMap);
  }

  if (insuranceMapLayer) {
    insuranceMapLayer.remove();
    insuranceMapLayer = null;
  }

  insuranceMapLayer = L.geoJSON({
    type: 'FeatureCollection',
    features: stateFeatures,
  }, {
    style(feature) {
      const county = countyLookup[feature.id]
        || countyNameLookup[String(feature.properties.NAME || '').trim().toLowerCase()];
      let fillColor = '#16213d';
      let fillOpacity = 0.15;
      if (county) {
        fillOpacity = 0.82;
        if (mode === 'priority') {
          fillColor = priorityColor(county.in_network_share || 0);
        } else {
          fillColor = insuranceColor(county.total_enrollment, breaks);
        }
      }
      return {
        color: '#d6e2ff',
        weight: 1,
        fillOpacity,
        fillColor,
      };
    },
    onEachFeature(feature, layer) {
      const location = countyLookup[feature.id]
        || countyNameLookup[String(feature.properties.NAME || '').trim().toLowerCase()];
      const countyName = feature.properties.NAME;
      if (!location) {
        layer.bindTooltip(`<strong>${escapeHtml(countyName)}</strong><br>No verified insurance rows loaded yet`);
        return;
      }
      const sharePct = Math.round((location.in_network_share || 0) * 100);
      const inNetParents = (location.in_network_parent_orgs || []).slice(0, 3).join(', ') || '—';
      const outOfNetParents = (location.out_of_network_parent_orgs || []).slice(0, 3).join(', ') || '—';
      const top = (location.plan_names || []).slice(0, 3).join(', ') || '—';
      const tooltipBody = mode === 'priority'
        ? `<strong>${escapeHtml(countyName)}</strong>
           <br><b>${sharePct}%</b> of enrollment on plans you accept
           <br>Addressable: ${wholeNumber(location.in_network_enrollment || 0)}
           <br>Out-of-network: ${wholeNumber(location.out_of_network_enrollment || 0)}
           <br>In-network parents: ${escapeHtml(inNetParents)}
           <br>Gap parents: ${escapeHtml(outOfNetParents)}`
        : `<strong>${escapeHtml(countyName)}</strong>
           <br>${wholeNumber(location.total_enrollment)} total enrollment across ${location.row_count} rows
           <br>Plans: ${escapeHtml(top)}
           <br>Parents: ${escapeHtml((location.parent_orgs || []).slice(0, 2).join(', ') || '—')}`;
      layer.bindTooltip(tooltipBody);
    },
  }).addTo(insuranceMap);

  const bounds = insuranceMapLayer.getBounds();
  if (bounds.isValid()) {
    insuranceMap.fitBounds(bounds, { padding: [16, 16] });
  }
  setTimeout(() => insuranceMap.invalidateSize(), 0);

  // Legend reflects whichever mode is active
  if (el.insuranceMapLegend) {
    if (mode === 'priority') {
      el.insuranceMapLegend.innerHTML = `
        <div class="legend-row"><span>% of enrollment on plans you accept:</span></div>
        <div class="legend-bar">
          ${priorityPalette.map((c) => `<span style="background:${c}"></span>`).join('')}
        </div>
        <div class="legend-row"><span>0%</span><span style="margin:0 0.6rem">→</span><span>100%</span></div>
      `;
    } else {
      el.insuranceMapLegend.innerHTML = `
        <div class="legend-row"><span>Total enrollment per county:</span></div>
        <div class="legend-bar">
          <span style="background:#213a6b"></span>
          <span style="background:#295598"></span>
          <span style="background:#3f73bb"></span>
          <span style="background:#5b8fd0"></span>
          <span style="background:#7fafe8"></span>
        </div>
        <div class="legend-row"><span>low</span><span style="margin:0 0.6rem">→</span><span>high</span></div>
      `;
    }
  }
}

// State-level marketing summary: total addressable enrollment, top in-network
// parent orgs, top "gap" parent orgs (high enrollment, not contracted).
function renderMarketingSummary(selectedState) {
  if (!el.insuranceMarketingSummary) return;
  if (!selectedState || !selectedState.locations) {
    el.insuranceMarketingSummary.innerHTML = '';
    return;
  }
  const totalEnrollment = selectedState.locations.reduce((s, l) => s + (l.total_enrollment || 0), 0);
  const inNet = selectedState.locations.reduce((s, l) => s + (l.in_network_enrollment || 0), 0);
  const outOfNet = totalEnrollment - inNet;
  const sharePct = totalEnrollment > 0 ? Math.round((inNet / totalEnrollment) * 100) : 0;

  // Aggregate by parent_org across all rows in the state
  const parentTotals = {};
  selectedState.rows.forEach((row) => {
    if (!row.parent_org) return;
    if (!parentTotals[row.parent_org]) {
      parentTotals[row.parent_org] = { total: 0, in_network: false };
    }
    parentTotals[row.parent_org].total += row.total_enrollment || 0;
    if (row.in_network) parentTotals[row.parent_org].in_network = true;
  });
  const parentRows = Object.entries(parentTotals)
    .map(([parent, v]) => ({ parent, total: v.total, in_network: v.in_network }))
    .sort((a, b) => b.total - a.total);
  const inNetTop = parentRows.filter((p) => p.in_network).slice(0, 5);
  const gapTop = parentRows.filter((p) => !p.in_network).slice(0, 5);

  el.insuranceMarketingSummary.innerHTML = `
    <div class="metric-row"><span>Total enrollment</span><strong>${wholeNumber(totalEnrollment)}</strong></div>
    <div class="metric-row"><span>Addressable (in-network)</span><strong>${wholeNumber(inNet)} · ${sharePct}%</strong></div>
    <div class="metric-row"><span>Out-of-network</span><strong>${wholeNumber(outOfNet)}</strong></div>
    <div class="note-card">
      <strong>Top in-network parent orgs</strong>
      ${inNetTop.length
        ? inNetTop.map((p) => `<div class="metric-row"><span>${escapeHtml(p.parent)}</span><strong>${wholeNumber(p.total)}</strong></div>`).join('')
        : '<div class="empty-state">No parent orgs marked "in-network" yet — edit data/contracted_plans.csv to set status.</div>'}
    </div>
    <div class="note-card">
      <strong>Gap list — high enrollment, not yet contracted</strong>
      ${gapTop.length
        ? gapTop.map((p) => `<div class="metric-row"><span>${escapeHtml(p.parent)}</span><strong>${wholeNumber(p.total)}</strong></div>`).join('')
        : '<div class="empty-state">All major parent orgs in this state are already in-network.</div>'}
    </div>
  `;
}

async function renderInsuranceView() {
  if (!model) return;

  if (!model.insurance || !Array.isArray(model.insurance.states)) {
    el.insuranceValidationBanner.textContent = 'Insurance System: loading source files…';
    el.insuranceSelectionSummary.textContent = 'Loading verified insurance rows…';
    el.insuranceStatus.innerHTML = '<div class="note-card">Insurance datasets are loading on demand for this tab.</div>';
    el.insuranceCountyTable.innerHTML = '<tr><td colspan="5" class="empty-state">Loading county insurance rows…</td></tr>';
    el.insurancePlanTable.innerHTML = '<tr><td colspan="6" class="empty-state">Loading plan rows…</td></tr>';
    await ensureInsuranceData();
  }

  const insurance = model.insurance || {
    states: [],
    rows: [],
    error: 'Insurance data is not loaded yet.',
  };
  const validation = insurance.validation || {
    validStateCount: 0,
    invalidRowCount: 0,
    invalidStateValues: [],
  };

  if (!insurance.states.length) {
    el.insuranceValidationBanner.textContent = `Insurance System: MASTER CSV ACTIVE — ${validation.validStateCount} valid states, ${validation.invalidRowCount} invalid rows rejected`;
    el.insuranceSelectionSummary.textContent = 'No verified insurance rows are loaded yet.';
    el.insuranceStateSelect.innerHTML = '<option value="all">No states available</option>';
    el.insuranceStatus.innerHTML = [
      `<div class="empty-state">${escapeHtml(insurance.error || 'Insurance data is not available yet.')}</div>`,
      `<div class="note-card">Valid states loaded: ${escapeHtml(validation.validStateCount)}</div>`,
      `<div class="note-card">Invalid rows rejected: ${escapeHtml(validation.invalidRowCount)}</div>`,
    ].join('');
    el.insuranceKpis.innerHTML = '';
    el.insuranceSourceMeta.innerHTML = [
      '<div class="metric-row"><span>Master CSV source</span><strong>data/state_insurance_sample.csv</strong></div>',
      `<div class="metric-row"><span>Valid states</span><strong>${escapeHtml(validation.validStateCount)}</strong></div>`,
      `<div class="metric-row"><span>Invalid rows rejected</span><strong>${escapeHtml(validation.invalidRowCount)}</strong></div>`,
    ].join('');
    el.insuranceCountyTable.innerHTML = '<tr><td colspan="5" class="empty-state">No county insurance rows are available.</td></tr>';
    el.insurancePlanTable.innerHTML = '<tr><td colspan="6" class="empty-state">No verified plan rows are available.</td></tr>';
    el.insuranceSourceCatalog.innerHTML = '';
    return;
  }

  const insuranceLookup = Object.fromEntries(insurance.states.map((entry) => [entry.state, entry]));
  const validStates = insurance.states.map((entry) => entry.state);
  if (!validStates.includes(state.insuranceState)) {
    state.insuranceState = validStates[0];
  }
  const selectedState = insuranceLookup[state.insuranceState];
  el.insuranceValidationBanner.textContent = `Insurance System: MASTER CSV ACTIVE — ${validation.validStateCount} valid states, ${validation.invalidRowCount} invalid rows rejected`;

  el.insuranceStateSelect.innerHTML = insurance.states.map((entry) => `
    <option value="${escapeHtml(entry.state)}" ${entry.state === state.insuranceState ? 'selected' : ''}>
      ${escapeHtml(entry.label)}
    </option>
  `).join('');
  el.insuranceStateSelect.value = state.insuranceState;

  el.insuranceSelectionSummary.textContent = `${selectedState.label} · ${selectedState.locations.length} geography rows · ${selectedState.plan_count} plan rows`;
  el.insuranceMapTitle.textContent = `${selectedState.label} County Insurance Enrollment`;
  el.insuranceMapSub.textContent = `Source years: ${selectedState.source_years.join(', ') || 'N/A'} · rows are loaded from external CSV files`;

  el.insuranceStatus.innerHTML = [
    `No hardcoded state buttons are used here. The dropdown is populated dynamically from the master CSV at data/state_insurance_sample.csv with ${validation.validStateCount} valid states.`,
    'Renderer path: insurance.js -> renderInsuranceView().',
    'The system supports either county or geographic_region and continues rendering when some fields are blank.',
    `Invalid rows rejected during state validation: ${validation.invalidRowCount}.`,
    selectedState.notes[0] || 'No source note available for this state.',
  ].map((line) => `<div class="note-card">${escapeHtml(line)}</div>`).join('');

  el.insuranceKpis.innerHTML = [
    { label: 'Valid States', value: validation.validStateCount },
    { label: 'Invalid Rows Rejected', value: validation.invalidRowCount },
    { label: 'Geographies', value: selectedState.locations.length },
    { label: 'Total Enrollment', value: wholeNumber(selectedState.total_enrollment) },
    { label: 'Plan Rows', value: selectedState.plan_count },
    { label: 'Parent Orgs', value: selectedState.parent_org_count },
  ].map((card) => `
    <div class="mini-kpi">
      <div class="k">${escapeHtml(card.label)}</div>
      <div class="v">${escapeHtml(card.value)}</div>
    </div>
  `).join('');

  el.insuranceSourceMeta.innerHTML = [
    `<div class="metric-row"><span>Valid states</span><strong>${escapeHtml(validation.validStateCount)}</strong></div>`,
    `<div class="metric-row"><span>Invalid rows rejected</span><strong>${escapeHtml(validation.invalidRowCount)}</strong></div>`,
    '<div class="metric-row"><span>Master CSV source</span><strong>data/state_insurance_sample.csv</strong></div>',
    `<div class="metric-row"><span>Source years</span><strong>${escapeHtml(selectedState.source_years.join(', ') || 'N/A')}</strong></div>`,
    validation.invalidStateValues.length ? `
      <div class="note-card">
        <strong>Rejected state values</strong>
        <div>${escapeHtml(validation.invalidStateValues.slice(0, 8).join(', '))}${validation.invalidStateValues.length > 8 ? ' …' : ''}</div>
      </div>
    ` : '',
    ...selectedState.source_urls.map((url) => `
      <div class="note-card">
        <strong>Verified source</strong>
        <div><a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url)}</a></div>
      </div>
    `),
  ].join('');

  el.insuranceCountyTable.innerHTML = selectedState.locations.map((location) => `
    <tr>
      <td>${escapeHtml(location.location_label)}</td>
      <td>${wholeNumber(location.total_enrollment)}</td>
      <td>${wholeNumber(location.row_count)}</td>
      <td>${wholeNumber(location.parent_orgs.length)}</td>
      <td>${escapeHtml(location.source_years.join(', ') || 'N/A')}</td>
    </tr>
  `).join('');

  el.insurancePlanTable.innerHTML = selectedState.rows.map((row) => `
    <tr>
      <td>${escapeHtml(row.county)}</td>
      <td>${escapeHtml(row.program_type)}</td>
      <td>${escapeHtml(row.plan_name)}</td>
      <td>${escapeHtml(row.parent_org)}</td>
      <td>${wholeNumber(row.total_enrollment)}</td>
      <td>${row.source_url ? `<a href="${escapeHtml(row.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(row.source_year || 'Source')}</a>` : escapeHtml(row.source_year || 'N/A')}</td>
    </tr>
  `).join('');

  const sourceCards = Array.from(new Set(selectedState.rows
    .filter((row) => row.source_url || row.source_year)
    .map((row) => JSON.stringify({
      url: row.source_url,
      year: row.source_year,
      note: row.notes,
    })))).map((entry) => JSON.parse(entry));

  el.insuranceSourceCatalog.innerHTML = sourceCards.length
    ? sourceCards.map((source) => `
      <div class="note-card">
        <strong>Source ${escapeHtml(source.year || 'N/A')}</strong>
        <div class="table-note">${escapeHtml(source.note || 'No note provided')}</div>
        <div>${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.url)}</a>` : 'No source URL provided'}</div>
      </div>
    `).join('')
    : '<div class="empty-state">No source URL or year is available for this state.</div>';

  renderMarketingSummary(selectedState);

  renderInsuranceMap(state.insuranceState).catch((error) => {
    console.error(error);
    el.insuranceCountyMap.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  });
}

function summarizeCounts(values) {
  return Object.entries(values.reduce((acc, value) => {
    if (!value) return acc;
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {}))
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
}

function renderMetricList(rows, suffix) {
  return rows.map((row) => `
    <div class="metric-row">
      <span>${escapeHtml(row.label)}</span>
      <strong>${row.value}${suffix ? ` ${escapeHtml(suffix)}` : ''}</strong>
    </div>
  `).join('');
}

function priorityScore(priority) {
  if (priority === 'High') return 3;
  if (priority === 'Medium') return 2;
  return 1;
}

function initFilters() {
  // Limit the state filter to the 29 states our company is actually licensed
  // in. Sheet rows can contain multi-state strings ("TX, FL"), "Unknown",
  // typos, or out-of-footprint codes (and even non-state values like
  // "FNP-C,1099"). splitStates() + a name→code fallback + the validStates
  // whitelist drops all of those.
  const validStateMap = OpsInsurance.validStates || {};
  const splitStates = OpsSheets.utils.splitStates;
  const nameToCode = {};
  Object.keys(validStateMap).forEach((code) => {
    nameToCode[validStateMap[code].toLowerCase()] = code;
  });
  const seen = new Set();
  (model.filterValues.states || []).forEach((value) => {
    // Try splitStates first ("AZ, FL" → ["AZ","FL"]).
    splitStates(value).forEach((code) => {
      if (validStateMap[code]) seen.add(code);
    });
    // Then treat the raw value as a possible full name ("California").
    const code = nameToCode[String(value || '').trim().toLowerCase()];
    if (code) seen.add(code);
  });
  // Show full names in the dropdown, sorted by name; keep the 2-letter
  // code as the option value so the filter stays stable.
  const companyStates = Array.from(seen)
    .map((code) => ({ code, name: validStateMap[code] }))
    .sort((a, b) => a.name.localeCompare(b.name));
  el.stateFilter.innerHTML = ['<option value="all">All states</option>']
    .concat(companyStates.map((s) => `<option value="${escapeHtml(s.code)}">${escapeHtml(s.name)}</option>`))
    .join('');
  fillSelect(el.specialtyFilter, 'All specialties', model.filterValues.specialties);
  fillSelect(el.statusFilter, 'All statuses', model.filterValues.statuses);
  fillSelect(el.sourceFilter, 'All sources', model.filterValues.sources.slice(1));
}

function resetFilters() {
  state.stateFilter = 'all';
  state.specialtyFilter = 'all';
  state.statusFilter = 'all';
  state.sourceFilter = 'all';
  state.search = '';

  el.stateFilter.value = 'all';
  el.specialtyFilter.value = 'all';
  el.statusFilter.value = 'all';
  el.sourceFilter.value = 'all';
  el.searchInput.value = '';
}

function render() {
  if (!model) return;
  renderViewNav();
  renderSourceMeta();
  const renderer = viewRenderers[state.view];
  if (renderer) renderer();
}

const viewRenderers = {
  executive() {
    renderExecutiveKpis();
    renderExecutiveInsights();
    renderWatchlist();
  },
  ops() {
    renderOpsKpis();
    renderCriticalActions();
    renderOwnerAccountability();
    renderRevenueRisk();
    renderPatientFlow();
    renderSystemHealth();
    renderIssuesQueue();
  },
  intake() {
    renderIntakeView();
  },
  aging() {
    renderAgingView();
  },
  credentialing() {
    renderCredentialingView();
  },
  staff() {
    renderStaffView();
  },
  hubstaff() {
    renderHubstaffView();
  },
  minutes() {
    renderMinutesView();
  },
  insurance() {
    renderInsuranceView().catch((error) => {
      console.error(error);
      el.insuranceCountyMap.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    });
  },
  marketing() {
    renderMarketingView();
    ensureInsuranceData()
      .then(() => {
        if (state.view === 'marketing') renderMarketingView();
      })
      .catch((error) => {
        console.error('Insurance support data unavailable for marketing priority:', error);
      });
  },
};

async function ensureInsuranceData() {
  if (!model) return null;
  if (model.insurance && Array.isArray(model.insurance.states)) {
    return model.insurance;
  }
  if (!insuranceLoadPromise) {
    insuranceLoadPromise = OpsInsurance.loadData()
      .then((insuranceData) => {
        model.insurance = insuranceData;
        return insuranceData;
      })
      .catch((error) => {
        model.insurance = {
          states: [],
          rows: [],
          sourceCatalog: [],
          error: error?.message || 'Insurance data load failed.',
        };
        return model.insurance;
      })
      .finally(() => {
        insuranceLoadPromise = null;
      });
  }
  return insuranceLoadPromise;
}

function bind() {
  el.stateFilter.addEventListener('change', (event) => {
    state.stateFilter = event.target.value;
    render();
  });
  el.specialtyFilter.addEventListener('change', (event) => {
    state.specialtyFilter = event.target.value;
    render();
  });
  el.statusFilter.addEventListener('change', (event) => {
    state.statusFilter = event.target.value;
    render();
  });
  el.sourceFilter.addEventListener('change', (event) => {
    state.sourceFilter = event.target.value;
    render();
  });
  el.searchInput.addEventListener('input', (event) => {
    state.search = event.target.value;
    render();
  });
  el.insuranceStateSelect.addEventListener('change', (event) => {
    state.insuranceState = event.target.value;
    renderInsuranceView();
  });
  // Map mode toggle (Total Enrollment / Marketing Priority)
  if (el.mapModeToggle) {
    el.mapModeToggle.querySelectorAll('.mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        if (mode !== state.mapMode) {
          state.mapMode = mode;
          el.mapModeToggle.querySelectorAll('.mode-btn').forEach((b) => {
            b.classList.toggle('active', b === btn);
          });
          renderInsuranceView();
        }
      });
    });
  }
  el.clearFilters.addEventListener('click', () => {
    resetFilters();
    render();
  });
  el.refreshBtn.addEventListener('click', () => loadData());
}

async function loadData() {
  el.liveStatus.textContent = '● Refreshing Google Sheets data…';
  el.resultsSummary.textContent = 'Loading';
  el.issuesTable.innerHTML = '<tr><td colspan="8" class="empty-state">Loading workbook data…</td></tr>';
  insuranceLoadPromise = null;

  try {
    model = await OpsSheets.loadWorkbookData();
    model.insurance = null;
    initFilters();
    render();
    const liveCount = model.sourceMeta.filter((item) => item.source === 'live').length;
    const cacheCount = model.sourceMeta.filter((item) => item.source === 'cache').length;
    el.liveStatus.textContent = `● ${liveCount} live tabs · ${cacheCount} cached tabs · refreshed ${formatDate(model.loadedAt)}`;
    // Load marketing data in parallel (non-blocking)
    loadMarketingData();
    // Load meeting minutes in parallel (non-blocking)
    loadMinutesData();
  } catch (error) {
    console.error(error);
    el.liveStatus.textContent = '● Workbook load failed';
    el.issuesTable.innerHTML = '<tr><td colspan="8" class="empty-state">The workbook could not be loaded. Check the published sheet URL in sheets.js.</td></tr>';
    el.resultsSummary.textContent = 'Load error';
  }
}


// ─── Marketing View ────────────────────────────────────────────────

let marketingModel = null;

async function loadMarketingData() {
  if (!el.marketingSummary) return;
  el.marketingSummary.textContent = 'Loading marketing data…';
  try {
    marketingModel = await OpsMarketing.loadData();
    renderMarketingView();
    const src = marketingModel.sources;
    const parts = Object.entries(src).map(([k, v]) => k + ': ' + v).join(' · ');
    el.marketingSummary.textContent = marketingModel.kpis.totalPosts + ' posts tracked · ' + parts + ' · refreshed ' + formatDateTime(marketingModel.loadedAt);
  } catch (err) {
    console.error('Marketing load error:', err);
    el.marketingSummary.textContent = 'Marketing data unavailable — ensure the sheet is published to web';
    renderMarketingEmpty();
  }
}

function renderMarketingEmpty() {
  if (el.marketingKpis) el.marketingKpis.innerHTML = '<article class="kpi caution"><div class="k">Data Source</div><div class="v">Not Connected</div><div class="d">Publish the marketing Google Sheet to web to enable this view</div></article>';
  if (el.marketingPostTable) el.marketingPostTable.innerHTML = '<tr><td colspan="9" class="empty-state">Marketing sheet not published yet. Go to the Google Sheet → File → Share → Publish to web.</td></tr>';
}

function renderMarketingView() {
  if (!marketingModel) { renderMarketingEmpty(); return; }
  var k = marketingModel.kpis;
  renderMarketingKpis(k);
  renderPlatformBreakdown(marketingModel.platforms);
  renderAccountBreakdown(marketingModel.accounts);
  renderWeeklyTrend(marketingModel.weeklyTrend);
  renderCalendarStatus(marketingModel.calendarByStatus, marketingModel.calendar);
  renderRecentPosts(marketingModel.recentPosts);
  renderMarketingPriorityMatrix();
}

function renderMarketingKpis(k) {
  if (!el.marketingKpis) return;
  var cards = [
    { label: 'Total Posts', value: wholeNumber(k.totalPosts), detail: 'Across 3 tele companies', tone: '' },
    { label: 'Impressions', value: wholeNumber(k.totalImpressions), detail: 'Total views of posts', tone: '' },
    { label: 'Reach', value: wholeNumber(k.totalReach), detail: 'Unique accounts reached', tone: '' },
    { label: 'Engagement Rate', value: percent(k.engagementRate), detail: wholeNumber(k.totalEngagements) + ' total engagements', tone: k.engagementRate >= 5 ? 'good' : k.engagementRate >= 2 ? '' : 'caution' },
    { label: 'Likes', value: wholeNumber(k.totalLikes), detail: 'All platforms', tone: '' },
    { label: 'Comments', value: wholeNumber(k.totalComments), detail: 'Conversation starters', tone: '' },
    { label: 'Shares', value: wholeNumber(k.totalShares), detail: 'Organic amplification', tone: '' },
    { label: 'Clicks', value: wholeNumber(k.totalClicks), detail: 'Profile / link clicks', tone: '' },
  ];
  el.marketingKpis.innerHTML = cards.map(function(c) {
    return '<article class="kpi ' + c.tone + '"><div class="k">' + escapeHtml(c.label) + '</div><div class="v">' + escapeHtml(c.value) + '</div><div class="d">' + escapeHtml(c.detail) + '</div></article>';
  }).join('');
}

function renderPlatformBreakdown(platforms) {
  if (!el.marketingPlatformBreakdown) return;
  var entries = Object.entries(platforms);
  if (!entries.length) { el.marketingPlatformBreakdown.innerHTML = '<p class="muted">No platform data available yet.</p>'; return; }
  el.marketingPlatformBreakdown.innerHTML = entries.map(function(e) {
    var plat = e[0], d = e[1];
    var eng = d.likes + d.comments + d.shares + d.clicks;
    var rate = d.impressions > 0 ? (eng / d.impressions * 100).toFixed(1) : '0.0';
    return '<div class="insight-row"><div><strong style="text-transform:capitalize;">' + escapeHtml(plat) + '</strong><div class="table-note">' + d.posts + ' posts · ' + wholeNumber(d.impressions) + ' impressions</div></div><div style="text-align:right;"><strong>' + wholeNumber(d.reach) + '</strong> reach<div class="table-note">' + rate + '% engagement · ' + wholeNumber(d.likes) + ' likes</div></div></div>';
  }).join('');
}

function renderAccountBreakdown(accounts) {
  if (!el.marketingAccountBreakdown) return;
  var entries = Object.entries(accounts);
  if (!entries.length) { el.marketingAccountBreakdown.innerHTML = '<p class="muted">No account data available yet.</p>'; return; }
  var acctLabels = { 'tele-therapeutics-health': 'Tele Therapeutics Health', 'well-america-health': 'Well America Health', 'therapyscentral': 'Therapys Central' };
  el.marketingAccountBreakdown.innerHTML = entries.map(function(e) {
    var acct = e[0], d = e[1];
    var eng = d.likes + d.comments + d.shares + d.clicks;
    var rate = d.impressions > 0 ? (eng / d.impressions * 100).toFixed(1) : '0.0';
    var label = acctLabels[acct] || acct;
    return '<div class="insight-row"><div><strong>' + escapeHtml(label) + '</strong><div class="table-note">' + d.posts + ' posts · ' + wholeNumber(d.impressions) + ' impressions</div></div><div style="text-align:right;"><strong>' + rate + '%</strong> engagement<div class="table-note">' + wholeNumber(d.likes) + ' likes · ' + wholeNumber(d.comments) + ' comments · ' + wholeNumber(d.shares) + ' shares</div></div></div>';
  }).join('');
}

function renderWeeklyTrend(weeks) {
  if (!el.marketingWeeklyTrend) return;
  if (!weeks.length) { el.marketingWeeklyTrend.innerHTML = '<p class="muted">No weekly data.</p>'; return; }
  var maxPosts = Math.max.apply(null, weeks.map(function(w) { return w.posts; }).concat([1]));
  el.marketingWeeklyTrend.innerHTML = '<div style="display:flex;align-items:flex-end;gap:6px;height:120px;padding:8px 0;">' + weeks.map(function(w) {
    var h = Math.max((w.posts / maxPosts) * 100, 4);
    return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;"><span style="font-size:11px;opacity:0.7;">' + w.posts + '</span><div style="width:100%;height:' + h + 'px;background:var(--accent,#3b82f6);border-radius:4px 4px 0 0;min-height:4px;" title="' + w.impressions + ' impressions, ' + w.engagement + ' engagements"></div><span style="font-size:10px;opacity:0.5;">' + w.label + '</span></div>';
  }).join('') + '</div><div class="table-note" style="margin-top:8px;">Posts per week · Hover bars for details</div>';
}

function renderCalendarStatus(byStatus, calendar) {
  if (!el.marketingCalendarStatus) return;
  var entries = Object.entries(byStatus);
  if (!entries.length) { el.marketingCalendarStatus.innerHTML = '<p class="muted">No content calendar data. Publish the Social media reels tab.</p>'; return; }
  var total = calendar.length;
  el.marketingCalendarStatus.innerHTML = '<div class="table-note" style="margin-bottom:8px;">' + total + ' items in content queue for 3 tele companies</div>' + entries.map(function(e) {
    var status = e[0], count = e[1];
    var pct = (count / total * 100).toFixed(0);
    return '<div class="insight-row"><div>' + badgeStatus(status) + '<span class="table-note" style="margin-left:8px;">' + count + ' items (' + pct + '%)</span></div><div style="flex:1;margin-left:12px;background:var(--bg-inset,#0f172a);border-radius:4px;height:8px;overflow:hidden;"><div style="width:' + pct + '%;height:100%;background:var(--accent,#3b82f6);border-radius:4px;"></div></div></div>';
  }).join('');
}

function renderRecentPosts(posts) {
  if (!el.marketingPostTable) return;
  if (el.marketingPostCount) { el.marketingPostCount.textContent = posts.length + ' most recent posts'; }
  if (!posts.length) { el.marketingPostTable.innerHTML = '<tr><td colspan="9" class="empty-state">No post data available. Ensure the marketing sheet is published to web.</td></tr>'; return; }
  var acctLabels = { 'tele-therapeutics-health': 'Tele Therapeutics', 'well-america-health': 'Well America', 'therapyscentral': 'Therapys Central' };
  el.marketingPostTable.innerHTML = posts.map(function(p) {
    var date = p.publishedAt ? formatDate(p.publishedAt) : '—';
    var acctLabel = acctLabels[p.account] || p.account;
    var contentSnippet = (p.content || '').length > 60 ? p.content.substring(0, 57) + '…' : (p.content || '—');
    var platformClass = p.platform === 'instagram' ? 'status-approved' : p.platform === 'facebook' ? 'status-warning' : 'status-open';
    return '<tr><td>' + escapeHtml(date) + '</td><td>' + escapeHtml(acctLabel) + '</td><td><span class="badge ' + platformClass + '">' + escapeHtml(p.platform || 'unknown') + '</span></td><td title="' + escapeHtml(p.content) + '">' + escapeHtml(contentSnippet) + '</td><td>' + wholeNumber(p.impressions) + '</td><td>' + wholeNumber(p.reach) + '</td><td>' + wholeNumber(p.likes) + '</td><td>' + wholeNumber(p.comments) + '</td><td>' + wholeNumber(p.shares) + '</td></tr>';
  }).join('');
}

// ─── State Marketing Priority Matrix ────────────────────────────────

function renderMarketingPriorityMatrix() {
  if (!el.marketingPriorityTable || !model) return;

  var workforce = model.dataset && model.dataset.currentWorkforce ? model.dataset.currentWorkforce : [];
  var newHiring = model.dataset && model.dataset.newHiring ? model.dataset.newHiring : [];
  var finalHires = model.dataset && model.dataset.finalHires ? model.dataset.finalHires : [];
  var insuranceData = model.insurance && model.insurance.rows ? model.insurance.rows : [];

  var stateData = {};
  var validStates = OpsInsurance && OpsInsurance.validStates ? OpsInsurance.validStates : {};

  // Count active providers per state
  workforce.forEach(function(w) {
    var codes = OpsSheets.utils.splitStates(w.licensedState || '');
    codes.forEach(function(code) {
      if (!stateData[code]) stateData[code] = { providers: 0, credentialing: 0, enrollment: 0, hiring: 0 };
      stateData[code].providers++;
    });
  });

  // Count credentialing in-progress per state
  newHiring.forEach(function(h) {
    var cred = (h.credentialing || '').toLowerCase();
    if (cred && cred.indexOf('n/a') === -1 && cred.indexOf('not') === -1 && cred.indexOf('complete') === -1 && cred.indexOf('done') === -1) {
      var codes = OpsSheets.utils.splitStates(h.state || '');
      codes.forEach(function(code) {
        if (!stateData[code]) stateData[code] = { providers: 0, credentialing: 0, enrollment: 0, hiring: 0 };
        stateData[code].credentialing++;
      });
    }
  });

  // Count hiring pipeline per state
  newHiring.concat(finalHires).forEach(function(h) {
    var codes = OpsSheets.utils.splitStates(h.state || h.states || '');
    codes.forEach(function(code) {
      if (!stateData[code]) stateData[code] = { providers: 0, credentialing: 0, enrollment: 0, hiring: 0 };
      stateData[code].hiring++;
    });
  });

  // Aggregate insurance enrollment per state
  insuranceData.forEach(function(row) {
    var code = (row.state || '').toUpperCase().trim();
    if (code && code.length === 2) {
      if (!stateData[code]) stateData[code] = { providers: 0, credentialing: 0, enrollment: 0, hiring: 0 };
      stateData[code].enrollment += Number(row.enrollment || row.totalEnrollment || 0);
    }
  });

  // Score each state and classify
  var scored = Object.entries(stateData).map(function(e) {
    var code = e[0], d = e[1];
    var stateName = validStates[code] || code;
    var providerScore = Math.min(d.providers / 5, 1) * 40;
    var credScore = Math.min(d.credentialing / 3, 1) * 20;
    var enrollScore = Math.min(d.enrollment / 50000, 1) * 30;
    var hiringScore = Math.min(d.hiring / 5, 1) * 10;
    var totalScore = providerScore + credScore + enrollScore + hiringScore;

    var priority, rationale;
    if (d.providers >= 2 && d.credentialing >= 1 && d.enrollment > 0) {
      priority = 'Ready to Market';
      rationale = d.providers + ' active providers, ' + d.credentialing + ' credentialing, ' + wholeNumber(d.enrollment) + ' enrolled';
    } else if (d.credentialing >= 1 || (d.providers >= 1 && d.enrollment > 0)) {
      priority = 'Coming Soon';
      rationale = d.providers + ' providers, ' + d.credentialing + ' in credentialing pipeline';
    } else if (d.enrollment > 10000) {
      priority = 'Opportunity';
      rationale = 'High enrollment (' + wholeNumber(d.enrollment) + ') but limited provider presence';
    } else {
      priority = 'Monitor';
      rationale = d.providers + ' providers, ' + wholeNumber(d.enrollment) + ' enrollment';
    }

    return { code: code, name: stateName, providers: d.providers, credentialing: d.credentialing, enrollment: d.enrollment, hiring: d.hiring, score: totalScore, priority: priority, rationale: rationale };
  }).sort(function(a, b) { return b.score - a.score; });

  // Priority KPIs
  var ready = scored.filter(function(s) { return s.priority === 'Ready to Market'; }).length;
  var coming = scored.filter(function(s) { return s.priority === 'Coming Soon'; }).length;
  var opportunity = scored.filter(function(s) { return s.priority === 'Opportunity'; }).length;

  if (el.marketingPriorityKpis) {
    el.marketingPriorityKpis.innerHTML = '<div class="mini-kpi"><span class="mini-kpi-val">' + ready + '</span><span class="mini-kpi-label">Ready to Market</span></div><div class="mini-kpi"><span class="mini-kpi-val">' + coming + '</span><span class="mini-kpi-label">Coming Soon</span></div><div class="mini-kpi"><span class="mini-kpi-val">' + opportunity + '</span><span class="mini-kpi-label">Opportunity</span></div><div class="mini-kpi"><span class="mini-kpi-val">' + scored.length + '</span><span class="mini-kpi-label">Total States</span></div>';
  }

  if (el.marketingPriorityExplainer) {
    el.marketingPriorityExplainer.innerHTML = '<div class="note-card"><strong>How priorities are calculated:</strong> Active provider presence (40%) + credentialing pipeline (20%) + insurance enrollment volume (30%) + hiring pipeline (10%). States with active credentialed providers and enrollment data are prioritized for social media ad spend and organic content.</div>';
  }

  if (!scored.length) {
    el.marketingPriorityTable.innerHTML = '<tr><td colspan="6" class="empty-state">No state data to score. Load workforce and insurance data first.</td></tr>';
    return;
  }

  var priorityTone = { 'Ready to Market': 'status-approved', 'Coming Soon': 'status-warning', 'Opportunity': 'status-open', 'Monitor': 'status-blocked' };

  el.marketingPriorityTable.innerHTML = scored.slice(0, 25).map(function(s) {
    return '<tr><td><strong>' + escapeHtml(s.code) + '</strong> ' + escapeHtml(s.name) + '</td><td><span class="badge ' + (priorityTone[s.priority] || '') + '">' + escapeHtml(s.priority) + '</span></td><td>' + s.providers + '</td><td>' + s.credentialing + '</td><td>' + wholeNumber(s.enrollment) + '</td><td class="table-note">' + escapeHtml(s.rationale) + '</td></tr>';
  }).join('');
}
// --- Meeting Minutes View ---

let minutesModel = null;

async function loadMinutesData() {
  if (!el.minutesSummary) return;
  if (!OpsMinutes.configured()) { renderMinutesNotConfigured(); return; }
  el.minutesSummary.textContent = 'Loading meeting minutes…';
  try {
    minutesModel = await OpsMinutes.loadData();
    renderMinutesView();
    const m = minutesModel;
    el.minutesSummary.textContent =
      `${m.meetings.length} meetings · ${m.openActionItems.length} open action items · ` +
      `${m.source === 'cache' ? 'cached' : 'live'} · refreshed ${formatDateTime(m.loadedAt)}`;
  } catch (err) {
    console.error('Minutes load error:', err);
    renderMinutesEmpty('Meeting minutes unavailable — check the published sheet URL in minutes.js.');
  }
}

function renderMinutesNotConfigured() {
  if (el.minutesKpis) el.minutesKpis.innerHTML =
    '<article class="kpi warn"><div class="k">Data Source</div><div class="v">Not Connected</div>' +
    '<div class="d">Open the Minutes Log sheet → File → Share → Publish to web → CSV, then paste the key into minutes.js</div></article>';
  if (el.minutesTable) el.minutesTable.innerHTML =
    '<tr><td colspan="7" class="empty-state">Meeting minutes sheet not connected yet. See setup notes in minutes.js.</td></tr>';
  if (el.minutesActionItems) el.minutesActionItems.innerHTML = '<p class="muted">No source connected.</p>';
  if (el.minutesLatest) el.minutesLatest.innerHTML = '<p class="muted">No source connected.</p>';
  if (el.minutesSummary) el.minutesSummary.textContent = 'Minutes sheet not connected';
}

function renderMinutesEmpty(message) {
  const msg = message || 'No meeting minutes yet.';
  if (el.minutesTable) el.minutesTable.innerHTML = `<tr><td colspan="7" class="empty-state">${escapeHtml(msg)}</td></tr>`;
  if (el.minutesActionItems) el.minutesActionItems.innerHTML = '<p class="muted">No open action items.</p>';
  if (el.minutesLatest) el.minutesLatest.innerHTML = '<p class="muted">No meetings recorded yet.</p>';
}

function renderMinutesView() {
  if (!OpsMinutes.configured()) { renderMinutesNotConfigured(); return; }
  if (!minutesModel) { el.minutesSummary.textContent = 'Loading meeting minutes…'; return; }

  const m = minutesModel;

  // KPIs
  if (el.minutesKpis) {
    const lastDate = m.meetings.length && m.meetings[0].date ? formatDate(m.meetings[0].date) : '—';
    el.minutesKpis.innerHTML =
      `<article class="kpi"><div class="k">Meetings Logged</div><div class="v">${m.meetings.length}</div><div class="d">All recorded sessions</div></article>` +
      `<article class="kpi ${m.openActionItems.length ? 'warn' : ''}"><div class="k">Open Action Items</div><div class="v">${m.openActionItems.length}</div><div class="d">Awaiting completion</div></article>` +
      `<article class="kpi"><div class="k">Total Action Items</div><div class="v">${m.totalActionItems || 0}</div><div class="d">Open + completed</div></article>` +
      `<article class="kpi"><div class="k">Most Recent</div><div class="v">${escapeHtml(lastDate)}</div><div class="d">Last meeting on file</div></article>`;
  }

  if (!m.meetings.length) { renderMinutesEmpty('No meeting minutes recorded yet.'); return; }

  // Open action items
  if (el.minutesActionItems) {
    el.minutesActionItems.innerHTML = m.openActionItems.length
      ? m.openActionItems.map((ai) => `
        <div class="attention-item">
          <div>
            <strong>${escapeHtml(ai.text)}</strong>
            <div class="muted">${escapeHtml(ai.meeting.title || 'Meeting')}${ai.meeting.dateLabel ? ' · ' + escapeHtml(ai.meeting.dateLabel) : ''}</div>
          </div>
          ${ai.owner ? `<span class="badge status-open">${escapeHtml(ai.owner)}</span>` : ''}
        </div>`).join('')
      : '<p class="muted">All action items are complete. 🎉</p>';
    el.minutesActionSummary.textContent = `${m.openActionItems.length} open across ${m.meetings.length} meetings`;
  }

  // Latest meeting detail
  if (el.minutesLatest) {
    const latest = m.meetings[0];
    el.minutesLatestSummary.textContent = latest.dateLabel || '';
    el.minutesLatest.innerHTML = `
      <div class="note-card">
        <strong>${escapeHtml(latest.title || 'Untitled meeting')}</strong>
        ${latest.attendees ? `<div class="muted">Attendees: ${escapeHtml(latest.attendees)}</div>` : ''}
      </div>
      ${latest.summary ? `<p>${escapeHtml(latest.summary)}</p>` : ''}
      ${latest.decisions ? `<p><strong>Decisions:</strong> ${escapeHtml(latest.decisions)}</p>` : ''}
      ${latest.actionItems.length ? `<p><strong>Action items:</strong></p><ul>${latest.actionItems.map((ai) => `<li>${ai.done ? '✓ ' : ''}${escapeHtml(ai.text)}${ai.owner ? ' — ' + escapeHtml(ai.owner) : ''}</li>`).join('')}</ul>` : ''}
      ${latest.docLink ? `<p><a class="btn small" href="${escapeHtml(latest.docLink)}" target="_blank" rel="noreferrer">Open full minutes</a></p>` : ''}
    `;
  }

  // Full log table
  if (el.minutesTable) {
    el.minutesTable.innerHTML = m.meetings.map((mtg) => {
      const open = mtg.actionItems.filter((ai) => !ai.done).length;
      const total = mtg.actionItems.length;
      const actionCell = total
        ? `${open} open / ${total}`
        : '—';
      const docCell = mtg.docLink
        ? `<a href="${escapeHtml(mtg.docLink)}" target="_blank" rel="noreferrer">Doc</a>`
        : '';
      return `<tr>
        <td>${escapeHtml(mtg.dateLabel || '')}</td>
        <td><strong>${escapeHtml(mtg.title || '')}</strong></td>
        <td class="table-note">${escapeHtml(mtg.attendees || '')}</td>
        <td class="table-note">${escapeHtml(mtg.summary || '')}</td>
        <td class="table-note">${escapeHtml(mtg.decisions || '')}</td>
        <td>${actionCell}</td>
        <td>${docCell}</td>
      </tr>`;
    }).join('');
  }
}

bind();
renderViewNav();
loadData();
