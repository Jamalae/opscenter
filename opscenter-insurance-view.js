window.OpsCenterInsuranceView = (() => {
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

  function renderMarketingSummary(ctx, selectedState) {
    const { el, escapeHtml, wholeNumber } = ctx;
    if (!el.insuranceMarketingSummary) return;
    if (!selectedState || !selectedState.locations) {
      el.insuranceMarketingSummary.innerHTML = '';
      return;
    }
    const totalEnrollment = selectedState.locations.reduce((s, l) => s + (l.total_enrollment || 0), 0);
    const inNet = selectedState.locations.reduce((s, l) => s + (l.in_network_enrollment || 0), 0);
    const outOfNet = totalEnrollment - inNet;
    const sharePct = totalEnrollment > 0 ? Math.round((inNet / totalEnrollment) * 100) : 0;

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

  async function renderInsuranceMap(ctx, selectedStateCode) {
    const { state, el, model, ensureInsuranceData, escapeHtml, wholeNumber } = ctx;
    if (state.view !== 'insurance') return;
    if (!selectedStateCode || !el.insuranceCountyMap) return;
    if (typeof L === 'undefined') {
      el.insuranceCountyMap.innerHTML = '<div class="empty-state">Leaflet did not load, so the county map could not be rendered.</div>';
      return;
    }

    const insuranceStates = model.insurance?.states || [];
    const selectedState = insuranceStates.find((entry) => entry.state === selectedStateCode);
    if (!selectedState) {
      el.insuranceCountyMap.innerHTML = `<div class="empty-state">No insurance map data is available for ${escapeHtml(selectedStateCode)}.</div>`;
      return;
    }

    if (!ctx.insuranceGeoJson) {
      const response = await fetch(model.insurance.geojsonPath, { cache: 'force-cache' });
      if (!response.ok) {
        throw new Error(`County GeoJSON could not be loaded: ${response.status}`);
      }
      ctx.insuranceGeoJson = await response.json();
    }

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

    const stateFipsMap = (model.insurance && model.insurance.stateFips) || OpsInsurance.stateFips || {};
    const stateFips = stateFipsMap[selectedStateCode]
      || (selectedState.rows.find((row) => row.county_fips)?.county_fips?.slice(0, 2) || '');

    if (!stateFips) {
      el.insuranceCountyMap.innerHTML = `<div class="empty-state">No FIPS prefix is configured for ${escapeHtml(selectedStateCode)}, so the county map cannot be drawn.</div>`;
      return;
    }
    const mode = state.mapMode === 'priority' ? 'priority' : 'enrollment';
    const renderKey = `${selectedStateCode}:${mode}`;
    if (ctx.insuranceMapLayer && ctx.insuranceMapRenderKey === renderKey) {
      return;
    }

    if (!ctx.insuranceGeoJsonByState) {
      ctx.insuranceGeoJsonByState = {};
      ctx.insuranceGeoJson.features.forEach((feature) => {
        const featureState = feature?.properties?.STATE;
        if (!featureState) return;
        if (!ctx.insuranceGeoJsonByState[featureState]) ctx.insuranceGeoJsonByState[featureState] = [];
        ctx.insuranceGeoJsonByState[featureState].push(feature);
      });
    }

    const stateFeatures = ctx.insuranceGeoJsonByState[stateFips] || [];
    const breaks = buildInsuranceBreaks(selectedState.locations.map((location) => location.total_enrollment));
    const priorityPalette = ['#7a1f1f', '#a64a2a', '#c8861f', '#9bbf3a', '#3f9d5a'];
    function priorityColor(share) {
      if (share <= 0) return priorityPalette[0];
      if (share < 0.2) return priorityPalette[1];
      if (share < 0.4) return priorityPalette[2];
      if (share < 0.7) return priorityPalette[3];
      return priorityPalette[4];
    }

    if (!ctx.insuranceMap) {
      ctx.insuranceMap = L.map(el.insuranceCountyMap, {
        attributionControl: false,
        zoomControl: true,
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 12,
      }).addTo(ctx.insuranceMap);
    }

    if (ctx.insuranceMapLayer) {
      ctx.insuranceMapLayer.remove();
      ctx.insuranceMapLayer = null;
    }

    ctx.insuranceMapLayer = L.geoJSON({
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
    }).addTo(ctx.insuranceMap);
    ctx.insuranceMapRenderKey = renderKey;

    const bounds = ctx.insuranceMapLayer.getBounds();
    if (bounds.isValid()) {
      ctx.insuranceMap.fitBounds(bounds, { padding: [16, 16] });
    }
    setTimeout(() => ctx.insuranceMap.invalidateSize(), 0);

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

  async function renderInsuranceView(ctx) {
    const { model, state, el, ensureInsuranceData, escapeHtml, wholeNumber, getInsuranceStateRenderData, badgeStatus } = ctx;
    if (!model) return;

    if (!model.insurance || !Array.isArray(model.insurance.states)) {
      el.insuranceValidationBanner.textContent = 'Insurance System: loading source files…';
      el.insuranceSelectionSummary.textContent = 'Loading verified insurance rows…';
      el.insuranceStatus.innerHTML = '<div class="note-card">Insurance datasets are loading on demand for this tab.</div>';
      el.insuranceCountyTable.innerHTML = '<tr><td colspan="5" class="empty-state">Loading county insurance rows…</td></tr>';
      el.insurancePlanTable.innerHTML = '<tr><td colspan="6" class="empty-state">Loading plan rows…</td></tr>';
      await ensureInsuranceData();
    }

    const insurance = model.insurance || { states: [], rows: [], error: 'Insurance data is not loaded yet.' };
    const validation = insurance.validation || { validStateCount: 0, invalidRowCount: 0, invalidStateValues: [] };

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
    const stateRenderData = getInsuranceStateRenderData(selectedState);
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

    el.insuranceCountyTable.innerHTML = stateRenderData.countyTableHtml;
    el.insurancePlanTable.innerHTML = stateRenderData.planTableHtml;
    el.insuranceSourceCatalog.innerHTML = stateRenderData.sourceCatalogHtml;

    renderMarketingSummary(ctx, selectedState);

    renderInsuranceMap(ctx, state.insuranceState).catch((error) => {
      console.error(error);
      el.insuranceCountyMap.innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
    });
  }

  return {
    renderInsuranceView,
    renderInsuranceMap,
  };
})();
