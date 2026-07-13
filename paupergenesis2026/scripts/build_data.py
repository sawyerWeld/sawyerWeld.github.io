#!/usr/bin/env python3
"""Build a static Paupergenesis snapshot from public Melee pages."""

from __future__ import annotations

import argparse
import concurrent.futures
import html
import json
import re
import subprocess
import time
from html.parser import HTMLParser
from pathlib import Path


EVENT_ID = "409325"
EVENT_URL = f"https://melee.gg/Tournament/View/{EVENT_ID}"
STANDINGS_URL = "https://melee.gg/Standing/GetRoundStandings"
ROUND_EIGHT_ID = "1481598"

ALIASES = {
    "Mono-Red Madness Burn": "Mono Red Madness",
    "Mono-Red Rally": "Mono Red Rally",
    "Mono-Blue Terror": "Mono Blue Terror",
    "Mono-Blue Faeries": "Mono Blue Faeries",
    "Mono-Green Elves": "Elves",
    "Mono-White White Weenie": "White Weenie",
    "Golgari Spy Combo": "Spy Combo",
    "Boros Inside Out Combo": "Tireless Tribe",
    "Temur Pizza Combo": "Pizza Combo",
    "Gruul Monster Tron": "Monster Tron",
    "Temur Monster Tron": "Monster Tron",
    "Azorius Cawgates": "Cawgate",
    "Gruul Ruby Storm": "Gruul Storm",
    "Selesnya Bogles": "Bogles",
    "Walls Combo": "Walls",
    "U-B-R-G Walls Combo": "Walls",
    "Golgari Altar Tron": "Altar Tron",
    "U-B-R-G Altar Tron": "Altar Tron",
}


class DeckParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.board = "main"
        self.cards = {"main": [], "side": []}
        self._div_depth = 0
        self._record_depth = 0
        self._capture = None
        self._capture_tag = None
        self._text: list[str] = []
        self._quantity = None
        self._name = None

    def handle_starttag(self, tag, attrs):
        classes = set(dict(attrs).get("class", "").split())
        if tag == "div":
            self._div_depth += 1
        if "decklist-record" in classes:
            self._record_depth = self._div_depth
            self._quantity = None
            self._name = None
        if "decklist-category-title" in classes:
            self._capture = "category"
            self._capture_tag = tag
            self._text = []
        elif "decklist-record-quantity" in classes:
            self._capture = "quantity"
            self._capture_tag = tag
            self._text = []
        elif "decklist-record-name" in classes:
            self._capture = "name"
            self._capture_tag = tag
            self._text = []

    def handle_data(self, data):
        if self._capture:
            self._text.append(data)

    def handle_endtag(self, tag):
        if self._capture and tag == self._capture_tag:
            value = html.unescape("".join(self._text)).strip()
            if self._capture == "category":
                self.board = "side" if value.lower().startswith("sideboard") else "main"
            elif self._capture == "quantity":
                self._quantity = int(value) if value.isdigit() else None
            elif self._capture == "name":
                self._name = value
            self._capture = None
            self._capture_tag = None
        if tag == "div" and self._record_depth == self._div_depth:
            if self._quantity and self._name:
                self.cards[self.board].append({"name": self._name, "quantity": self._quantity})
            self._record_depth = 0
        if tag == "div":
            self._div_depth -= 1


def curl(*args: str) -> bytes:
    return subprocess.run(["curl", "-fsSL", *args], check=True, capture_output=True).stdout


def standings_form(round_id: str) -> str:
    from urllib.parse import urlencode

    columns = [
        "Rank", "Team", "Decklists", "MatchRecord", "GameRecord", "Points",
        "OpponentMatchWinPercentage", "TeamGameWinPercentage",
        "OpponentGameWinPercentage", "FinalTiebreaker", "OpponentCount",
    ]
    data = {
        "draw": "1", "start": "0", "length": "300", "search[value]": "",
        "search[regex]": "false", "order[0][column]": "0", "order[0][dir]": "asc",
        "roundId": round_id,
    }
    for index, column in enumerate(columns):
        data[f"columns[{index}][data]"] = column
        data[f"columns[{index}][name]"] = column
        data[f"columns[{index}][searchable]"] = "false" if column in {"Decklists", "OpponentCount"} else "true"
        data[f"columns[{index}][orderable]"] = "false" if column in {"Decklists", "OpponentCount"} else "true"
        data[f"columns[{index}][search][value]"] = ""
        data[f"columns[{index}][search][regex]"] = "false"
    return urlencode(data)


def fetch_standings(cache: Path, refresh: bool) -> dict:
    path = cache / "round8.json"
    if refresh or not path.exists():
        body = curl(
            STANDINGS_URL,
            "-H", "Content-Type: application/x-www-form-urlencoded; charset=UTF-8",
            "-H", "X-Requested-With: XMLHttpRequest",
            "-H", f"Referer: {EVENT_URL}",
            "--data-binary", standings_form(ROUND_EIGHT_ID),
        )
        path.write_bytes(body)
    return json.loads(path.read_text())


def fetch_deck(deck_id: str, cache: Path, refresh: bool) -> dict:
    path = cache / "decks" / f"{deck_id}.html"
    if refresh or not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(curl(f"https://melee.gg/Decklist/View/{deck_id}"))
        time.sleep(0.04)
    parser = DeckParser()
    parser.feed(path.read_text(errors="replace"))
    return parser.cards


def normalize(name: str) -> str:
    return ALIASES.get(name, name.replace("-", " "))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    cache = root / ".cache"
    cache.mkdir(exist_ok=True)
    snapshot = fetch_standings(cache, args.refresh)
    rows = snapshot["data"]
    ids = [row["Decklists"][0]["DecklistId"] for row in rows if row.get("Decklists")]

    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        cards_by_id = dict(zip(ids, pool.map(lambda deck_id: fetch_deck(deck_id, cache, args.refresh), ids)))

    decks = []
    for row in rows:
        player = row["Team"]["Players"][0]
        decklist = row.get("Decklists", [])
        raw_name = decklist[0]["DecklistName"] if decklist else "Unreported"
        deck_id = decklist[0]["DecklistId"] if decklist else None
        cards = cards_by_id.get(deck_id, {"main": [], "side": []})
        decks.append({
            "rank": row["Rank"],
            "player": player["DisplayName"],
            "record": row["MatchRecord"],
            "points": row["Points"],
            "archetype": normalize(raw_name),
            "rawArchetype": raw_name,
            "decklistId": deck_id,
            "decklistUrl": f"https://melee.gg/Decklist/View/{deck_id}" if deck_id else None,
            "main": cards["main"],
            "side": cards["side"],
        })

    output = {
        "event": {
            "name": "Paupergenesis 2026",
            "date": "2026-07-12",
            "location": "Pikesville, Maryland",
            "meleeUrl": EVENT_URL,
            "players": len(rows),
            "decklists": sum(bool(deck["decklistId"]) for deck in decks),
            "snapshot": "2026-07-12",
        },
        "decks": decks,
    }
    (root / "paupergenesis-data.json").write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
    print(f"Wrote {len(decks)} players and {output['event']['decklists']} decklists")


if __name__ == "__main__":
    main()
