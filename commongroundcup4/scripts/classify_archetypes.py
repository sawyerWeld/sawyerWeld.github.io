#!/usr/bin/env python3
"""Classify Common Ground Cup decklists against the Genesis 2026 field."""

from __future__ import annotations

import json
import math
import re
import urllib.request
from pathlib import Path


TID = "the-4th-common-ground-cup-presented-by-the-common-ground"
PLAYERS_URL = f"https://topdeck.gg/PublicPData/{TID}"

# Lists below this threshold are novel brews that need a human-readable label.
MANUAL_LABELS = {
    "Andrew wong": "Rakdos Allies",
    "Bobby Fine": "Spiritualist Combo",
    "Chaz Anderson": "Jund Reanimator",
    "Drew Underwood": "Izzet Terror",
    "Jacob Gherardi": "Dimir Teachings",
    "Jeremiah Vongswady": "Naya Gates",
    "John C.": "Mono Blue Tempo",
    "Joseph Gherardi": "Esper Affinity",
    "Keaton Jones": "Temur Tokens",
    "Liam Onorati": "Mono White Heroic",
    "Lucien Sigler": "Naya Gates",
    "Riean Onorati": "Dimir Enchantments",
    "Rowan Onorati": "Mono Black Poison",
    "Ryan Adams": "Izzet Terror",
    "Sig": "Esper Affinity",
    "Sonny Sadikovic": "Turbofog Tron",
    "Adrian Trogler": "Dimir Affinity",
    "Travis Hallmark": "Dimir Affinity",
}

TOP_CUT = [
    "Ace Braswell",
    "Ankylosaur",
    "Daniel W Brannen",
    "derrick smith",
    "Houston Daniel",
    "Karl Schroeder",
    "Kyle Brewerton",
    "Nathaniel S Vowell",
]


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "sawyerwelden.com tournament report"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def topdeck_mainboard(raw: str | None) -> dict[str, int]:
    text = (raw or "").replace("\\n", "\n").replace("\\'", "'")
    mainboard = text.split("~~Sideboard~~", 1)[0]
    cards: dict[str, int] = {}
    for line in mainboard.splitlines():
        match = re.fullmatch(r"(\d+)\s+(.+?)\s*", line)
        if match:
            cards[match.group(2)] = int(match.group(1))
    return cards


def genesis_mainboard(deck: dict) -> dict[str, int]:
    return {card["name"]: int(card["quantity"]) for card in deck["main"]}


def cosine_similarity(left: dict[str, int], right: dict[str, int]) -> float:
    if not left or not right:
        return 0
    dot_product = sum(copies * right.get(card, 0) for card, copies in left.items())
    left_length = math.sqrt(sum(copies * copies for copies in left.values()))
    right_length = math.sqrt(sum(copies * copies for copies in right.values()))
    return dot_product / (left_length * right_length)


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    genesis_path = root.parent / "paupergenesis2026" / "paupergenesis-data.json"
    output_path = root / "archetypes.json"

    public_players = fetch_json(PLAYERS_URL)
    genesis_decks = json.loads(genesis_path.read_text())["decks"]
    reference_decks = [
        (deck["archetype"], genesis_mainboard(deck))
        for deck in genesis_decks
        if deck.get("main") and deck.get("archetype") not in {None, "Unreported"}
    ]

    by_uid: dict[str, str] = {}
    by_name: dict[str, str] = {}
    for uid, player in public_players.items():
        name = player.get("name") or uid
        mainboard = topdeck_mainboard(player.get("decklist"))
        if not mainboard:
            continue
        nearest_label, _ = max(
            (
                (archetype, cosine_similarity(mainboard, reference))
                for archetype, reference in reference_decks
            ),
            key=lambda item: item[1],
        )
        label = MANUAL_LABELS.get(name, nearest_label)
        by_uid[uid] = label
        by_name[name] = label

    # TopDeck contains a second, matchless Parker Daniels record. Applying the
    # submitted Parker list's label by name keeps that duplicate from appearing
    # as an invented archetype while the match builder censors it at Round 0.
    if "Parker Daniels" in by_name:
        for uid, player in public_players.items():
            if player.get("name") == "Parker Daniels":
                by_uid.setdefault(uid, by_name["Parker Daniels"])

    output = {"byUid": by_uid, "byName": by_name, "topCut": TOP_CUT}
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(by_uid)} player labels across {len(set(by_uid.values()))} archetypes.")


if __name__ == "__main__":
    main()
