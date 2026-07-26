#!/usr/bin/env python3
"""Classify Common Ground Cup decklists against the Genesis 2026 field."""

from __future__ import annotations

import json
import math
import re
import urllib.request
from datetime import datetime, timezone
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
    mainboard, _ = topdeck_boards(raw)
    return {card["name"]: card["quantity"] for card in mainboard}


def topdeck_boards(raw: str | None) -> tuple[list[dict], list[dict]]:
    text = (raw or "").replace("\\n", "\n").replace("\\'", "'")
    board = "main"
    cards = {"main": [], "side": []}
    for line in text.splitlines():
        if line == "~~Mainboard~~":
            board = "main"
            continue
        if line == "~~Sideboard~~":
            board = "side"
            continue
        match = re.fullmatch(r"(\d+)\s+(.+?)\s*", line)
        if match:
            cards[board].append({
                "name": match.group(2),
                "quantity": int(match.group(1)),
            })
    return cards["main"], cards["side"]


def genesis_mainboard(deck: dict) -> dict[str, int]:
    return {card["name"]: int(card["quantity"]) for card in deck["main"]}


def cosine_similarity(left: dict[str, int], right: dict[str, int]) -> float:
    if not left or not right:
        return 0
    dot_product = sum(copies * right.get(card, 0) for card, copies in left.items())
    left_length = math.sqrt(sum(copies * copies for copies in left.values()))
    right_length = math.sqrt(sum(copies * copies for copies in right.values()))
    return dot_product / (left_length * right_length)


def card_type(type_line: str) -> str:
    for name in ("Land", "Creature", "Sorcery", "Instant", "Artifact", "Enchantment"):
        if re.search(rf"\b{name}\b", type_line):
            return name
    return "Other"


def fetch_card_types(names: set[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    ordered = sorted(names)
    for offset in range(0, len(ordered), 75):
        payload = json.dumps({
            "identifiers": [{"name": name} for name in ordered[offset:offset + 75]]
        }).encode()
        request = urllib.request.Request(
            "https://api.scryfall.com/cards/collection",
            data=payload,
            headers={
                "Accept": "application/json",
                "Content-Type": "application/json",
                "User-Agent": "sawyerwelden.com tournament report",
            },
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            collection = json.load(response)
        for card in collection.get("data", []):
            result[card["name"]] = card_type(card.get("type_line", ""))
    return result


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    genesis_path = root.parent / "paupergenesis2026" / "paupergenesis-data.json"
    output_path = root / "archetypes.json"
    deck_output_path = root / "survivorship" / "data" / "common-ground-cup-4-decks.json"

    public_players = fetch_json(PLAYERS_URL)
    genesis_decks = json.loads(genesis_path.read_text())["decks"]
    reference_decks = [
        (deck["archetype"], genesis_mainboard(deck))
        for deck in genesis_decks
        if deck.get("main") and deck.get("archetype") not in {None, "Unreported"}
    ]

    by_uid: dict[str, str] = {}
    by_name: dict[str, str] = {}
    parsed_decks: list[dict] = []
    for uid, player in public_players.items():
        name = player.get("name") or uid
        main_cards, side_cards = topdeck_boards(player.get("decklist"))
        mainboard = {card["name"]: card["quantity"] for card in main_cards}
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
        parsed_decks.append({
            "id": uid,
            "player": name,
            "archetype": label,
            "main": main_cards,
            "side": side_cards,
        })

    # TopDeck contains a second, matchless Parker Daniels record. Applying the
    # submitted Parker list's label by name keeps that duplicate from appearing
    # as an invented archetype while the match builder censors it at Round 0.
    if "Parker Daniels" in by_name:
        for uid, player in public_players.items():
            if player.get("name") == "Parker Daniels":
                by_uid.setdefault(uid, by_name["Parker Daniels"])

    output = {"byUid": by_uid, "byName": by_name, "topCut": TOP_CUT}
    output_path.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")

    known_types = {
        card["name"]: card.get("type") or "Other"
        for deck in genesis_decks
        for board in ("main", "side")
        for card in deck[board]
    }
    known_types["Fire // Ice"] = "Instant"
    current_names = {
        card["name"]
        for deck in parsed_decks
        for board in ("main", "side")
        for card in deck[board]
    }
    known_types.update(fetch_card_types(current_names - known_types.keys()))
    for deck in parsed_decks:
        for board in ("main", "side"):
            for card in deck[board]:
                card["type"] = known_types.get(card["name"], "Other")

    deck_output = {
        "decks": sorted(parsed_decks, key=lambda deck: deck["player"].casefold()),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    deck_output_path.write_text(
        json.dumps(deck_output, ensure_ascii=False, separators=(",", ":"))
    )
    print(
        f"Wrote {len(by_uid)} player labels across {len(set(by_uid.values()))} archetypes "
        f"and {len(parsed_decks)} published decklists."
    )


if __name__ == "__main__":
    main()
