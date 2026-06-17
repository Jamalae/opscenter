# Meeting Minutes — OpsCenter Setup & Workflow

This adds a **Meeting Minutes** tab to the OpsCenter dashboard. It follows the exact
pattern the dashboard already uses for Marketing and Hubstaff: a published Google
Sheet read as CSV, rendered client-side. No database, no backend, no extra cost.

## Files changed

- `minutes.js` — **new**. Reads the published Minutes sheet and builds the data model.
- `index.html` — added the `#view-minutes` section and the `<script src="./minutes.js">` include.
- `app.js` — registered the `minutes` view, added DOM refs, a non-blocking loader, and render functions.

Drop these three files into the repo root (replacing `index.html` and `app.js`,
adding `minutes.js`), commit, and push. GitHub Pages redeploys automatically.

## One-time setup (5 minutes)

1. Open the **Teletherapeutics OpsCenter — Meeting Minutes Log** Google Sheet.
2. **File → Share → Publish to web**.
3. Choose the **Minutes** tab and **Comma-separated values (.csv)**, then **Publish**.
4. Google gives you a URL like:
   `https://docs.google.com/spreadsheets/d/e/2PACX-1vABC123.../pub?gid=0&single=true&output=csv`
5. In `minutes.js`, paste:
   - the string between `/d/e/` and `/pub` into `PUBLISHED_KEY`
   - the `gid=` number into `MINUTES_GID` (usually `0` for the first tab)
6. Commit and push. The Meeting Minutes tab goes live.

Until the key is set, the tab shows a friendly "Not Connected" message instead of breaking.

## Sheet columns

The header row can be in any order; the module matches by name:

| Column | Purpose |
|---|---|
| Date | Meeting date (e.g. 2026-06-17) — drives sorting, newest first |
| Title | Meeting name |
| Attendees | Names (free text, e.g. "Yasir; Sara; Omar") |
| Summary | Post-meeting recap |
| Decisions | Key decisions made |
| Action Items | One item per line (see below) |
| Doc Link | Optional link to a full Google Doc recap |

### Action Items format

Put one item per line in the cell. The dashboard counts open vs. complete and
builds an "Open Action Items" panel across all meetings:

- `Follow up with billing` → open item
- `[x] Send script to team` → completed (prefix with `[x]` or `DONE`)
- `Sara: Review credentialing queue` → open item owned by Sara
- `Draft FL memo (Omar)` → open item owned by Omar

## What the tab shows

- **KPIs**: meetings logged, open action items, total action items, most recent meeting date.
- **Open Action Items**: every outstanding follow-up across all meetings, with owner and source meeting.
- **Latest Meeting**: full recap of the most recent meeting, with a link to its Doc.
- **Meeting Minutes Log**: the full table of every meeting.

## Per-meeting capture workflow

The recurring flow after each Google Meet:

1. **Record** — Google Meet + Gemini records and transcribes the meeting (as today). The
   notes/transcript land in Google Drive.
2. **Summarize** — Claude reads that transcript from Drive and writes a structured recap to
   the fixed template: date, attendees, summary, decisions, action items (with owners).
3. **Log** — Claude appends a row to the Minutes Log Google Sheet. (Optionally also creates a
   per-meeting Google Doc and drops its link in the Doc Link column.)
4. **Distribute** — Claude sends the recap to the admin team (Slack now, or Gmail once connected).
5. **Display** — the OpsCenter Meeting Minutes tab automatically reflects the new row on next load.

This can run **on demand** ("Claude, process today's meeting notes") or be put on a **schedule**
that checks Drive each evening for new meeting transcripts.

## Why Google Sheets (not Airtable / a database)

- Already included in your Google Workspace — no added cost.
- Your admin team can read and edit minutes directly in a familiar UI.
- The dashboard already loads published Sheets as CSV, so this needs no backend.
- Action items live as structured rows, enabling the cross-meeting "open items" view.
