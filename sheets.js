const OpsSheets = (() => {
  const WORKBOOK_PUBLISHED_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTUQ5bqosxRzkSWO_xPAp6EauqGTV01N0meOZekSRzW93Z3DbPGbU4xpFnrvAgH4QhQF5QZHi7wp1-r/pubhtml';
  const WORKBOOK_CSV_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTUQ5bqosxRzkSWO_xPAp6EauqGTV01N0meOZekSRzW93Z3DbPGbU4xpFnrvAgH4QhQF5QZHi7wp1-r/pub';
  const FETCH_TIMEOUT_MS = 10000;

  const TAB_CONFIG = [
    { id: 'candidatePool', label: 'Candidate Pool', sheetName: 'Sheet1', gid: '0' },
    { id: 'interviews', label: 'Interview Tracker', sheetName: 'Sheet3', gid: '516627695' },
    { id: 'finalHires', label: 'Final Sheet', sheetName: 'Final Sheet', gid: '1249804960' },
    { id: 'currentWorkforce', label: 'Current Workforce', sheetName: 'Current Work force', gid: '1575031700' },
    { id: 'resumePool', label: 'Resume Pool', sheetName: 'Resume Pool', gid: '624754739' },
    { id: 'newHiring', label: 'New Hiring', sheetName: 'New Hiring', gid: '1396856298' },
  ];

  function buildCsvUrl(gid) {
    return `${WORKBOOK_CSV_BASE}?gid=${gid}&single=true&output=csv`;
  }

  function parseCSVRow(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  function parseCSV(text) {
    const lines = String(text || '')
      .split('\n')
      .map((line) => line.replace(/\r$/, ''))
      .filter((line) => line.trim().length);

    if (!lines.length) return [];

    const headers = parseCSVRow(lines[0]).map((header) => header.trim());
    return lines.slice(1).map((line) => {
      const values = parseCSVRow(line);
      return headers.reduce((row, header, index) => {
        row[header] = (values[index] || '').trim();
        return row;
      }, {});
    });
  }

  function cleanText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function parseRate(value) {
    const match = String(value || '').match(/\$?\s*([0-9]+(?:\.[0-9]+)?)/);
    return match ? Number(match[1]) : null;
  }

  function uniq(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  }

  async function fetchCsvText(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}cachebust=${Date.now()}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.text();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function cacheKey(tabId) {
    return `opscenter-cache-${tabId}`;
  }

  async function loadTab(tab) {
    const csvUrl = buildCsvUrl(tab.gid);
    const meta = {
      id: tab.id,
      label: tab.label,
      sheetName: tab.sheetName,
      gid: tab.gid,
      csvUrl,
      source: 'live',
      ok: true,
      error: null,
      rowCount: 0,
    };

    try {
      const text = await fetchCsvText(csvUrl);
      const rows = parseCSV(text);
      localStorage.setItem(cacheKey(tab.id), JSON.stringify(rows));
      meta.rowCount = rows.length;
      return { rows, meta };
    } catch (error) {
      const cached = localStorage.getItem(cacheKey(tab.id));
      if (cached) {
        const rows = JSON.parse(cached);
        meta.source = 'cache';
        meta.ok = true;
        meta.error = cleanText(error.message || 'Unknown live fetch failure');
        meta.rowCount = rows.length;
        return { rows, meta };
      }

      meta.source = 'unavailable';
      meta.ok = false;
      meta.error = cleanText(error.message || 'Unable to load tab');
      return { rows: [], meta };
    }
  }

  function normalizeCandidatePoolRow(row) {
    return {
      name: cleanText(row.Name),
      address: cleanText(row.Address),
      contact: cleanText(row['Contact/Email']),
      title: cleanText(row.Title),
      comments: cleanText(row.Comments),
      stateLicense: cleanText(row['state license']),
      rawStatus: cleanText(row[''] || row.Status),
      source: 'Candidate Pool',
    };
  }

  function normalizeInterviewRow(row) {
    return {
      name: cleanText(row['Candidate Name']),
      position: cleanText(row.Position),
      state: cleanText(row.State),
      phase: cleanText(row['Interview phase']),
      scheduledTime: cleanText(row['Scheduled time']),
      dateLabel: cleanText(row.Date),
      date: parseDate(row.Date),
      status: cleanText(row.Status),
      notes: cleanText(row.Notes),
      source: 'Interview Tracker',
    };
  }

  function normalizeFinalHireRow(row) {
    return {
      serial: cleanText(row['SR.']),
      name: cleanText(row.Name),
      title: cleanText(row.Title),
      states: cleanText(row.States),
      workingHours: cleanText(row['Working Hours']),
      rateLabel: cleanText(row.Rate),
      rateValue: parseRate(row.Rate),
      comments: cleanText(row.Comments),
      source: 'Final Hires',
    };
  }

  function normalizeWorkforceRow(row) {
    return {
      providerName: cleanText(row['Provider Name']),
      futureLicense: cleanText(row['Future license']),
      licensedState: cleanText(row['Licensed state']),
      licenseNumber: cleanText(row['License Number']),
      specialty: cleanText(row.Speciality),
      contractType: cleanText(row['Contract Type']),
      source: 'Current Workforce',
    };
  }

  function normalizeResumePoolRow(row) {
    return {
      providerName: cleanText(row['Provider Name']),
      licensedState: cleanText(row['Licensed state']),
      licenseNumber: cleanText(row['License Number']),
      specialty: cleanText(row.Speciality),
      contractType: cleanText(row['Contract Type']),
      source: 'Resume Pool',
    };
  }

  function normalizeNewHiringRow(row) {
    return {
      name: cleanText(row['Candidate Name']),
      resume: cleanText(row.Resume),
      state: cleanText(row.State),
      specialty: cleanText(row.Specliality),
      ageGroup: cleanText(row['Age Group']),
      languages: cleanText(row.Languages),
      dea: cleanText(row.DEA),
      rateLabel: cleanText(row.Rate),
      rateValue: parseRate(row.Rate),
      totalExperience: cleanText(row['Total Exp']),
      hours: cleanText(row.Hours),
      interviewStatus: cleanText(row['Interview Status']),
      referralSource: cleanText(row['Referral Source']),
      credentialing: cleanText(row.Credentaling),
      source: 'New Hiring',
    };
  }

  function splitStates(value) {
    return uniq(
      cleanText(value)
        .replace(/\bONLY\b/g, '')
        .split(/[,/]| and |\s{2,}/i)
        .map((part) => cleanText(part.replace(/\(.*?\)/g, '')))
        .map((part) => part.replace(/\.$/, ''))
        .filter((part) => part.length && part.length <= 24)
    );
  }

  function deriveIssues(dataset, sourceMeta) {
    const issues = [];

    dataset.interviews.forEach((item) => {
      const status = item.status.toLowerCase();
      const phase = item.phase.toLowerCase();
      const overdue = item.date && item.date < new Date();

      if (status.includes('no show') || status.includes('waiting') || status.includes('later')) {
        issues.push({
          name: item.name,
          source: item.source,
          state: item.state || 'Unknown',
          owner: 'Talent Ops',
          status: item.status || 'Needs review',
          priority: status.includes('no show') ? 'High' : 'Medium',
          risk: status.includes('no show') ? 'Pipeline loss' : 'Stalled interview',
          detail: item.notes || item.phase || 'Follow up with candidate and recruiter.',
          timeline: item.dateLabel || 'No date',
        });
      } else if (phase.includes('final') && overdue) {
        issues.push({
          name: item.name,
          source: item.source,
          state: item.state || 'Unknown',
          owner: 'Talent Ops',
          status: item.status || 'Final interview',
          priority: 'Medium',
          risk: 'Decision lag',
          detail: item.notes || 'Final stage candidate is sitting without a closed decision.',
          timeline: item.dateLabel || 'Past due',
        });
      }
    });

    dataset.finalHires.forEach((item) => {
      const comments = item.comments.toLowerCase();
      if (comments.includes('need dea') || comments.includes('pending') || comments.includes('no contract yet') || comments.includes('ask if')) {
        issues.push({
          name: item.name,
          source: item.source,
          state: splitStates(item.states).join(', ') || 'Multi-state',
          owner: 'Credentialing',
          status: comments.includes('no contract yet') ? 'No contract yet' : 'Pending follow-up',
          priority: comments.includes('no contract yet') ? 'High' : 'Medium',
          risk: 'Delayed activation',
          detail: item.comments,
          timeline: item.workingHours || 'Open',
        });
      }
    });

    dataset.newHiring.forEach((item) => {
      const interviewStatus = item.interviewStatus.toLowerCase();
      const credentialing = item.credentialing.toLowerCase();
      if (!item.name) return;

      if (!item.dea || item.dea.toLowerCase() === 'no' || !item.credentialing || interviewStatus.includes('completed')) {
        issues.push({
          name: item.name,
          source: item.source,
          state: item.state || 'Unknown',
          owner: 'Recruiting',
          status: item.interviewStatus || 'Intake review',
          priority: !item.credentialing ? 'High' : 'Medium',
          risk: !item.dea || item.dea.toLowerCase() === 'no' ? 'Licensing gap' : 'Unclear intake handoff',
          detail: [item.credentialing, item.referralSource, item.rateLabel].filter(Boolean).join(' · ') || 'Missing intake details',
          timeline: item.hours || 'Open',
        });
      }
    });

    dataset.candidatePool.forEach((item) => {
      const comments = item.comments.toLowerCase();
      if (!item.name) return;
      if (comments.includes('denied') || comments.includes('will need supervision') || comments.includes('applied for license')) {
        issues.push({
          name: item.name,
          source: item.source,
          state: item.stateLicense || 'Unknown',
          owner: 'Recruiting',
          status: 'Candidate review',
          priority: comments.includes('denied') ? 'High' : 'Medium',
          risk: comments.includes('denied') ? 'Blocker' : 'Activation dependency',
          detail: item.comments,
          timeline: 'Current',
        });
      }
    });

    sourceMeta.forEach((item) => {
      if (!item.ok) {
        issues.push({
          name: item.label,
          source: 'System',
          state: 'N/A',
          owner: 'Data Ops',
          status: 'Unavailable',
          priority: 'High',
          risk: 'Source outage',
          detail: item.error || 'Tab is unavailable and no cache exists.',
          timeline: 'Immediate',
        });
      }
    });

    return issues;
  }

  function buildModel(rawTabs, sourceMeta) {
    const dataset = {
      candidatePool: rawTabs.candidatePool.map(normalizeCandidatePoolRow),
      interviews: rawTabs.interviews.map(normalizeInterviewRow),
      finalHires: rawTabs.finalHires.map(normalizeFinalHireRow),
      currentWorkforce: rawTabs.currentWorkforce.map(normalizeWorkforceRow),
      resumePool: rawTabs.resumePool.map(normalizeResumePoolRow),
      newHiring: rawTabs.newHiring.map(normalizeNewHiringRow),
    };

    const candidateNames = uniq([
      ...dataset.candidatePool.map((item) => item.name),
      ...dataset.interviews.map((item) => item.name),
      ...dataset.finalHires.map((item) => item.name),
      ...dataset.newHiring.map((item) => item.name),
    ]);

    const workforceStates = uniq(dataset.currentWorkforce.map((item) => item.licensedState));
    const openInterviewCount = dataset.interviews.filter((item) => !/done|selected/i.test(item.status)).length;
    const finalSignedCount = dataset.finalHires.length;
    const activeWorkforceCount = uniq(dataset.currentWorkforce.map((item) => item.providerName)).length;
    const referralSourceCount = dataset.newHiring.filter((item) => item.referralSource).length;
    const issues = deriveIssues(dataset, sourceMeta);

    return {
      loadedAt: new Date(),
      workbookUrl: WORKBOOK_PUBLISHED_URL,
      sourceMeta,
      hubstaff: {
        configured: false,
        source: 'not_configured',
        loadedAt: null,
        stale: true,
        staleReason: 'Hubstaff source has not been connected yet.',
        employeeCount: 0,
        trackedHours: 0,
        activityRate: 0,
        payrollEstimate: 0,
        rows: [],
      },
      dataset,
      issues,
      metrics: {
        totalCandidates: candidateNames.length,
        openInterviews: openInterviewCount,
        finalSigned: finalSignedCount,
        activeWorkforce: activeWorkforceCount,
        statesCovered: workforceStates.length,
        referralSourcesTracked: referralSourceCount,
        issueCount: issues.length,
      },
      filterValues: {
        states: uniq([
          ...dataset.interviews.map((item) => item.state),
          ...dataset.newHiring.map((item) => item.state),
          ...dataset.currentWorkforce.map((item) => item.licensedState),
        ]),
        specialties: uniq([
          ...dataset.currentWorkforce.map((item) => item.specialty),
          ...dataset.newHiring.map((item) => item.specialty),
          ...dataset.finalHires.map((item) => item.title),
          ...dataset.candidatePool.map((item) => item.title),
        ]),
        statuses: uniq([
          ...dataset.interviews.map((item) => item.status),
          ...issues.map((item) => item.status),
          ...dataset.newHiring.map((item) => item.interviewStatus),
        ]),
        sources: ['All sources', 'Candidate Pool', 'Interview Tracker', 'Final Hires', 'Current Workforce', 'Resume Pool', 'New Hiring', 'System'],
      },
    };
  }

  async function loadWorkbookData() {
    const results = await Promise.all(TAB_CONFIG.map(loadTab));
    const rawTabs = {};
    const sourceMeta = [];

    results.forEach(({ rows, meta }) => {
      rawTabs[meta.id] = rows;
      sourceMeta.push(meta);
    });

    return buildModel(rawTabs, sourceMeta);
  }

  return {
    TAB_CONFIG,
    WORKBOOK_PUBLISHED_URL,
    loadWorkbookData,
    utils: {
      cleanText,
      parseDate,
      parseRate,
      splitStates,
      uniq,
    },
  };
})();
