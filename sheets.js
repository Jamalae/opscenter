const OpsSheets = (() => {
  const WORKBOOK_PUBLISHED_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTUQ5bqosxRzkSWO_xPAp6EauqGTV01N0meOZekSRzW93Z3DbPGbU4xpFnrvAgH4QhQF5QZHi7wp1-r/pubhtml';
  const WORKBOOK_CSV_BASE = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTUQ5bqosxRzkSWO_xPAp6EauqGTV01N0meOZekSRzW93Z3DbPGbU4xpFnrvAgH4QhQF5QZHi7wp1-r/pub';
  const HUBSTAFF_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS_vAhUif2Bnpaq9VoMpMppGyxXVbKmU7uKI8pUL7UIrOsjfQ2n3hQ-qt_m__6SI1z_2bHh3tR692vz/pub?gid=861294478&single=true&output=csv';
  const FETCH_TIMEOUT_MS = 10000;

  const TAB_CONFIG = [
    { id: 'candidatePool', label: 'Candidate Pool', sheetName: 'Sheet1', gid: '0' },
    { id: 'interviews', label: 'Interview Tracker', sheetName: 'LinkedIn Hiring', gid: '516627695', localCsv: './data/linkedin-hiring.csv' },
    { id: 'finalHires', label: 'Final Sheet', sheetName: 'Final Sheet', gid: '1249804960' },
    { id: 'currentWorkforce', label: 'Current Workforce', sheetName: 'Current Work force', gid: '1575031700' },
    { id: 'resumePool', label: 'Resume Pool', sheetName: 'Resume Pool', gid: '624754739' },
    { id: 'newHiring', label: 'New Hiring', sheetName: 'New Hiring', gid: '1396856298' },
  ];

  function buildCsvUrl(gid, csvBase = WORKBOOK_CSV_BASE) {
    return `${csvBase}?gid=${gid}&single=true&output=csv`;
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

  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i+1];
      if (inQ) {
        if (c === '"' && n === '"') { cell += '"'; i++; }
        else if (c === '"') { inQ = false; }
        else { cell += c; }
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\r') {}
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += c;
      }
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  async function fetchCsv(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}cachebust=${Date.now()}`, {
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      const matrix = parseCsv(text);
      if (!matrix.length) return [];
      const headers = matrix[0].map(h => String(h || '').trim());
      return matrix.slice(1)
        .filter(r => r && r.some(c => c && String(c).trim()))
        .map(r => {
          const obj = {};
          headers.forEach((h, i) => { obj[h] = r[i] != null ? r[i] : ''; });
          return obj;
        });
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function fetchJson(url) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}cachebust=${Date.now()}`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function cacheKey(tabId) {
    return `opscenter-cache-${tabId}`;
  }

  async function loadTab(tab) {
    const isLocal = Boolean(tab.localCsv);
    const csvUrl = isLocal ? tab.localCsv : buildCsvUrl(tab.gid, tab.csvBase);
    const meta = {
      id: tab.id,
      label: tab.label,
      sheetName: tab.sheetName,
      gid: tab.gid,
      csvUrl,
      source: isLocal ? 'local' : 'live',
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
      position: cleanText(row.Position || row['Job Title']),
      state: cleanText(row.State || row['Licensed state']),
      phase: cleanText(row['Interview phase'] || row.Status),
      scheduledTime: cleanText(row['Scheduled time'] || row['Interview Date']),
      dateLabel: cleanText(row.Date || row['Interview Date']),
      date: parseDate(row.Date || row['Interview Date']),
      status: cleanText(row.Status),
      notes: cleanText(row.Notes || row.Comments),
      licenseType: cleanText(row['License Type']),
      resume: cleanText(row.Resume),
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
      // Optional: add a "License Expiration" column to the Current Workforce
      // sheet (date format YYYY-MM-DD or MM/DD/YYYY). When populated, the
      // alerts panel in Staff Metrics will surface licenses expiring within
      // 30/60/90 days. Missing values are silently tolerated.
      licenseExpirationLabel: cleanText(row['License Expiration'] || row['License Expiry'] || row['Expiration']),
      licenseExpiration: parseDate(row['License Expiration'] || row['License Expiry'] || row['Expiration']),
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

  function normalizeHubstaffRawRow(row) {
    return {
      employeeName: cleanText(row.employee_name),
      teamName: cleanText(row.team_name),
      dateLabel: cleanText(row.date),
      date: parseDate(row.date),
      trackedHours: Number(row.tracked_hours || 0),
      activityPercent: Number(row.activity_percent || 0),
      payRate: Number(row.pay_rate || 0),
      payrollEstimate: Number(row.payroll_estimate || 0),
      attendanceStatus: cleanText(row.attendance_status) || 'No flag',
      sourceUpdatedAt: parseDate(row.source_updated_at),
      sourceUpdatedAtLabel: cleanText(row.source_updated_at),
    };
  }

  function hubstaffJsonConfigured() {
    return HUBSTAFF_CSV_URL && !/[<>]/.test(HUBSTAFF_CSV_URL);
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

  function buildHubstaffModel(rawRows, sourceState = 'live', sourceError = '') {
    const rows = (rawRows || [])
      .filter((row) => row.employee_name || row.team_name || row.tracked_hours)
      .map(normalizeHubstaffRawRow);

    const employeeCount = uniq(rows.map((row) => row.employeeName)).length;
    const trackedHours = rows.reduce((sum, row) => sum + row.trackedHours, 0);
    const payrollEstimate = rows.reduce((sum, row) => sum + row.payrollEstimate, 0);
    const activityRows = rows.filter((row) => Number.isFinite(row.activityPercent));
    const activityRate = activityRows.length
      ? activityRows.reduce((sum, row) => sum + row.activityPercent, 0) / activityRows.length
      : 0;
    const latestUpdate = rows
      .map((row) => row.sourceUpdatedAt)
      .filter(Boolean)
      .sort((a, b) => a - b)
      .pop() || null;
    const staleThresholdMs = 24 * 60 * 60 * 1000;
    const stale = !latestUpdate || (Date.now() - latestUpdate.getTime()) > staleThresholdMs;
    const attendanceIssues = rows.filter((row) => row.attendanceStatus && row.attendanceStatus !== 'No flag').length;
    const topEmployees = Object.values(rows.reduce((acc, row) => {
      const key = row.employeeName || 'Unknown';
      if (!acc[key]) {
        acc[key] = {
          employeeName: key,
          trackedHours: 0,
          payrollEstimate: 0,
          activityTotal: 0,
          activityCount: 0,
        };
      }
      acc[key].trackedHours += row.trackedHours;
      acc[key].payrollEstimate += row.payrollEstimate;
      acc[key].activityTotal += row.activityPercent;
      acc[key].activityCount += 1;
      return acc;
    }, {}))
      .map((row) => ({
        employeeName: row.employeeName,
        trackedHours: row.trackedHours,
        payrollEstimate: row.payrollEstimate,
        activityPercent: row.activityCount ? row.activityTotal / row.activityCount : 0,
      }))
      .sort((a, b) => b.trackedHours - a.trackedHours)
      .slice(0, 5);

    return {
      configured: hubstaffJsonConfigured(),
      source: sourceState,
      sourceUrl: HUBSTAFF_CSV_URL,
      sourceError,
      loadedAt: latestUpdate,
      stale,
      staleReason: stale
        ? (latestUpdate
          ? 'Hubstaff snapshot is older than 24 hours.'
          : 'Hubstaff rows are missing a usable source_updated_at timestamp.')
        : '',
      employeeCount,
      trackedHours,
      activityRate,
      payrollEstimate,
      attendanceIssues,
      rows,
      topEmployees,
    };
  }

  function buildModel(rawTabs, sourceMeta, hubstaffModel) {
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
      hubstaff: hubstaffModel,
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
    const primaryResults = await Promise.all(TAB_CONFIG.map(loadTab));
    const rawTabs = {};
    const sourceMeta = [];

    primaryResults.forEach(({ rows, meta }) => {
      rawTabs[meta.id] = rows;
      sourceMeta.push(meta);
    });

    let hubstaffModel;
    if (!hubstaffJsonConfigured()) {
      hubstaffModel = {
        configured: false,
        source: 'not_configured',
        sourceUrl: HUBSTAFF_CSV_URL,
        sourceError: '',
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
    } else {
      try {
        const rows = await fetchCsv(HUBSTAFF_CSV_URL);
        hubstaffModel = buildHubstaffModel(rows, 'live', '');
      } catch (error) {
        hubstaffModel = {
          configured: true,
          source: 'unavailable',
          sourceUrl: HUBSTAFF_CSV_URL,
          sourceError: cleanText(error.message || 'Unable to load Hubstaff CSV'),
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
      }
    }

    return buildModel(rawTabs, sourceMeta, hubstaffModel);
  }

  return {
    TAB_CONFIG,
    HUBSTAFF_CSV_URL,
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
