const OpsInsurance = (() => {
  const manifestUrl = './data/insurance/state-manifest.json';
  const rowsUrl = './data/insurance/verified-plan-rows.json';
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

  async function fetchJson(url) {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Insurance data fetch failed for ${url}: ${response.status}`);
    }
    return response.json();
  }

  function parseNumeric(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function getCountyFips(row) {
    const match = String(row.geographic_region || '').match(/FIPS\s+(\d{5})/i);
    return match ? match[1] : '';
  }

  function normalizeRow(row) {
    requiredFields.forEach((field) => {
      if (!(field in row)) {
        throw new Error(`Insurance row is missing required field: ${field}`);
      }
    });

    return {
      state: String(row.state || '').trim(),
      county: String(row.county || '').trim(),
      program_type: String(row.program_type || '').trim(),
      plan_name: String(row.plan_name || '').trim(),
      parent_org: String(row.parent_org || '').trim(),
      geographic_region: String(row.geographic_region || '').trim(),
      medicaid_enrollment: parseNumeric(row.medicaid_enrollment),
      dual_enrollment: parseNumeric(row.dual_enrollment),
      total_enrollment: Number(row.total_enrollment || 0),
      source_url: String(row.source_url || '').trim(),
      source_year: Number(row.source_year || 0),
      notes: String(row.notes || '').trim(),
      county_fips: getCountyFips(row),
    };
  }

  function buildStateSummary(definition, rows) {
    const counties = {};

    rows.forEach((row) => {
      const countyKey = row.county_fips || `${definition.state}-${row.county}`;
      if (!counties[countyKey]) {
        counties[countyKey] = {
          county: row.county,
          county_fips: row.county_fips,
          total_enrollment: 0,
          medicaid_enrollment: 0,
          dual_enrollment: 0,
          plan_count: 0,
          parent_orgs: new Set(),
          program_types: new Set(),
          source_years: new Set(),
          source_urls: new Set(),
        };
      }

      counties[countyKey].total_enrollment += row.total_enrollment || 0;
      counties[countyKey].medicaid_enrollment += row.medicaid_enrollment || 0;
      counties[countyKey].dual_enrollment += row.dual_enrollment || 0;
      counties[countyKey].plan_count += 1;
      counties[countyKey].parent_orgs.add(row.parent_org);
      counties[countyKey].program_types.add(row.program_type);
      counties[countyKey].source_years.add(row.source_year);
      counties[countyKey].source_urls.add(row.source_url);
    });

    const countyList = Object.values(counties)
      .map((county) => ({
        county: county.county,
        county_fips: county.county_fips,
        total_enrollment: county.total_enrollment,
        medicaid_enrollment: county.medicaid_enrollment,
        dual_enrollment: county.dual_enrollment,
        plan_count: county.plan_count,
        parent_org_count: county.parent_orgs.size,
        program_type_count: county.program_types.size,
        source_years: Array.from(county.source_years).sort(),
        source_urls: Array.from(county.source_urls).sort(),
      }))
      .sort((a, b) => b.total_enrollment - a.total_enrollment || a.county.localeCompare(b.county));

    return {
      state: definition.state,
      label: definition.label,
      state_fips: definition.state_fips,
      rows,
      counties: countyList,
      total_enrollment: countyList.reduce((sum, county) => sum + county.total_enrollment, 0),
      plan_count: rows.length,
      parent_org_count: new Set(rows.map((row) => row.parent_org)).size,
      program_type_count: new Set(rows.map((row) => row.program_type)).size,
      source_years: Array.from(new Set(rows.map((row) => row.source_year))).sort(),
      source_urls: Array.from(new Set(rows.map((row) => row.source_url))).sort(),
      notes: Array.from(new Set(rows.map((row) => row.notes))).filter(Boolean),
    };
  }

  async function loadData() {
    const [manifest, rows] = await Promise.all([
      fetchJson(manifestUrl),
      fetchJson(rowsUrl),
    ]);
    const normalizedRows = rows.map(normalizeRow);
    const states = manifest.states
      .map((definition) => buildStateSummary(
        definition,
        normalizedRows.filter((row) => row.state === definition.state)
      ))
      .filter((definition) => definition.rows.length)
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      loadedAt: new Date(),
      geojsonPath: manifest.geojson_path,
      sourceCatalog: manifest.source_catalog || [],
      states,
      rows: normalizedRows,
    };
  }

  return {
    loadData,
  };
})();
