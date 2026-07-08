window.OpsCenterData = (() => {
  function stateMatchesFilter(rawState, selectedCode) {
    if (selectedCode === 'all') return true;
    const validStates = OpsInsurance.validStates || {};
    const nameToCode = {};
    Object.keys(validStates).forEach((code) => {
      nameToCode[validStates[code].toLowerCase()] = code;
    });
    const pieces = OpsSheets.utils.splitStates(rawState || '');
    if (pieces.length && pieces.includes(selectedCode)) return true;
    const code = nameToCode[String(rawState || '').trim().toLowerCase()];
    return code === selectedCode;
  }

  function matchesFilters(state, textParts, values) {
    const query = state.search.trim().toLowerCase();
    const searchable = textParts.join(' ').toLowerCase();
    return (!query || searchable.includes(query))
      && stateMatchesFilter(values.state, state.stateFilter)
      && (state.specialtyFilter === 'all' || values.specialty === state.specialtyFilter)
      && (state.statusFilter === 'all' || values.status === state.statusFilter)
      && (state.sourceFilter === 'all' || values.source === state.sourceFilter);
  }

  function getActiveFilterKey(state) {
    return JSON.stringify({
      stateFilter: state.stateFilter,
      specialtyFilter: state.specialtyFilter,
      statusFilter: state.statusFilter,
      sourceFilter: state.sourceFilter,
      search: state.search.trim().toLowerCase(),
    });
  }

  function getFilteredCollections(model, state) {
    if (!model) {
      return {
        issues: [],
        interviews: [],
        intakeRows: [],
        workforceRows: [],
        hireRows: [],
      };
    }

    const cacheKey = getActiveFilterKey(state);
    if (model.filteredCollectionsCache?.key === cacheKey) {
      return model.filteredCollectionsCache.value;
    }

    const filtered = {
      issues: model.issues.filter((item) =>
        matchesFilters(
          state,
          [item.name, item.state, item.owner, item.status, item.detail, item.source, item.risk],
          {
            state: item.state,
            specialty: '',
            status: item.status,
            source: item.source,
          }
        )
      ),
      interviews: model.dataset.interviews.filter((item) =>
        matchesFilters(
          state,
          [item.name, item.position, item.state, item.phase, item.status, item.notes, item.source],
          {
            state: item.state,
            specialty: item.position,
            status: item.status,
            source: item.source,
          }
        )
      ),
      intakeRows: model.dataset.newHiring.filter((item) =>
        matchesFilters(
          state,
          [item.name, item.state, item.specialty, item.interviewStatus, item.credentialing, item.referralSource, item.source],
          {
            state: item.state,
            specialty: item.specialty,
            status: item.interviewStatus,
            source: item.source,
          }
        )
      ),
      workforceRows: model.dataset.currentWorkforce.filter((item) =>
        matchesFilters(
          state,
          [item.providerName, item.licensedState, item.specialty, item.contractType, item.futureLicense, item.source],
          {
            state: item.licensedState,
            specialty: item.specialty,
            status: item.contractType,
            source: item.source,
          }
        )
      ),
      hireRows: model.dataset.finalHires.filter((item) =>
        matchesFilters(
          state,
          [item.name, item.title, item.states, item.comments, item.source],
          {
            state: '',
            specialty: item.title,
            status: '',
            source: item.source,
          }
        )
      ),
    };

    model.filteredCollectionsCache = {
      key: cacheKey,
      value: filtered,
    };

    return filtered;
  }

  function getCompanyCoverageData(model) {
    if (!model) {
      return {
        coveredStates: [],
        coverageLookup: {},
        workforceByState: {},
        finalHiresByState: {},
        hiringByState: {},
      };
    }

    if (model.companyCoverageData) {
      return model.companyCoverageData;
    }

    const companyStateCoverage = {};
    const workforceByState = {};
    const finalHiresByState = {};
    const hiringByState = {};

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
        if (!workforceByState[stateCode]) workforceByState[stateCode] = [];
        workforceByState[stateCode].push(item);
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
        if (!finalHiresByState[stateCode]) finalHiresByState[stateCode] = [];
        finalHiresByState[stateCode].push(item);
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
        if (!hiringByState[stateCode]) hiringByState[stateCode] = [];
        hiringByState[stateCode].push(item);
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

    model.companyCoverageData = {
      coveredStates,
      coverageLookup: Object.fromEntries(coveredStates.map((item) => [item.stateCode, item])),
      workforceByState,
      finalHiresByState,
      hiringByState,
    };

    return model.companyCoverageData;
  }

  function getInsuranceStateRenderData(model, selectedState, escapeHtml, wholeNumber) {
    if (!model || !selectedState) return null;
    if (!model.insuranceStateRenderCache) {
      model.insuranceStateRenderCache = {};
    }
    if (model.insuranceStateRenderCache[selectedState.state]) {
      return model.insuranceStateRenderCache[selectedState.state];
    }

    const countyTableHtml = selectedState.locations.map((location) => `
      <tr>
        <td>${escapeHtml(location.location_label)}</td>
        <td>${wholeNumber(location.total_enrollment)}</td>
        <td>${wholeNumber(location.row_count)}</td>
        <td>${wholeNumber(location.parent_orgs.length)}</td>
        <td>${escapeHtml(location.source_years.join(', ') || 'N/A')}</td>
      </tr>
    `).join('');

    const planTableHtml = selectedState.rows.map((row) => `
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

    const sourceCatalogHtml = sourceCards.length
      ? sourceCards.map((source) => `
        <div class="note-card">
          <strong>Source ${escapeHtml(source.year || 'N/A')}</strong>
          <div class="table-note">${escapeHtml(source.note || 'No note provided')}</div>
          <div>${source.url ? `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.url)}</a>` : 'No source URL provided'}</div>
        </div>
      `).join('')
      : '<div class="empty-state">No source URL or year is available for this state.</div>';

    const renderData = {
      countyTableHtml,
      planTableHtml,
      sourceCatalogHtml,
    };

    model.insuranceStateRenderCache[selectedState.state] = renderData;
    return renderData;
  }

  return {
    stateMatchesFilter,
    getFilteredCollections,
    getCompanyCoverageData,
    getInsuranceStateRenderData,
  };
})();
