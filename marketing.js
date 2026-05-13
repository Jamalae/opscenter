/**
 * OpsMarketing â Social Media Marketing data module for OpsCenter
 * Fetches published CSV tabs from the marketing Google Sheet and
 * produces structured data for the Marketing view.
 *
 * Marketing Sheet ID: 15XGDIxYhwBAjAMR-ySdISv4vLSmvRbiscgth526PQ4E
 * Tabs:
 *   - Post Analytics  (GID 1788744431) â per-post performance data
 *   - Analytics        (GID 1669550598) â summary / aggregate stats
 *   - Social media reels (GID 455643479) â content calendar / queue
 *
 * Only Accounts 1, 2, 3 (tele companies) are shown in OpsCenter.
 * Account mapping:
 *   1 â tele-therapeutics-health
 *   2 â well-america-health
 *   3 â therapyscentral
 */
const OpsMarketing = (() => {
  // Copy of the marketing sheet, owned by Teletherapeutics Health and published to web.
  // Original sheet ID: 15XGDIxYhwBAjAMR-ySdISv4vLSmvRbiscgth526PQ4E
  // Copy sheet ID: 1jxOr9ffL_KOuUmVy8VmoWHX1v0gG2k4veFDVEKOiN28
  const PUBLISHED_KEY = '2PACX-1vRoDALhLa8iyx-zthR8Obv6_Mq0tatDSB-eLNDoWxRidBQXfv-6AqNh3nKe_imfEdSz4dEG29KVdvKT';
  const CSV_BASE = `https://docs.google.com/spreadsheets/d/e/${PUBLISHED_KEY}/pub`;

  const TABS = {
    postAnalytics:  { gid: '1788744431', label: 'Post Analytics' },
    analytics:      { gid: '1669550598', label: 'Analytics' },
    contentCalendar:{ gid: '455643479',  label: 'Content Calendar' },
  };

  const ACCOUNT_MAP = {
    '1': 'tele-therapeutics-health',
    '2': 'well-america-health',
    '3': 'therapyscentral',
    'Account 1': 'tele-therapeutics-health',
    'Account 2': 'well-america-health',
    'Account 3': 'therapyscentral',
  };

  const TELE_ACCOUNTS = ['1', '2', '3', 'Account 1', 'Account 2', 'Account 3'];
  const TELE_PROFILE_KEYWORDS = ['tele-therapeutics', 'well-america', 'therapyscentral'];

  // Profile ID â account name mapping (from social media management platform)
  // Each tele company has separate profile IDs for each social platform.
  // Update these if new profiles are added.
  const PROFILE_MAP = {
    '6958ce5913910388000e2119': 'tele-therapeutics-health',
    '6958cecd1391038800': 'well-america-health',       // prefix match
    '6958b9448e484': 'therapyscentral',                 // prefix match
    '6965195beb40c442e3c58108': 'therapyscentral',      // additional profile (tiktok)
  };

  const FETCH_TIMEOUT = 10000;
  const CACHE_PREFIX = 'opsmktg_';

  // âââ CSV helpers (reuse OpsSheets pattern) âââ

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
    return grid.slice(1).map(row => {
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
      if (!text || text.trim().length < 10) throw new Error('Empty response');
      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  function cacheSet(key, data) {
    try {
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ ts: Date.now(), data }));
    } catch (_) { /* quota */ }
  }

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Cache valid for 30 minutes
      if (Date.now() - parsed.ts > 30 * 60 * 1000) return null;
      return parsed.data;
    } catch (_) { return null; }
  }

  // âââ Data loading âââ

  async function loadTab(tabKey) {
    const tab = TABS[tabKey];
    try {
      const text = await fetchCsv(tab.gid);
      const rows = csvToObjects(text);
      cacheSet(tabKey, rows);
      return { rows, source: 'live' };
    } catch (err) {
      const cached = cacheGet(tabKey);
      if (cached) return { rows: cached, source: 'cache' };
      return { rows: [], source: 'error', error: err.message };
    }
  }

  function isTeleAccount(row) {
    // Check Account column (content calendar)
    const acct = (row['Account'] || '').trim();
    if (TELE_ACCOUNTS.some(a => acct === a || acct.includes(a))) return true;
    // Check Profile ID or URL for tele keywords (post analytics)
    const profileId = (row['Profile ID'] || row['profileId'] || '').toLowerCase();
    const url = (row['Platform Post URL'] || '').toLowerCase();
    return TELE_PROFILE_KEYWORDS.some(kw => profileId.includes(kw) || url.includes(kw));
  }

  function resolveAccountName(row) {
    const acct = (row['Account'] || '').trim();
    if (ACCOUNT_MAP[acct]) return ACCOUNT_MAP[acct];
    // Try from Profile ID using PROFILE_MAP (exact or prefix match)
    const pid = (row['Profile ID'] || row['profile_id'] || '').trim();
    if (pid) {
      // Exact match first
      if (PROFILE_MAP[pid]) return PROFILE_MAP[pid];
      // Prefix match
      for (const [prefix, name] of Object.entries(PROFILE_MAP)) {
        if (pid.startsWith(prefix) || prefix.startsWith(pid)) return name;
      }
    }
    // Try from URL keywords
    const url = (row['Platform Post URL'] || row['Platform'] || '').toLowerCase();
    const combined = pid.toLowerCase() + ' ' + url;
    if (combined.includes('tele-therapeutics')) return 'tele-therapeutics-health';
    if (combined.includes('well-america')) return 'well-america-health';
    if (combined.includes('therapyscentral')) return 'therapyscentral';
    return acct || 'unknown';
  }

  function parseNum(val) {
    const n = Number(String(val || '0').replace(/[^0-9.-]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }

  function parseDate(val) {
    if (!val) return null;
    const d = new Date(val);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /**
   * Load all marketing data, filter to tele accounts, and return structured model.
   */
  async function loadData() {
    const [postResult, analyticsResult, calendarResult] = await Promise.allSettled([
      loadTab('postAnalytics'),
      loadTab('analytics'),
      loadTab('contentCalendar'),
    ]);

    const postData = postResult.status === 'fulfilled' ? postResult.value : { rows: [], source: 'error' };
    const analyticsData = analyticsResult.status === 'fulfilled' ? analyticsResult.value : { rows: [], source: 'error' };
    const calendarData = calendarResult.status === 'fulfilled' ? calendarResult.value : { rows: [], source: 'error' };

    // Parse & filter post analytics â keep only tele company posts
    // Note: In the published sheet, Platform and Platform Post URL columns
    // are swapped â Platform contains the URL, Platform Post URL contains
    // the platform name (instagram/facebook/tiktok). Auto-detect this.
    const allPosts = postData.rows.map(row => {
      const rawPlatform = row['Platform'] || '';
      const rawUrl = row['Platform Post URL'] || row['platform_post_url'] || '';
      const isSwapped = rawPlatform.includes('http') || rawPlatform.includes('://');
      return {
        postId:      row['Post ID'] || row['post_id'] || '',
        content:     row['Content'] || '',
        publishedAt: parseDate(row['Published At'] || row['published_at']),
        scheduledFor:parseDate(row['Scheduled For'] || row['scheduled_for']),
        status:      row['Status'] || '',
        profileId:   row['Profile ID'] || row['profile_id'] || '',
        mediaType:   row['Media Type'] || row['media_type'] || '',
        platform:    (isSwapped ? rawUrl : rawPlatform).toLowerCase(),
        url:         isSwapped ? rawPlatform : rawUrl,
        impressions: parseNum(row['Impressions']),
        reach:       parseNum(row['Reach']),
        likes:       parseNum(row['Likes']),
        comments:    parseNum(row['Comments']),
        shares:      parseNum(row['Shares']),
        clicks:      parseNum(row['Clicks']),
        _raw: row,
      };
    });

    // This is a dedicated marketing sheet for the 3 tele companies.
    // All posts belong to tele accounts, so include all rows.
    // For calendar items, we still filter by Account column (1/2/3).
    const posts = allPosts;
    posts.forEach(p => { p.account = resolveAccountName(p._raw); delete p._raw; });

    // Content calendar â filter to Accounts 1, 2, 3
    const allCalendar = calendarData.rows;
    const calendar = allCalendar.filter(row => {
      const acct = (row['Account'] || '').trim();
      return ['1', '2', '3', 'Account 1', 'Account 2', 'Account 3'].some(a => acct === a);
    }).map(row => ({
      topic:    row['Topic'] || '',
      language: row['Language'] || '',
      voice:    row['Voice Name'] || '',
      status:   row['Status'] || '',
      result:   row['Result'] || '',
      account:  ACCOUNT_MAP[(row['Account'] || '').trim()] || row['Account'] || '',
    }));

    // Compute KPIs
    const totalPosts = posts.length;
    const totalImpressions = posts.reduce((s, p) => s + p.impressions, 0);
    const totalReach = posts.reduce((s, p) => s + p.reach, 0);
    const totalLikes = posts.reduce((s, p) => s + p.likes, 0);
    const totalComments = posts.reduce((s, p) => s + p.comments, 0);
    const totalShares = posts.reduce((s, p) => s + p.shares, 0);
    const totalClicks = posts.reduce((s, p) => s + p.clicks, 0);
    const totalEngagements = totalLikes + totalComments + totalShares + totalClicks;
    const engagementRate = totalImpressions > 0 ? (totalEngagements / totalImpressions * 100) : 0;

    // Per-platform breakdown
    const platforms = {};
    posts.forEach(p => {
      const plat = p.platform || 'unknown';
      if (!platforms[plat]) platforms[plat] = { posts: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0 };
      const b = platforms[plat];
      b.posts++; b.impressions += p.impressions; b.reach += p.reach;
      b.likes += p.likes; b.comments += p.comments; b.shares += p.shares; b.clicks += p.clicks;
    });

    // Per-account breakdown
    const accounts = {};
    posts.forEach(p => {
      const acct = p.account || 'unknown';
      if (!accounts[acct]) accounts[acct] = { posts: 0, impressions: 0, reach: 0, likes: 0, comments: 0, shares: 0, clicks: 0 };
      const b = accounts[acct];
      b.posts++; b.impressions += p.impressions; b.reach += p.reach;
      b.likes += p.likes; b.comments += p.comments; b.shares += p.shares; b.clicks += p.clicks;
    });

    // Calendar status summary
    const calendarByStatus = {};
    calendar.forEach(c => {
      const s = c.status || 'Unknown';
      calendarByStatus[s] = (calendarByStatus[s] || 0) + 1;
    });

    // Recent posts (last 20, sorted by date)
    const recentPosts = [...posts]
      .filter(p => p.publishedAt)
      .sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
      .slice(0, 20);

    // Weekly trend (last 8 weeks)
    const weeklyTrend = computeWeeklyTrend(posts);

    return {
      kpis: {
        totalPosts,
        totalImpressions,
        totalReach,
        totalLikes,
        totalComments,
        totalShares,
        totalClicks,
        totalEngagements,
        engagementRate,
      },
      posts,
      recentPosts,
      platforms,
      accounts,
      calendar,
      calendarByStatus,
      weeklyTrend,
      sources: {
        postAnalytics: postData.source,
        analytics: analyticsData.source,
        contentCalendar: calendarData.source,
      },
      loadedAt: new Date(),
    };
  }

  function computeWeeklyTrend(posts) {
    const now = new Date();
    const weeks = [];
    for (let w = 7; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (w * 7 + now.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const weekPosts = posts.filter(p =>
        p.publishedAt && p.publishedAt >= weekStart && p.publishedAt < weekEnd
      );
      weeks.push({
        label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        posts: weekPosts.length,
        impressions: weekPosts.reduce((s, p) => s + p.impressions, 0),
        engagement: weekPosts.reduce((s, p) => s + p.likes + p.comments + p.shares, 0),
      });
    }
    return weeks;
  }

  return { loadData, ACCOUNT_MAP, TELE_PROFILE_KEYWORDS };
})();
