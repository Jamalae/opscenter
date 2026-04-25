const state = {
  view: 'executive',
  stateFilter: 'all',
  specialtyFilter: 'all',
  statusFilter: 'all',
  sourceFilter: 'all',
  search: '',
  selectedCoverageState: 'all',
};

let model = null;

const views = [
  { id: 'executive', label: 'Executive Dashboard' },
  { id: 'ops', label: 'Ops Center' },
  { id: 'intake', label: 'Intake / Referral Reporting' },
  { id: 'staff', label: 'Staff Metrics' },
  { id: 'hubstaff', label: 'Hubstaff' },
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

function matchesFilters(textParts, values) {
  const query = state.search.trim().toLowerCase();
  const searchable = textParts.join(' ').toLowerCase();
  return (!query || searchable.includes(query))
    && (state.stateFilter === 'all' || values.state === state.stateFilter)
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
  el.viewNav.innerHTML = views.map((view) => `
    <button type="button" class="view-tab ${state.view === view.id ? 'active' : ''}" data-view="${view.id}">
      ${escapeHtml(view.label)}
    </button>
  `).join('');

  el.viewNav.querySelectorAll('.view-tab').forEach((button) => {
    button.addEventListener('click', () => {
      state.view = button.getAttribute('data-view');
      document.querySelectorAll('.view').forEach((section) => section.classList.remove('active'));
      document.getElementById(`view-${state.view}`).classList.add('active');
      renderViewNav();
    });
  });
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
  const cards = [
    { label: 'Tracked Candidates', value: model.metrics.totalCandidates, tone: 'good', detail: 'Across live workbook tabs' },
    { label: 'Open Interviews', value: model.metrics.openInterviews, tone: 'warn', detail: 'Active interview pipeline' },
    { label: 'Signed / Final', value: model.metrics.finalSigned, tone: 'good', detail: 'Final Sheet records' },
    { label: 'Active Workforce', value: model.metrics.activeWorkforce, tone: 'good', detail: 'Current workforce roster' },
    { label: 'States Covered', value: model.metrics.statesCovered, tone: 'accent', detail: 'Licensed state footprint' },
    { label: 'Open Issues', value: model.metrics.issueCount, tone: 'bad', detail: 'Ops follow-up queue' },
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
  const interviewsByStatus = summarizeCounts(model.dataset.interviews.map((item) => item.status || 'Unknown'));
  const hiringBySpecialty = summarizeCounts(model.dataset.newHiring.map((item) => item.specialty || 'Unknown'));
  const workforceByContract = summarizeCounts(model.dataset.currentWorkforce.map((item) => item.contractType || 'Unknown'));

  el.executiveSummary.textContent = `${model.metrics.totalCandidates} candidates tracked · ${model.metrics.activeWorkforce} active providers · ${model.metrics.issueCount} open issues`;

  el.executiveInsights.innerHTML = [
    {
      title: 'Interview Pipeline',
      body: renderMetricList(interviewsByStatus.slice(0, 5), 'rows'),
    },
    {
      title: 'New Hiring Mix',
      body: renderMetricList(hiringBySpecialty.slice(0, 5), 'candidates'),
    },
    {
      title: 'Contract Mix',
      body: renderMetricList(workforceByContract.slice(0, 5), 'providers'),
    },
  ].map((card) => `
    <div class="insight-card">
      <strong>${escapeHtml(card.title)}</strong>
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

  el.referralSourcePanel.innerHTML = referralSources.length
    ? renderMetricList(referralSources.slice(0, 6), 'rows')
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
    source: 'loading',
    loadedAt: null,
    stale: false,
    staleReason: '',
    employeeCount: 0,
    trackedHours: 0,
    activityRate: 0,
    payrollEstimate: 0,
    rows: [],
  };
  const sourceConfigured = Boolean(hubstaff && hubstaff.configured);
  const isLoading = hubstaff.source === 'loading';
  const isEmpty = sourceConfigured && (!hubstaff.rows || hubstaff.rows.length === 0);
  const employeeCount = model?.hubstaff?.employeeCount || 0;
  const trackedHours = model?.hubstaff?.trackedHours || 0;
  const activityRate = model?.hubstaff?.activityRate || 0;
  const payrollEstimate = model?.hubstaff?.payrollEstimate || 0;
  const topEmployees = hubstaff.topEmployees || [];
  const exceptions = hubstaff.exceptions || [];
  const weeklyKpis = hubstaff.weeklyKpis || [];

  el.hubstaffSummary.textContent = isLoading
    ? 'Loading Hubstaff source…'
    : sourceConfigured
    ? `${employeeCount} tracked team members · ${trackedHours} hours loaded`
    : 'Hubstaff tab is ready, but the live account source is not configured yet';
  el.hubstaffTimestamp.textContent = `Last updated: ${formatDateTime(hubstaff.loadedAt)}`;

  el.hubstaffKpis.innerHTML = [
    { label: 'Tracked Team Members', value: employeeCount },
    { label: 'Hours Synced', value: trackedHours },
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
      : sourceConfigured
        ? isEmpty
          ? 'Empty state: the Hubstaff source is connected, but it returned no rows for the current snapshot.'
          : `Hubstaff data is connected from Google Sheets with ${hubstaff.rows.length} imported rows.`
        : 'Empty state: no Hubstaff source is connected yet. The tab is in place so we can add it without changing the site structure again.',
    hubstaff.stale
      ? `Stale-data flag: ${hubstaff.staleReason || 'the last available Hubstaff data may be out of date.'}`
      : 'Stale-data flag: current snapshot is considered fresh.',
    sourceConfigured
      ? `Low activity rows: ${hubstaff.lowActivityCount || 0} · Zero-activity rows: ${hubstaff.noActivityCount || 0} · Attendance issues: ${hubstaff.attendanceIssues || 0}`
      : 'The safest GitHub Pages pattern is to load Hubstaff data from a published CSV/Sheet snapshot or a lightweight serverless proxy, not from a private token directly in browser code.',
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
      'Needed: which Hubstaff dataset you want exposed first: hours, activity, payroll, schedules, or attendance exceptions.',
      'Needed: a GitHub Pages-safe source. Best options are a published Google Sheet export, a CSV snapshot, or a small API proxy.',
      'Needed: column mapping for employee name, team, hours, activity, pay rate, and date range.',
    ].map((line) => `<div class="note-card">${line}</div>`).join('');

  el.hubstaffMetricsTable.innerHTML = [
    ['Hours by employee', isLoading ? 'Loading' : sourceConfigured ? 'Ready' : 'Awaiting source', sourceConfigured ? `${topEmployees.length} top employees ranked by tracked hours` : 'Daily or weekly tracked time by person'],
    ['Activity score', isLoading ? 'Loading' : sourceConfigured ? 'Ready' : 'Awaiting source', sourceConfigured ? `${hubstaff.lowActivityCount || 0} low-activity rows under 50% activity` : 'Average activity and low-activity flags'],
    ['Attendance exceptions', isLoading ? 'Loading' : sourceConfigured ? 'Ready' : 'Awaiting source', sourceConfigured ? `${exceptions.length} exception rows in the published Exceptions tab` : 'Missed shifts, no time, or under-target hours'],
    ['Payroll rollup', isLoading ? 'Loading' : sourceConfigured ? 'Ready' : 'Awaiting source', sourceConfigured ? money(payrollEstimate) : 'Estimated payroll totals by employee or team'],
    ['Team utilization', isLoading ? 'Loading' : sourceConfigured ? 'Ready' : 'Awaiting source', sourceConfigured ? `${weeklyKpis.length} weekly KPI summary rows available` : 'Capacity view against expected staffing levels'],
  ].map((row) => `
    <tr>
      <td>${escapeHtml(row[0])}</td>
      <td>${badgeStatus(row[1])}</td>
      <td>${escapeHtml(row[2])}</td>
    </tr>
  `).join('');

  el.hubstaffNotes.innerHTML = [
    sourceConfigured
      ? `Live source: ${hubstaff.workbookUrl || 'Published Google Sheet'}`
      : 'If you already export Hubstaff into Google Sheets, I can add that sheet as another source in `sheets.js` and make this tab live with the same static-site architecture.',
    sourceConfigured
      ? `Rows imported from Raw_Import: ${hubstaff.rows.length}. Weekly KPI rows: ${weeklyKpis.length}. Exception rows: ${exceptions.length}.`
      : 'If you want direct Hubstaff API data, we should not embed private API credentials in this front-end. That would require a secure backend or serverless function.',
    sourceConfigured
      ? 'If names still look like Hubstaff IDs instead of real people, update the n8n transform to write readable employee and team names into the Google Sheet.'
      : 'If you want a fast first pass, send the Hubstaff export link or sample CSV headers and I can wire the tab to real metrics next.',
  ].map((line) => `<div class="note-card">${line}</div>`).join('');
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
      <strong>${row.value} ${escapeHtml(suffix)}</strong>
    </div>
  `).join('');
}

function priorityScore(priority) {
  if (priority === 'High') return 3;
  if (priority === 'Medium') return 2;
  return 1;
}

function initFilters() {
  fillSelect(el.stateFilter, 'All states', model.filterValues.states);
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
  renderExecutiveKpis();
  renderExecutiveInsights();
  renderWatchlist();
  renderOpsKpis();
  renderCriticalActions();
  renderOwnerAccountability();
  renderRevenueRisk();
  renderPatientFlow();
  renderSystemHealth();
  renderIssuesQueue();
  renderIntakeView();
  renderStaffView();
  renderHubstaffView();
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

  try {
    model = await OpsSheets.loadWorkbookData();
    initFilters();
    render();
    const liveCount = model.sourceMeta.filter((item) => item.source === 'live').length;
    const cacheCount = model.sourceMeta.filter((item) => item.source === 'cache').length;
    el.liveStatus.textContent = `● ${liveCount} live tabs · ${cacheCount} cached tabs · refreshed ${formatDate(model.loadedAt)}`;
  } catch (error) {
    console.error(error);
    el.liveStatus.textContent = '● Workbook load failed';
    el.issuesTable.innerHTML = '<tr><td colspan="8" class="empty-state">The workbook could not be loaded. Check the published sheet URL in sheets.js.</td></tr>';
    el.resultsSummary.textContent = 'Load error';
  }
}

bind();
renderViewNav();
loadData();
