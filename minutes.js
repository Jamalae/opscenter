/**
 * OpsMinutes - Meeting Minutes data module for OpsCenter
 *
 * Reads a published Google Sheet ("Teletherapeutics OpsCenter - Meeting Minutes
 * Log") as CSV and produces a structured model for the Meeting Minutes view.
 *
 * SETUP (one time):
 *   1. Open the Meeting Minutes Log Google Sheet.
 *   2. File -> Share -> Publish to web -> publish the Minutes tab as CSV.
 *   3. Google gives you a URL like:
 *        https://docs.google.com/spreadsheets/d/e/2PACX-1vABC.../pub?gid=0&single=true&output=csv
 *   4. Copy the key between /d/e/ and /pub into PUBLISHED_KEY below,
 *      and the gid into MINUTES_GID below.
 *
 * Expected columns (header row, in any order):
 *   Date | Title | Attendees | Summary | Decisions | Action Items | Doc Link
 *
 * Action Items cell: put one item per line. Prefix a line with [x] (or "DONE")
 * to mark it complete; everything else is treated as open. An optional owner can
 * be written as "Owner: task..." or "task... (Owner)".
 */
const OpsMinutes = (() => {
  // === Paste your published-sheet values here ===
  const PUBLISHED_KEY = '2PACX-1vS-XLO0fcaZgvaO0l3vUBdkkGeIUyn2RzgiwwMvP8-F-AhEfKaUtNRKIKknp6bYFTyq7Wwv5UXYY5He';
  const MINUTES_GID = '23154775';                   // gid of the Minutes tab
  // ===============================================

  const CSV_BASE = `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_KEY}/pub`;
  const FETCH_TIMEOUT = 10000;
  const CACHE_PREFIX = 'opsminutes_';

  function configured() {
    return PUBLISHED_KEY && !/PASTE_|[<>]/.test(PUBLISHED_KEY);
  }

  // --- CSV helpers (same approach as OpsSheets / OpsMarketing) ---
  function parseCsv(text) {
    const rows = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i], n = text[i + 1];
      if (inQ) {
        if (c === '"' && n === '"') { cell += '"'; i++; }
        else if (c === '"') { inQ = false; }
        else { cell += c; }
      } else {
        if (c === '"') inQ = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\r') { /* skip */ }
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else cell += c;
      }
    }
    if (cell.length || row.length) { row.push(cell); rows.push(row); }
    return rows;
  }

  function csvToObjects(text) {
    const grid = parseCsv(text);
    if (grid.length < 2) return [];
    const headers = grid[0].map(h => h.trim());
    return grid.slice(1)
      .filter(r => r && r.some(c => c && String(c).trim()))
      .map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
        return obj;
      });
  }

  async function fetchCsv(gid) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    const url = `${CSV_BASE}?gid=${gid}&single=true&output=csv&cachebust=${Date.now()}`;
    try {
      const resp = await fetch(url, { signal: controller.signal });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      if (!text || text.trim().length < 5) throw new Error('Empty response');
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  function cacheSet(key, data) {
    try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data })); }
    catch (_) { /* quota */ }
  }

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      return JSON.parse(raw).data;
    } catch (_) { return null; }
  }

  // --- field helpers ---
  function pick(row, names) {
    for (const n of names) {
      const key = Object.keys(row).find(k => k.toLowerCase() === n.toLowerCase());
      if (key && row[key]) return row[key];
    }
    return '';
  }

  function parseDate(val) {
    if (!val) return null;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function splitLines(val) {
    return String(val || '')
      .split(/\r?\n|;|•/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function parseActionItem(line, meeting) {
    let text = line;
    let done = false;
    if (/^\s*\[x\]/i.test(text) || /^\s*done[:\-\s]/i.test(text)) {
      done = true;
      text = text.replace(/^\s*(\[x\]|done[:\-\s])/i, '').trim();
    } else {
      text = text.replace(/^\s*(\[\s*\]|todo[:\-\s])/i, '').trim();
    }
    // Owner detection: "Owner: task" or "task (Owner)"
    let owner = '';
    const lead = text.match(/^([A-Z][A-Za-z .'-]{1,30}):\s*(.+)$/);
    const trail = text.match(/^(.+?)\s*\(([^)]{1,30})\)\s*$/);
    if (lead) { owner = lead[1].trim(); text = lead[2].trim(); }
    else if (trail) { owner = trail[2].trim(); text = trail[1].trim(); }
    return { text, owner, done, meeting };
  }

  function normalizeRow(row) {
    const dateLabel = pick(row, ['Date', 'Meeting Date']);
    const title = pick(row, ['Title', 'Meeting', 'Meeting Title']);
    const actionRaw = pick(row, ['Action Items', 'Actions', 'Action']);
    const actionItems = splitLines(actionRaw).map(l => parseActionItem(l, { dateLabel, title }));
    return {
      dateLabel,
      date: parseDate(dateLabel),
      title,
      attendees: pick(row, ['Attendees', 'Participants']),
      summary: pick(row, ['Summary', 'Notes', 'Recap']),
      decisions: pick(row, ['Decisions', 'Decision']),
      actionItems,
      actionItemsRaw: actionRaw,
      docLink: pick(row, ['Doc Link', 'Doc', 'Document', 'Link']),
    };
  }

  async function loadData() {
    if (!configured()) {
      return { configured: false, meetings: [], openActionItems: [], loadedAt: new Date(), source: 'not_configured' };
    }
    let rows, source;
    try {
      const text = await fetchCsv(MINUTES_GID);
      rows = csvToObjects(text);
      cacheSet('minutes', rows);
      source = 'live';
    } catch (err) {
      const cached = cacheGet('minutes');
      if (cached) { rows = cached; source = 'cache'; }
      else { return { configured: true, meetings: [], openActionItems: [], loadedAt: new Date(), source: 'error', error: err.message }; }
    }

    const meetings = rows
      .map(normalizeRow)
      .filter(m => m.title || m.summary || m.dateLabel)
      .sort((a, b) => {
        if (a.date && b.date) return b.date - a.date;
        return 0;
      });

    const openActionItems = [];
    meetings.forEach(m => m.actionItems.forEach(ai => { if (!ai.done) openActionItems.push(ai); }));

    return {
      configured: true,
      meetings,
      openActionItems,
      totalActionItems: meetings.reduce((n, m) => n + m.actionItems.length, 0),
      loadedAt: new Date(),
      source,
    };
  }

  return { loadData, configured };
})();
