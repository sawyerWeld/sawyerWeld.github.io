#!/usr/bin/env python3
"""Build the static Paupergeddon report dataset from official deck archives."""

from __future__ import annotations

import io
import json
import re
import zipfile
from pathlib import Path


ARCHIVE_NAME = "Paupergeddon Summer2026 - Decklists - Day1.zip"
CARD_LINE = re.compile(r"^(\d+)\s+(.+?)\s*$")
NEW_CARD_TYPES = {
    "ant-man's army": "Creature", "call damage control": "Sorcery",
    "crossover collaboration": "Instant", "go nuts!": "Sorcery",
    "guerrilla gorilla": "Creature", "hydra assault robot": "Creature",
    "hawkeye's bow": "Artifact", "minion missile": "Sorcery",
    "songbird, sonic screamer": "Creature", "spider-man, web-spinner": "Creature",
    "ultimate alliance": "Instant", "undercover skrull": "Creature",
    "vision of love": "Instant", "wall off": "Instant",
}


def display_archetype(folder: str) -> str:
    return folder.replace("_", " ").replace("White weenie", "White Weenie")


def parse_cards(text: str) -> tuple[list[dict], list[dict]]:
    sections = re.split(r"\r?\n\s*\r?\n", text.strip(), maxsplit=1)

    def parse_section(section: str) -> list[dict]:
        cards = []
        for line in section.splitlines():
            match = CARD_LINE.match(line.strip())
            if match:
                cards.append({"name": match.group(2), "quantity": int(match.group(1))})
        return cards

    return parse_section(sections[0]), parse_section(sections[1]) if len(sections) > 1 else []


def card_metadata(root: Path) -> dict[str, tuple[str, str]]:
    oracle_path = root.parents[1] / "mtg" / "collection" / "oracle-cards.json"
    if not oracle_path.exists():
        return {}
    cards = json.loads(oracle_path.read_text())
    metadata = {
        str(card["name"]).casefold(): (str(card["name"]), classify_type(str(card.get("type_line") or "")))
        for card in cards if card.get("name")
    }
    metadata.update({name: ("", card_type) for name, card_type in NEW_CARD_TYPES.items()})
    return metadata


def classify_type(type_line: str) -> str:
    for card_type in ("Land", "Creature", "Artifact", "Enchantment", "Instant", "Sorcery"):
        if card_type in type_line:
            return card_type
    return "Other"


def normalize_cards(cards: list[dict], metadata: dict[str, tuple[str, str]]) -> list[dict]:
    combined: dict[str, dict] = {}
    for card in cards:
        raw_name = str(card["name"]).strip()
        canonical_name, card_type = metadata.get(raw_name.casefold(), (raw_name, "Other"))
        name = canonical_name or raw_name
        item = combined.setdefault(name, {"name": name, "quantity": 0, "type": card_type})
        item["quantity"] += int(card["quantity"])
    return list(combined.values())


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    archive = root / ".cache" / ARCHIVE_NAME
    metadata = card_metadata(root)
    decks = []
    with zipfile.ZipFile(io.BytesIO(archive.read_bytes())) as source:
        for member in sorted(name for name in source.namelist() if name.endswith(".txt")):
            parts = Path(member).parts
            main, side = parse_cards(source.read(member).decode("utf-8-sig", "replace"))
            decks.append({
                "source": Path(member).stem,
                "archetype": display_archetype(parts[-2]),
                "main": normalize_cards(main, metadata),
                "side": normalize_cards(side, metadata),
            })

    output = {"event": {"players": len(decks), "decklists": len(decks)}, "decks": decks}
    destination = root / "paupergeddon-data.json"
    destination.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
    print(f"Wrote {len(decks)} decks to {destination}")


if __name__ == "__main__":
    main()
