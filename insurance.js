const OpsInsurance = (() => {
  const csvUrl = './data/state_insurance_sample.csv';
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

  async function loadData() {
    const text = await fetchText(csvUrl);
    const parsed = parseCsv(text);
    if (!parsed.length) {
      return {
        loadedAt: new Date(),
        geojsonPath,
        rows: [],
        states: [],
        stateFips,
        validStates,
        validation: {
          validStateCount: 0,
          invalidRowCount: 0,
          invalidStateValues: [],
        },
      };
    }

    const headers = parsed[0].map((header) => String(header || '').trim());
    const normalizedRows = parsed.slice(1).map((cells) => {
      const row = {};
      headers.forEach((header, index) => {
        row[header] = cells[index] ?? '';
      });
      return normalizeRow(row);
    });

    const invalidRows = normalizedRows.filter((row) => !row.state);
    const dataRows = normalizedRows.filter((row) => row.state);

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
