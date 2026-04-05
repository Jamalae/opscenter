const OpsDataLayer = (() => {
  const TODAY = new Date('2026-04-05T12:00:00');
  TODAY.setHours(0, 0, 0, 0);

  const DATA_SOURCES = {
    masterCases: './data/master_cases.csv',
    referrals: './data/referrals.csv',
    claims: './data/claims.csv',
    tasks: './data/tasks.csv',
    denials: './data/denials.csv',
  };

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
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  function parseCSV(text) {
    const lines = text
      .split('\n')
      .map((line) => line.replace(/\r$/, ''))
      .filter((line) => line.trim());

    if (!lines.length) {
      return [];
    }

    const headers = parseCSVRow(lines[0]).map((header) => header.trim());
    return lines.slice(1).map((line) => {
      const row = parseCSVRow(line);
      return headers.reduce((acc, header, index) => {
        acc[header] = (row[index] || '').trim();
        return acc;
      }, {});
    });
  }

  async function loadCsv(path) {
    const response = await fetch(`${path}?cachebust=${Date.now()}`);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: HTTP ${response.status}`);
    }
    return parseCSV(await response.text());
  }

  function safeDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function daysBetween(start, end) {
    if (!start || !end) return null;
    return Math.floor((end - start) / 86400000);
  }

  function sum(values) {
    return values.reduce((total, value) => total + value, 0);
  }

  function mapBy(list, key) {
    return list.reduce((acc, item) => {
      const value = item[key];
      if (!value) return acc;
      if (!acc[value]) acc[value] = [];
      acc[value].push(item);
      return acc;
    }, {});
  }

  function referralKey(row) {
    return [row.patient_name, row.state, row.payer].map((part) => (part || '').toLowerCase()).join('|');
  }

  function normalizeMasterCase(row, related) {
    const submittedDate = safeDate(row.date_submitted);
    const lastActivityDate = safeDate(row.last_activity_date);
    const nextActionDate = safeDate(row.next_action_date);
    const caseClaims = related.claims || [];
    const caseTasks = related.tasks || [];
    const caseDenials = related.denials || [];
    const referral = related.referral || null;

    const pendingClaims = caseClaims.filter((claim) => claim.status !== 'Approved');
    const overdueTasks = caseTasks.filter((task) => task.status === 'Overdue');
    const openTasks = caseTasks.filter((task) => task.status !== 'Completed');
    const nextTaskDate = openTasks
      .map((task) => safeDate(task.due_date))
      .filter(Boolean)
      .sort((a, b) => a - b)[0] || null;
    const followUpDate = nextActionDate || nextTaskDate;
    const missingFields = [
      ['patient_name', row.patient_name],
      ['state', row.state],
      ['payer', row.payer],
      ['provider', row.provider],
      ['owner', row.owner],
      ['priority', row.priority],
      ['next_action_date', row.next_action_date],
    ]
      .filter(([, value]) => !value)
      .map(([field]) => field);

    const daysOpen = daysBetween(submittedDate, TODAY) ?? 0;
    const daysSinceActivity = daysBetween(lastActivityDate, TODAY);
    const isOverdue = !!followUpDate && followUpDate < TODAY;
    const isStale = daysSinceActivity !== null && daysSinceActivity >= 7;
    const isBlocked = row.status === 'Denied' || overdueTasks.length > 0 || caseDenials.length > 0;
    const isHighPriority = row.priority === 'High';
    const attentionReasons = [];

    if (isOverdue) attentionReasons.push('Overdue follow-up');
    if (isStale) attentionReasons.push('Stale case');
    if (isBlocked && isHighPriority) attentionReasons.push('Blocked high-priority');
    else if (isBlocked) attentionReasons.push('Blocked');
    if (missingFields.length) attentionReasons.push('Missing required fields');

    return {
      caseId: row.case_id,
      patientName: row.patient_name || 'Unknown patient',
      dob: row.dob,
      state: row.state || '—',
      payer: row.payer || 'Unknown',
      provider: row.provider || 'Unassigned',
      diagnosis: row.diagnosis || '',
      dateSubmitted: submittedDate,
      rawStatus: row.status || 'Pending',
      tierStatus: row.tier_status || 'None',
      owner: row.owner || 'Unassigned',
      priority: row.priority || 'Medium',
      lastActivityDate,
      nextActionDate,
      notes: row.notes || '',
      daysOpen,
      daysSinceActivity,
      followUpDate,
      followUpLabel: !followUpDate ? 'No follow-up' : (isOverdue ? 'Overdue' : row.next_action_date || openTasks[0]?.due_date || 'Scheduled'),
      claims: caseClaims,
      tasks: caseTasks,
      denials: caseDenials,
      referral,
      missingFields,
      attentionReasons,
      isOverdue,
      isStale,
      isBlocked,
      openTaskCount: openTasks.length,
      overdueTaskCount: overdueTasks.length,
      pendingClaimAmount: sum(pendingClaims.map((claim) => Number(claim.amount) || 0)),
      claimCount: caseClaims.length,
      denialCount: caseDenials.length,
      referralStatus: referral?.status || 'No referral record',
      referralDate: safeDate(referral?.referral_date),
    };
  }

  function buildMetrics(cases, referrals, claims, tasks) {
    const openCases = cases.filter((item) => item.rawStatus !== 'Approved');
    const approvedCases = cases.filter((item) => item.rawStatus === 'Approved');
    const deniedCases = cases.filter((item) => item.rawStatus === 'Denied' || item.denialCount > 0);
    const overdueCases = cases.filter((item) => item.isOverdue || item.overdueTaskCount > 0);
    const attentionCases = cases.filter((item) => item.attentionReasons.length);
    const referralConverted = referrals.filter((item) => item.status === 'Converted').length;
    const approvalRate = cases.length ? (approvedCases.length / cases.length) * 100 : 0;
    const conversionRate = referrals.length ? (referralConverted / referrals.length) * 100 : 0;
    const claimExposure = claims
      .filter((claim) => claim.status !== 'Approved')
      .reduce((total, claim) => total + (Number(claim.amount) || 0), 0);
    const openTasks = tasks.filter((task) => task.status !== 'Completed');

    return {
      cards: [
        { id: 'openCases', label: 'Open Cases', value: openCases.length, tone: 'accent' },
        { id: 'overdue', label: 'Overdue Follow-ups', value: overdueCases.length, tone: 'bad' },
        { id: 'denied', label: 'Denied / Blocked', value: deniedCases.length, tone: 'bad' },
        { id: 'claimExposure', label: 'Pending Claims $', value: claimExposure, tone: 'warn', format: 'currency' },
        { id: 'approvalRate', label: 'Approval Rate', value: approvalRate, tone: 'good', format: 'percent' },
        { id: 'referralConversion', label: 'Referral Conversion', value: conversionRate, tone: 'good', format: 'percent' },
      ],
      totals: {
        cases: cases.length,
        approved: approvedCases.length,
        referrals: referrals.length,
        convertedReferrals: referralConverted,
        claims: claims.length,
        openTasks: openTasks.length,
        attentionCases: attentionCases.length,
      },
    };
  }

  function buildSummaryRows(cases, claims, referrals, tasks) {
    const payerSummary = Object.values(
      cases.reduce((acc, item) => {
        if (!acc[item.payer]) {
          acc[item.payer] = { payer: item.payer, cases: 0, openCases: 0, overdue: 0, pendingClaimAmount: 0 };
        }
        acc[item.payer].cases += 1;
        acc[item.payer].openCases += item.rawStatus === 'Approved' ? 0 : 1;
        acc[item.payer].overdue += item.isOverdue ? 1 : 0;
        acc[item.payer].pendingClaimAmount += item.pendingClaimAmount;
        return acc;
      }, {})
    ).sort((a, b) => (b.openCases + b.pendingClaimAmount) - (a.openCases + a.pendingClaimAmount));

    const ownerSummary = Object.values(
      cases.reduce((acc, item) => {
        if (!acc[item.owner]) {
          acc[item.owner] = { owner: item.owner, open: 0, overdue: 0, totalCases: 0, stale: 0, highPriority: 0 };
        }
        acc[item.owner].open += item.rawStatus === 'Approved' ? 0 : 1;
        acc[item.owner].overdue += item.isOverdue ? 1 : 0;
        acc[item.owner].totalCases += 1;
        acc[item.owner].stale += item.isStale ? 1 : 0;
        acc[item.owner].highPriority += item.priority === 'High' ? 1 : 0;
        return acc;
      }, {})
    ).sort((a, b) => (b.overdue + b.highPriority) - (a.overdue + a.highPriority));

    const referralSummary = {
      totalReferrals: referrals.length,
      pendingReferrals: referrals.filter((item) => item.status === 'Pending').length,
      convertedReferrals: referrals.filter((item) => item.status === 'Converted').length,
      activeCases: cases.filter((item) => item.rawStatus !== 'Approved').length,
      pendingClaims: claims.filter((item) => item.status !== 'Approved').length,
      openTasks: tasks.filter((item) => item.status !== 'Completed').length,
    };

    return { payerSummary, ownerSummary, referralSummary };
  }

  function buildHealth(cases, claims, tasks, denials) {
    const missingNextAction = cases.filter((item) => item.missingFields.includes('next_action_date')).length;
    const staleCases = cases.filter((item) => item.isStale).length;
    const overdueTasks = tasks.filter((task) => task.status === 'Overdue').length;
    const deniedClaims = claims.filter((claim) => claim.status === 'Denied').length;

    return [
      {
        name: 'Task Queue',
        severity: overdueTasks ? 'Needs attention' : 'Healthy',
        note: `${overdueTasks} overdue tasks across ${cases.filter((item) => item.overdueTaskCount).length} cases`,
        owner: 'Case owners',
      },
      {
        name: 'Data Completeness',
        severity: missingNextAction ? 'Warning' : 'Healthy',
        note: `${missingNextAction} cases are missing required next action dates`,
        owner: 'Ops',
      },
      {
        name: 'Case Freshness',
        severity: staleCases ? 'Warning' : 'Healthy',
        note: `${staleCases} cases have been quiet for 7+ days`,
        owner: 'Owners',
      },
      {
        name: 'Denials Signal',
        severity: denials.length || deniedClaims ? 'Needs attention' : 'Healthy',
        note: `${denials.length} denial records and ${deniedClaims} denied claims need review`,
        owner: 'Claims team',
      },
    ];
  }

  function buildAttention(cases) {
    return cases
      .filter((item) => item.attentionReasons.length)
      .sort((a, b) => {
        const scoreA = (a.isOverdue ? 3 : 0) + (a.isBlocked ? 3 : 0) + (a.isStale ? 2 : 0) + (a.priority === 'High' ? 2 : 0) + a.missingFields.length;
        const scoreB = (b.isOverdue ? 3 : 0) + (b.isBlocked ? 3 : 0) + (b.isStale ? 2 : 0) + (b.priority === 'High' ? 2 : 0) + b.missingFields.length;
        return scoreB - scoreA || b.daysOpen - a.daysOpen;
      })
      .slice(0, 8);
  }

  function buildModel(payload) {
    const claimsByCase = mapBy(payload.claims, 'case_id');
    const tasksByCase = mapBy(payload.tasks, 'case_id');
    const denialsByCase = mapBy(payload.denials, 'case_id');
    const referralsByKey = payload.referrals.reduce((acc, item) => {
      acc[referralKey(item)] = item;
      return acc;
    }, {});

    const cases = payload.masterCases.map((item) => normalizeMasterCase(item, {
      claims: claimsByCase[item.case_id],
      tasks: tasksByCase[item.case_id],
      denials: denialsByCase[item.case_id],
      referral: referralsByKey[referralKey(item)],
    }));

    return {
      loadedAt: TODAY,
      cases,
      referrals: payload.referrals,
      claims: payload.claims,
      tasks: payload.tasks,
      denials: payload.denials,
      attention: buildAttention(cases),
      metrics: buildMetrics(cases, payload.referrals, payload.claims, payload.tasks),
      summary: buildSummaryRows(cases, payload.claims, payload.referrals, payload.tasks),
      systemHealth: buildHealth(cases, payload.claims, payload.tasks, payload.denials),
      mappings: [
        'master_cases.case_id is the primary case key.',
        'claims.case_id, tasks.case_id, and denials.case_id link directly to master cases.',
        'referrals do not include case_id, so referral records are matched by patient_name + state + payer.',
      ],
      gaps: [
        'No direct case_id in referrals, so duplicate patients with the same payer/state could create ambiguous matches later.',
        'Missing-field detection is limited to CSV columns present today and does not infer outside business rules.',
        'No explicit close date or claim follow-up owner is present, so age and accountability use submission/activity/task dates.',
      ],
    };
  }

  async function loadOperationalData() {
    const [masterCases, referrals, claims, tasks, denials] = await Promise.all([
      loadCsv(DATA_SOURCES.masterCases),
      loadCsv(DATA_SOURCES.referrals),
      loadCsv(DATA_SOURCES.claims),
      loadCsv(DATA_SOURCES.tasks),
      loadCsv(DATA_SOURCES.denials),
    ]);

    return buildModel({ masterCases, referrals, claims, tasks, denials });
  }

  return {
    loadOperationalData,
  };
})();
