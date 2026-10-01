"""Publish aggregate counts only; credentials remain in the Actions secret."""
import datetime as dt
import json
import os
from pathlib import Path
from cloudflare_analytics import ACCOUNT, TOKEN_FILE, make_query, fetch, report


def snapshot(token):
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    stamp = lambda value: value.isoformat().replace('+00:00', 'Z')
    periods = {}
    for days in (1, 7, 30):
        start, end = stamp(now - dt.timedelta(days=days)), stamp(now)
        query = make_query(ACCOUNT, 'sawyerwelden.com', start, end, 1000)
        # Defense in depth: this page contains no beacon, and also is excluded here.
        query = query.replace('requestHost:', 'requestPath_notlike: "/ledger-6f28c9a4%", requestHost:')
        data = fetch(query, token)
        result = report(data, 'sawyerwelden.com', start, end, 1000)
        periods[str(days)] = result
    return {'updated_at': stamp(now), 'periods': periods}


if __name__ == '__main__':
    token = os.environ.get('CLOUDFLARE_API_TOKEN', '').strip()
    if not token and TOKEN_FILE.exists():
        token = TOKEN_FILE.read_text().strip()
    if not token:
        raise SystemExit('Missing CLOUDFLARE_API_TOKEN')
    result = snapshot(token)
    destination = Path(__file__).resolve().parents[2] / 'ledger-6f28c9a4/data.json'
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(result, indent=2) + '\n')
    temporary.replace(destination)
    print('Updated public aggregate analytics snapshot.')
