#!/usr/bin/env python3
"""
Refresh CMS-sourced county-level enrollment files.

Run from repo root:
    python3 scripts/refresh_cms_data.py

Pulls the latest publicly available files and regenerates:
  - data/cms_medicare_advantage.csv      (Medicare Advantage by county × parent_org)
  - data/cms_medicare_ffs.csv            (Original Medicare FFS by county)
  - data/cms_duals.csv                   (Dual-eligible by county)

Skips Marketplace + state-based exchange files because they are
issued annually and don't need monthly refresh.

Designed to be run by .github/workflows/refresh-cms.yml monthly,
but works fine standalone on any machine with python3 + curl + unzip.
"""
import os
import sys
import csv
import json
import zipfile
import urllib.request
import tempfile
import re
from collections import defaultdict
from datetime import datetime

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(REPO_ROOT, "data")
GEOJSON_PATH = os.path.join(DATA_DIR, "insurance/geo/us-counties-fips.geojson")

TARGET_STATES = {
    'AZ','CA','CO','CT','DC','FL','GA','IL','IN','KY','MA','MD','MI','MN','MO',
    'NC','NM','NV','NY','OH','OR','PA','SC','TN','TX','UT','VA','WA','WI',
}

CMS_LANDING = "https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-advantagepart-d-contract-and-enrollment-data/monthly-enrollment-contract/plan/state/county"
CMS_MONTHLY_LANDING = "https://data.cms.gov/summary-statistics-on-beneficiary-enrollment/medicare-and-medicaid-reports/medicare-monthly-enrollment"


def fetch(url, dest):
    print(f"  GET {url}")
    urllib.request.urlretrieve(url, dest)
    return os.path.getsize(dest)


def fetch_text(url):
    with urllib.request.urlopen(url) as resp:
        return resp.read().decode("utf-8", errors="replace")


def latest_cpsc_url():
    """Find the latest CPSC ZIP URL by scraping the CMS landing page."""
    html = fetch_text(CMS_LANDING)
    m = re.search(r'/files/zip/(monthly-enrollment-cpsc-[a-z]+-\d{4})\.zip', html, re.IGNORECASE)
    if not m:
        raise RuntimeError("Could not find CPSC ZIP link on CMS landing page")
    return f"https://www.cms.gov/files/zip/{m.group(1)}.zip"


def latest_monthly_csv_url():
    """Find the latest Medicare Monthly Enrollment CSV from data.cms.gov data.json."""
    print("  fetching data.cms.gov data.json…")
    text = fetch_text("https://data.cms.gov/data.json")
    data = json.loads(text)
    matches = [d for d in data["dataset"] if "medicare monthly enrollment" in d.get("title", "").lower()]
    if not matches:
        raise RuntimeError("No Medicare Monthly Enrollment dataset in data.json")
    for dist in matches[0].get("distribution", []):
        url = dist.get("downloadURL") or dist.get("accessURL") or ""
        if url.endswith(".csv"):
            return url
    raise RuntimeError("No CSV download in Medicare Monthly Enrollment distribution")


def parse_csv_line(line):
    out, cur, q = [], "", False
    i = 0
    while i < len(line):
        c = line[i]
        if c == '"':
            if q and i + 1 < len(line) and line[i + 1] == '"':
                cur += '"'; i += 2; continue
            q = not q
        elif c == "," and not q:
            out.append(cur); cur = ""
        else:
            cur += c
        i += 1
    out.append(cur)
    return out


def csv_cell(s):
    s = "" if s is None else str(s)
    if any(c in s for c in [",", '"', "\n"]):
        return '"' + s.replace('"', '""') + '"'
    return s


def load_fips_lookup():
    with open(GEOJSON_PATH) as f:
        geo = json.load(f)
    return {feat["id"]: feat["properties"]["NAME"] for feat in geo["features"]}


# ── Medicare Advantage ─────────────────────────────────────────────────
def is_ma_plan_type(plan_type):
    if not plan_type:
        return False
    t = plan_type.lower()
    if "pdp" in t:
        return False
    return any(k in t for k in ("hmo", "ppo", "pffs", "cost", "msa"))


def refresh_medicare_advantage(workdir):
    print("\n→ Medicare Advantage")
    zip_url = latest_cpsc_url()
    zip_path = os.path.join(workdir, "cpsc.zip")
    fetch(zip_url, zip_path)
    extract_dir = os.path.join(workdir, "cpsc")
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(extract_dir)

    # Find the two CSVs
    contract_csv = enrollment_csv = None
    for root, _, files in os.walk(extract_dir):
        for fn in files:
            full = os.path.join(root, fn)
            if "Contract_Info" in fn:
                contract_csv = full
            elif "Enrollment_Info" in fn:
                enrollment_csv = full
    if not (contract_csv and enrollment_csv):
        raise RuntimeError("Could not find expected CSVs in CPSC ZIP")

    # Build contract lookup
    contracts = {}
    with open(contract_csv, encoding="latin-1") as f:
        rdr = csv.reader(f)
        next(rdr)  # header
        for row in rdr:
            if len(row) < 11:
                continue
            contracts[(row[0], row[1])] = {
                "planType": row[3],
                "parentOrg": row[10],
            }

    # Aggregate enrollment
    agg = {}
    with open(enrollment_csv, encoding="latin-1") as f:
        rdr = csv.reader(f)
        next(rdr)
        for row in rdr:
            if len(row) < 7:
                continue
            cid, pid, _ssa, fips, state, county, enroll = row[0], row[1], row[2], row[3], row[4], row[5], row[6]
            if state not in TARGET_STATES:
                continue
            if not fips or not county:
                continue
            if enroll in ("*", "", "0"):
                continue
            c = contracts.get((cid, pid))
            if not c or not is_ma_plan_type(c["planType"]):
                continue
            try:
                e = int(enroll)
            except ValueError:
                continue
            key = (state, county, c["parentOrg"])
            if key not in agg:
                agg[key] = {"total": 0, "fips": fips.zfill(5), "plan_types": set()}
            agg[key]["total"] += e
            agg[key]["plan_types"].add(c["planType"])

    # Filter and write
    out_path = os.path.join(DATA_DIR, "cms_medicare_advantage.csv")
    header = ["state","county","program_type","plan_name","parent_org","geographic_region","medicaid_enrollment","dual_enrollment","total_enrollment","source_url","source_year","notes"]
    rows_written = 0
    source_year = re.search(r"(\d{4})-(\d{2})", zip_url)
    source_year_label = f"{source_year.group(1)}-{source_year.group(2)}" if source_year else "latest"
    with open(out_path, "w") as f:
        f.write(",".join(header) + "\n")
        for (state, county, parent), v in sorted(agg.items()):
            if v["total"] < 50:
                continue
            plan_types = "/".join(sorted(v["plan_types"]))
            f.write(",".join([
                csv_cell(state), csv_cell(county), csv_cell("Medicare Advantage"),
                csv_cell(f"{parent} – {plan_types}"), csv_cell(parent),
                csv_cell(f"FIPS {v['fips']}"), "", "", csv_cell(v["total"]),
                csv_cell(CMS_LANDING), csv_cell(source_year_label),
                csv_cell(f"[source: CMS CPSC {source_year_label}]"),
            ]) + "\n")
            rows_written += 1
    print(f"  wrote {out_path} · {rows_written:,} rows")


# ── Medicare FFS + Duals ────────────────────────────────────────────────
def refresh_ffs_and_duals(workdir):
    print("\n→ Medicare FFS + Duals")
    csv_url = latest_monthly_csv_url()
    csv_path = os.path.join(workdir, "medicare_monthly.csv")
    fetch(csv_url, csv_path)

    fips_lookup = load_fips_lookup()
    # Find the most recent month/year present
    latest_period = (0, 0)
    months = {"January":1,"February":2,"March":3,"April":4,"May":5,"June":6,"July":7,"August":8,"September":9,"October":10,"November":11,"December":12}
    with open(csv_path, encoding="latin-1") as f:
        rdr = csv.DictReader(f)
        for row in rdr:
            try:
                y = int(row["YEAR"])
            except (ValueError, KeyError):
                continue
            m = months.get(row.get("MONTH", ""), 0)
            if m and (y, m) > latest_period:
                latest_period = (y, m)
    if latest_period == (0, 0):
        raise RuntimeError("Could not determine latest period in Medicare Monthly file")
    target_year = str(latest_period[0])
    target_month = next(k for k, v in months.items() if v == latest_period[1])
    print(f"  using period {target_year} {target_month}")

    ffs_rows, duals_rows = [], []
    with open(csv_path, encoding="latin-1") as f:
        rdr = csv.DictReader(f)
        for row in rdr:
            if row.get("YEAR") != target_year or row.get("MONTH") != target_month:
                continue
            if row.get("BENE_GEO_LVL") != "County":
                continue
            state = row.get("BENE_STATE_ABRVTN", "")
            if state not in TARGET_STATES:
                continue
            fips = (row.get("BENE_FIPS_CD") or "").strip().zfill(5)
            if fips not in fips_lookup:
                continue
            county = fips_lookup[fips]
            try: ffs = int(float(row.get("ORGNL_MDCR_BENES") or 0))
            except (ValueError, TypeError): ffs = 0
            try: dual = int(float(row.get("DUAL_TOT_BENES") or 0))
            except (ValueError, TypeError): dual = 0
            if ffs >= 50:
                ffs_rows.append((state, county, fips, ffs))
            if dual >= 50:
                duals_rows.append((state, county, fips, dual))

    period_label = f"{target_year}-{latest_period[1]:02d}"
    header = ["state","county","program_type","plan_name","parent_org","geographic_region","medicaid_enrollment","dual_enrollment","total_enrollment","source_url","source_year","notes"]

    ffs_path = os.path.join(DATA_DIR, "cms_medicare_ffs.csv")
    with open(ffs_path, "w") as f:
        f.write(",".join(header) + "\n")
        for state, county, fips, count in sorted(ffs_rows):
            f.write(",".join([
                csv_cell(state), csv_cell(county), csv_cell("Medicare FFS (Original Medicare)"),
                csv_cell("Medicare FFS"), csv_cell("Medicare (Federal)"),
                csv_cell(f"FIPS {fips}"), "", "", csv_cell(count),
                csv_cell(CMS_MONTHLY_LANDING), csv_cell(period_label),
                csv_cell(f"[source: CMS Medicare Monthly Enrollment {period_label}; ORGNL_MDCR_BENES]"),
            ]) + "\n")
    print(f"  wrote {ffs_path} · {len(ffs_rows):,} rows")

    duals_path = os.path.join(DATA_DIR, "cms_duals.csv")
    with open(duals_path, "w") as f:
        f.write(",".join(header) + "\n")
        for state, county, fips, count in sorted(duals_rows):
            f.write(",".join([
                csv_cell(state), csv_cell(county), csv_cell("Dual-Eligible (Medicare + Medicaid)"),
                csv_cell("Dual-Eligible"), csv_cell("Dual-Eligible (Medicare/Medicaid)"),
                csv_cell(f"FIPS {fips}"), "", csv_cell(count), csv_cell(count),
                csv_cell(CMS_MONTHLY_LANDING), csv_cell(period_label),
                csv_cell(f"[source: CMS Medicare Monthly Enrollment {period_label}; DUAL_TOT_BENES]"),
            ]) + "\n")
    print(f"  wrote {duals_path} · {len(duals_rows):,} rows")


def main():
    print(f"Refreshing CMS data at {datetime.utcnow().isoformat()}Z")
    if not os.path.isfile(GEOJSON_PATH):
        sys.exit(f"Missing {GEOJSON_PATH}")
    with tempfile.TemporaryDirectory() as workdir:
        try:
            refresh_medicare_advantage(workdir)
        except Exception as e:
            print(f"  FAIL: {e}")
        try:
            refresh_ffs_and_duals(workdir)
        except Exception as e:
            print(f"  FAIL: {e}")
    print("\nDone.")


if __name__ == "__main__":
    main()
