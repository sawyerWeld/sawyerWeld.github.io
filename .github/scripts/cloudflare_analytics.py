#!/usr/bin/env python3
"""Read sawyerwelden.com page views from Cloudflare's GraphQL API."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import sys
import urllib.error
import urllib.request

ACCOUNT = "5f6750095735f152fc2bd9343814ff88"
TOKEN_FILE = Path.home() / ".config/sawyer-site-analytics/token"
ENDPOINT = "https://api.cloudflare.com/client/v4/graphql"


def make_query(account, host, start, end, limit):
    quote = json.dumps
    filters = (f'datetime_geq: {quote(start)}, datetime_lt: {quote(end)}, '
               f'requestHost: {quote(host)}')
    return '''query { viewer { accounts(filter: {accountTag: ACCOUNT}) {
      total: rumPageloadEventsAdaptiveGroups(limit: 1, filter: {FILTER}) {
        count sum { visits } avg { sampleInterval }
      }
      pages: rumPageloadEventsAdaptiveGroups(limit: LIMIT,
        orderBy: [count_DESC], filter: {FILTER}) {
        count dimensions { requestPath } avg { sampleInterval }
      }
    } } }'''.replace('ACCOUNT', quote(account)).replace('FILTER', filters).replace('LIMIT', str(limit))


def fetch(query, token):
    request = urllib.request.Request(ENDPOINT,
        data=json.dumps({"query": query}).encode(),
        headers={"Authorization": "Bearer " + token,
                 "Content-Type": "application/json", "User-Agent": "SawyerSiteAnalytics/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            payload = json.load(response)
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Cloudflare HTTP {exc.code}; check token permissions and account access.") from None
    except (urllib.error.URLError, TimeoutError) as exc:
        raise RuntimeError("Unable to reach Cloudflare; check connectivity and retry.") from exc
    if payload.get("errors"):
        messages = "; ".join(e.get("message", "Unknown error") for e in payload["errors"])
        raise RuntimeError("Cloudflare GraphQL: " + messages.replace(token, "[redacted]"))
    accounts = payload.get("data", {}).get("viewer", {}).get("accounts", [])
    if not accounts:
        raise RuntimeError("No accessible account returned. Token needs Account Analytics:Read for this account.")
    return accounts[0]


def report(data, host, start, end, limit):
    totals = data["total"]
    pages = data["pages"]
    return {"host": host, "start_utc": start, "end_utc_exclusive": end,
            "page_views": totals[0]["count"] if totals else 0,
            "visits": totals[0]["sum"]["visits"] if totals else 0,
            "sample_interval": totals[0]["avg"]["sampleInterval"] if totals else None,
            "pages_may_be_truncated": len(pages) >= limit,
            "pages": [{"path": row["dimensions"]["requestPath"],
                       "page_views": row["count"],
                       "sample_interval": row["avg"]["sampleInterval"]} for row in pages]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--days", type=int, default=1, help="Rolling lookback, 1–30 days (default 1)")
    parser.add_argument("--host", default="sawyerwelden.com")
    parser.add_argument("--account", default=ACCOUNT)
    parser.add_argument("--limit", type=int, default=1000, help="Maximum page paths to return")
    parser.add_argument("--json", action="store_true", help="Output JSON for scripts")
    args = parser.parse_args()
    if not 1 <= args.days <= 30 or not 1 <= args.limit <= 10000:
        parser.error("days must be 1–30 and limit must be 1–10000")
    token = os.environ.get("CLOUDFLARE_API_TOKEN", "").strip()
    if not token and TOKEN_FILE.exists():
        if TOKEN_FILE.stat().st_mode & 0o077:
            parser.error(f"Token file must be private: chmod 600 {TOKEN_FILE}")
        token = TOKEN_FILE.read_text().strip()
    if not token:
        parser.error(f"Set CLOUDFLARE_API_TOKEN or save a read-only API token in {TOKEN_FILE} (mode 600).")
    end = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    start = end - dt.timedelta(days=args.days)
    stamp = lambda value: value.isoformat().replace("+00:00", "Z")
    start, end = stamp(start), stamp(end)
    try:
        data = fetch(make_query(args.account, args.host, start, end, args.limit), token)
        result = report(data, args.host, start, end, args.limit)
    except (RuntimeError, ValueError, KeyError, TypeError) as exc:
        print(f"Analytics fetch failed: {exc}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(f"{args.host} | {start} to {end}")
        print(f"Page views: {result['page_views']:,} | Visits: {result['visits']:,}")
        print("Views are Cloudflare-reported estimates; visits are not unique people.")
        for row in result["pages"]:
            print(f"{row['page_views']:>10,}  {row['path']}")
        if result["pages_may_be_truncated"]:
            print("Page list reached its limit; totals cover the full query window.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
