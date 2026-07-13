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


def canonical_names(root: Path) -> dict[str, str]:
    oracle_path = root.parents[1] / "mtg" / "collection" / "oracle-cards.json"
    if not oracle_path.exists():
        return {}
    cards = json.loads(oracle_path.read_text())
    return {str(card["name"]).casefold(): str(card["name"]) for card in cards if card.get("name")}


def normalize_cards(cards: list[dict], names: dict[str, str]) -> list[dict]:
    combined: dict[str, int] = {}
    for card in cards:
        raw_name = str(card["name"]).strip()
        name = names.get(raw_name.casefold(), raw_name)
        combined[name] = combined.get(name, 0) + int(card["quantity"])
    return [{"name": name, "quantity": quantity} for name, quantity in combined.items()]


def main() -> None:
    root = Path(__file__).resolve().parents[1]
    archive = root / ".cache" / ARCHIVE_NAME
    names = canonical_names(root)
    decks = []
    with zipfile.ZipFile(io.BytesIO(archive.read_bytes())) as source:
        for member in sorted(name for name in source.namelist() if name.endswith(".txt")):
            parts = Path(member).parts
            main, side = parse_cards(source.read(member).decode("utf-8-sig", "replace"))
            decks.append({
                "source": Path(member).stem,
                "archetype": display_archetype(parts[-2]),
                "main": normalize_cards(main, names),
                "side": normalize_cards(side, names),
            })

    output = {"event": {"players": len(decks), "decklists": len(decks)}, "decks": decks}
    destination = root / "paupergeddon-data.json"
    destination.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
    print(f"Wrote {len(decks)} decks to {destination}")


if __name__ == "__main__":
    main()
