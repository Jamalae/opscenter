const OpsInsurance = (() => {
  const csvUrl = './data/state_insurance_sample.csv';
  const cmsCsvUrl = './data/cms_medicare_advantage.csv';
  const contractedCsvUrl = './data/contracted_plans.csv';
  const geojsonPath = './data/insurance/geo/us-counties-fips.geojson';
  // The 29 states our company actually operates in. This is the single
  // source of truth for "valid" states throughout the insurance subsystem.
  const validStates = {
    AZ: 'Arizona',
    CA: 'California',
    CO: 'Colorado',
    CT: 'Connecticut',
    DC: 'District of Columbia',
    FL: 'Florida',
    GA: 'Georgia',
    IL: 'Illinois',
    IN: 'Indiana',
    KY: 'Kentucky',
    MA: 'Massachusetts',
    MD: 'Maryland',
    MI: 'Michigan',
    MN: 'Minnesota',
    MO: 'Missouri',
    NC: 'North Carolina',
    NM: 'New Mexico',
    NV: 'Nevada',
    NY: 'New York',
    OH: 'Ohio',
    OR: 'Oregon',
    PA: 'Pennsylvania',
    SC: 'South Carolina',
    TN: 'Tennessee',
    TX: 'Texas',
    UT: 'Utah',
    VA: 'Virginia',
    WA: 'Washington',
    WI: 'Wisconsin',
  };

  // 2-digit FIPS prefixes for the 29 company states. Used to filter the
  // county GeoJSON layer by state, since the CSV does not currently carry
  // per-row FIPS codes in `geographic_region`.
  const stateFips = {
    AZ: '04', CA: '06', CO: '08', CT: '09', DC: '11',
    FL: '12', GA: '13', IL: '17', IN: '18', KY: '21',
    MA: '25', MD: '24', MI: '26', MN: '27', MO: '29',
    NC: '37', NM: '35', NV: '32', NY: '36', OH: '39',
    OR: '41', PA: '42', SC: '45', TN: '47', TX: '48',
    UT: '49', VA: '51', WA: '53', WI: '55',
  };
  const requiredFields = [
    'state',
    'county',
    'program_type',
    'plan_name',
    'parent_org',
    'geographic_region',
    'medicaid_enrollment',
    'dual_enrollment',
    'total_enrollment',
    'source_url',
    'source_year',
    'notes',
  ];

  async function fetchText(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Insurance CSV fetch failed for ${url}: ${response.status}`);
    }
    return response.text();
  }

  function parseCsv(text) {
    const rows = [];
    let current = '';
    let row = [];
    let inQuotes = false;

    function pushCell() {
      row.push(current);
      current = '';
    }

    function pushRow() {
      if (row.length || current) {
        pushCell();
        rows.push(row);
      }
      row = [];
      current = '';
    }

    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      const next = text[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        pushCell();
      } else if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && next === '\n') i += 1;
        pushRow();
      } else {
        current += char;
      }
    }

    if (current || row.length) pushRow();
    return rows.filter((entry) => entry.some((cell) => String(cell || '').trim()));
  }

  function parseNumeric(value) {
    if (value === null || value === undefined || value === '') return null;
    const normalized = String(value).replace(/,/g, '').trim();
    if (!normalized) return null;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getCountyFips(row) {
    const match = String(row.geographic_region || '').match(/FIPS\s+(\d{5})/i);
    return match ? match[1] : '';
  }

  function normalizeStateValue(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const compact = raw.replace(/\s+/g, ' ').trim();
    const upper = compact.toUpperCase();
    if (/^[A-Z]{2}$/.test(upper) && validStates[upper]) {
      return upper;
    }
    return null;
  }

  function normalizeRow(row) {
    requiredFields.forEach((field) => {
      if (!(field in row)) {
        throw new Error(`Insurance CSV row is missing required field: ${field}`);
      }
    });

    return {
      raw_state: String(row.state || '').trim(),
      state: normalizeStateValue(row.state),
      county: String(row.county || '').trim(),
      program_type: String(row.program_type || '').trim(),
      plan_name: String(row.plan_name || '').trim(),
      parent_org: String(row.parent_org || '').trim(),
      geographic_region: String(row.geographic_region || '').trim(),
      medicaid_enrollment: parseNumeric(row.medicaid_enrollment),
      dual_enrollment: parseNumeric(row.dual_enrollment),
      total_enrollment: parseNumeric(row.total_enrollment) || 0,
      source_url: String(row.source_url || '').trim(),
      source_year: parseNumeric(row.source_year),
      notes: String(row.notes || '').trim(),
      county_fips: getCountyFips(row),
    };
  }

  function getLocationLabel(row) {
    return row.county || row.geographic_region || 'Unknown geography';
  }

  function buildStateSummary(rows) {
    const stateCode = rows[0]?.state || '';
    const stateGroups = {};

    rows.forEach((row) => {
      const locationLabel = getLocationLabel(row);
      const groupKey = row.county_fips || `${stateCode}-${locationLabel}`;
      if (!stateGroups[groupKey]) {
        stateGroups[groupKey] = {
          location_label: locationLabel,
          county: row.county,
          geographic_region: row.geographic_region,
          county_fips: row.county_fips,
          total_enrollment: 0,
          medicaid_enrollment: 0,
          dual_enrollment: 0,
          rows: [],
          source_years: new Set(),
          source_urls: new Set(),
          plan_names: new Set(),
          parent_orgs: new Set(),
        };
      }

      const group = stateGroups[groupKey];
      group.total_enrollment += row.total_enrollment || 0;
      group.medicaid_enrollment += row.medicaid_enrollment || 0;
      group.dual_enrollment += row.dual_enrollment || 0;
      // Marketing-priority aggregates: sum the enrollment of rows we're
      // contracted with so the map can color counties by addressable %.
      if (row.in_network) {
        group.in_network_enrollment = (group.in_network_enrollment || 0) + (row.total_enrollment || 0);
        if (row.parent_org) group.in_network_parent_orgs = (group.in_network_parent_orgs || new Set()).add(row.parent_org);
        if (row.plan_name) group.in_network_plan_names = (group.in_network_plan_names || new Set()).add(row.plan_name);
      } else {
        group.out_of_network_enrollment = (group.out_of_network_enrollment || 0) + (row.total_enrollment || 0);
        if (row.parent_org) group.out_of_network_parent_orgs = (group.out_of_network_parent_orgs || new Set()).add(row.parent_org);
      }
      group.rows.push(row);
      if (row.source_year) group.source_years.add(row.source_year);
      if (row.source_url) group.source_urls.add(row.source_url);
      if (row.plan_name) group.plan_names.add(row.plan_name);
      if (row.parent_org) group.parent_orgs.add(row.parent_org);
    });

    const locations = Object.values(stateGroups)
      .map((group) => ({
        location_label: group.location_label,
        county: group.county,
        geographic_region: group.geographic_region,
        county_fips: group.county_fips,
        total_enrollment: group.total_enrollment,
        medicaid_enrollment: group.medicaid_enrollment,
        dual_enrollment: group.dual_enrollment,
        in_network_enrollment: group.in_network_enrollment || 0,
        out_of_network_enrollment: group.out_of_network_enrollment || 0,
        in_network_share: group.total_enrollment > 0
          ? (group.in_network_enrollment || 0) / group.total_enrollment
          : 0,
        in_network_parent_orgs: Array.from(group.in_network_parent_orgs || []).sort(),
        out_of_network_parent_orgs: Array.from(group.out_of_network_parent_orgs || []).sort(),
        in_network_plan_names: Array.from(group.in_network_plan_names || []).sort(),
        row_count: group.rows.length,
        plan_names: Array.from(group.plan_names).sort(),
        parent_orgs: Array.from(group.parent_orgs).sort(),
        source_years: Array.from(group.source_years).sort(),
        source_urls: Array.from(group.source_urls).sort(),
        rows: group.rows,
      }))
      .sort((a, b) => b.total_enrollment - a.total_enrollment || a.location_label.localeCompare(b.location_label));

    // Use the curated US-state name map. Intl.DisplayNames({type:'region'}) is
    // a *country* lookup, so it would turn AZ → Azerbaijan, GA → Georgia
    // (country), IN → India, CO → Colombia, etc.
    const stateName = validStates[stateCode] || stateCode;
    return {
      state: stateCode,
      label: stateName,
      rows,
      locations,
      total_enrollment: locations.reduce((sum, location) => sum + location.total_enrollment, 0),
      source_years: Array.from(new Set(rows.map((row) => row.source_year).filter(Boolean))).sort(),
      source_urls: Array.from(new Set(rows.map((row) => row.source_url).filter(Boolean))).sort(),
      notes: Array.from(new Set(rows.map((row) => row.notes).filter(Boolean))),
      plan_count: rows.filter((row) => row.plan_name).length,
      parent_org_count: new Set(rows.map((row) => row.parent_org).filter(Boolean)).size,
    };
  }

  // ── Contracted plans ───────────────────────────────────────────────────
  // Reads data/contracted_plans.csv. Each row is (parent_org, plan_name,
  // status, notes). status of "in-network" means we accept rows from this
  // plan/parent for marketing-priority calculations. plan_name blank means
  // the rule applies to every plan from the parent_org.
  async function loadContractedPlans() {
    let text;
    try {
      text = await fetchText(contractedCsvUrl);
    } catch (error) {
      // File missing or unreachable — treat as no contracts configured.
      return { rows: [], inNetworkLookup: () => false };
    }
    const parsed = parseCsv(text);
    if (!parsed.length) {
      return { rows: [], inNetworkLookup: () => false };
    }
    const headers = parsed[0].map((h) => String(h || '').trim().toLowerCase());
    const rows = parsed.slice(1).map((cells) => {
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
      return {
        parent_org: String(row.parent_org || '').trim(),
        plan_name: String(row.plan_name || '').trim(),
        status: String(row.status || '').trim().toLowerCase(),
        state: String(row.state || '').trim().toUpperCase(),
        notes: String(row.notes || '').trim(),
      };
    });

    // Normalize org names so "Centene" matches "Centene Corporation",
    // "UnitedHealth Group" matches "UnitedHealth Group, Inc.", and
    // "Aetna (CVS Health)" matches "Aetna Inc." — strip parens, common
    // legal suffixes, and non-alphanumerics, then lowercase.
    function compactName(s) {
      return String(s || '').toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/\b(inc|incorporated|llc|corp|corporation|co|company|the|of|p\.?c\.?|holdings?|group|insurance|health\s+plans?|holding)\b/g, ' ')
        .replace(/[^a-z0-9]/g, '');
    }

    // Pre-compute compact form for each in-network rule. We index by state
    // (or 'GLOBAL' for nationwide rules) so per-row lookups stay fast.
    const stateRules = {};      // state → [{ parent, plan }]
    const globalRules = [];     // [{ parent, plan }]
    rows.forEach((row) => {
      if (row.status !== 'in-network') return;
      const rule = {
        parent: compactName(row.parent_org),
        plan: compactName(row.plan_name),
      };
      if (!rule.parent) return;
      if (row.state) {
        (stateRules[row.state] = stateRules[row.state] || []).push(rule);
      } else {
        globalRules.push(rule);
      }
    });

    function ruleMatches(rule, p, n) {
      // parent must align — prefix-or-substring on the compact form.
      if (rule.parent !== p && !p.includes(rule.parent) && !rule.parent.includes(p)) return false;
      // plan-level rules also require plan match (ditto fuzzy).
      if (rule.plan && rule.plan !== n && !n.includes(rule.plan) && !rule.plan.includes(n)) return false;
      return true;
    }

    function inNetworkLookup(parentOrg, planName, stateCode) {
      const p = compactName(parentOrg);
      const n = compactName(planName);
      const s = String(stateCode || '').trim().toUpperCase();
      if (!p) return false;
      const candidates = (s && stateRules[s] ? stateRules[s] : []).concat(globalRules);
      for (let i = 0; i < candidates.length; i++) {
        if (ruleMatches(candidates[i], p, n)) return true;
      }
      return false;
    }

    return { rows, inNetworkLookup };
  }

  // Helper: fetch + parse one CSV that follows the master schema. Returns
  // an array of normalized row objects. Missing files are tolerated.
  async function loadMasterCsv(url) {
    let text;
    try { text = await fetchText(url); }
    catch (e) { return { rows: [], invalid: [], error: e.message }; }
    const parsed = parseCsv(text);
    if (!parsed.length) return { rows: [], invalid: [] };
    const headers = parsed[0].map((h) => String(h || '').trim());
    const rows = parsed.slice(1).map((cells) => {
      const row = {};
      headers.forEach((h, i) => { row[h] = cells[i] ?? ''; });
      return normalizeRow(row);
    });
    return {
      rows: rows.filter((r) => r.state),
      invalid: rows.filter((r) => !r.state),
    };
  }

  async function loadData() {
    const [primary, cms, contracted] = await Promise.all([
      loadMasterCsv(csvUrl),
      loadMasterCsv(cmsCsvUrl),
      loadContractedPlans(),
    ]);

    // Combine: primary (Medicaid MCO) + CMS (Medicare Advantage). Both
    // share the master schema. Each row gets in_network annotated against
    // the contracted_plans rules, scoped by state.
    const allRows = [...primary.rows, ...cms.rows];
    const invalidRows = [...primary.invalid, ...cms.invalid];
    if (!allRows.length) {
      return {
        loadedAt: new Date(),
        geojsonPath,
        rows: [],
        states: [],
        stateFips,
        validStates,
        contractedPlans: contracted.rows,
        validation: {
          validStateCount: 0,
          invalidRowCount: invalidRows.length,
          invalidStateValues: [],
        },
      };
    }
    const dataRows = allRows.map((norm) => {
      norm.in_network = contracted.inNetworkLookup(norm.parent_org, norm.plan_name, norm.state);
      return norm;
    });

    const grouped = dataRows.reduce((acc, row) => {
      if (!row.state) return acc;
      if (!acc[row.state]) acc[row.state] = [];
      acc[row.state].push(row);
      return acc;
    }, {});

    const states = Object.keys(grouped)
      .sort()
      .map((stateCode) => buildStateSummary(grouped[stateCode]));

    return {
      loadedAt: new Date(),
      geojsonPath,
      rows: dataRows,
      states,
      stateFips,
      validStates,
      contractedPlans: contracted.rows,
      validation: {
        validStateCount: states.length,
        invalidRowCount: invalidRows.length,
        invalidStateValues: Array.from(new Set(
          invalidRows
            .map((row) => row.raw_state)
            .filter(Boolean)
        )).sort(),
      },
    };
  }

  return {
    loadData,
    stateFips,
    validStates,
  };
})();
