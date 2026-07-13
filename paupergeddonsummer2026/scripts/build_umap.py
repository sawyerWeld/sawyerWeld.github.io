#!/usr/bin/env python3
"""Build a full-field Paupergeddon UMAP from the official Day 1 archive."""

from __future__ import annotations

import argparse
import io
import json
import re
import sys
import zipfile
from collections import Counter
from pathlib import Path
from urllib.parse import quote
from urllib.request import urlopen

import pandas as pd


ARCHIVE_NAME = "Paupergeddon Summer2026 - Decklists - Day1.zip"
ARCHIVE_BASE = "https://www.paupergeddon.com/Stats/Paupergeddon_0726/"
CARD_LINE = re.compile(r"^(\d+)\s+(.+?)\s*$")


def display_archetype(folder: str) -> str:
    words = folder.replace("_", " ").split()
    small_words = {"weenie": "Weenie"}
    return " ".join(small_words.get(word, word) for word in words)


def read_archive(cache_path: Path) -> bytes:
    if cache_path.exists():
        return cache_path.read_bytes()
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    data = urlopen(ARCHIVE_BASE + quote(ARCHIVE_NAME), timeout=120).read()
    cache_path.write_bytes(data)
    return data


def parse_main_deck(text: str) -> list[tuple[str, int]]:
    main_text = re.split(r"\r?\n\s*\r?\n", text.strip(), maxsplit=1)[0]
    cards = []
    for line in main_text.splitlines():
        match = CARD_LINE.match(line.strip())
        if match:
            cards.append((match.group(2), int(match.group(1))))
    return cards


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--explorer-root", type=Path)
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    explorer = (args.explorer_root or root.parents[1] / "mtgtop8-pca").resolve()
    sys.path.insert(0, str(explorer / ".deps"))
    sys.path.insert(0, str(explorer))
    import app as deck_explorer

    archive = read_archive(root / ".cache" / ARCHIVE_NAME)
    decks = []
    with zipfile.ZipFile(io.BytesIO(archive)) as source:
        for member in sorted(name for name in source.namelist() if name.endswith(".txt")):
            parts = Path(member).parts
            archetype = display_archetype(parts[-2])
            cards = parse_main_deck(source.read(member).decode("utf-8-sig", "replace"))
            decks.append({"source": Path(member).stem, "archetype": archetype, "cards": cards})

    aliases = deck_explorer.parse_aliases(
        "Dorks: Llanowar Elves, Fyndhorn Elves, Elvish Mystic\n"
        "Helix: Retraction Helix, Banishing Knack",
        snow_basics_as_basics=True,
    )
    records = [
        {
            "deck": index,
            "card": deck_explorer.canonical_card_name(card, aliases),
            "copies": copies,
        }
        for index, deck in enumerate(decks)
        for card, copies in deck["cards"]
    ]
    frame = pd.DataFrame(records)
    matrix = frame.pivot_table(index="deck", columns="card", values="copies", aggfunc="sum", fill_value=0)
    matrix = matrix.reindex(range(len(decks)), fill_value=0).astype(float)
    weighted = deck_explorer.weighted_card_matrix(matrix, "counts_idf")
    present = (matrix > 0).sum(axis=0)
    features = weighted.loc[:, (present >= 2) & (weighted.var(axis=0) > 0)]
    coords, _, _, projection_meta = deck_explorer.projection_for_features(features.values, "umap_braycurtis")
    coords, duplicate_meta = deck_explorer.snap_duplicate_feature_coords(coords, features)

    archetype_counts = Counter(deck["archetype"] for deck in decks)
    minimum_label_size = 20
    label_candidates = [
        (name, count)
        for name, count in archetype_counts.most_common()
        if count >= minimum_label_size and name != "Others"
    ]
    labeled_archetypes = [
        {"name": name, "count": count, "colorIndex": color_index}
        for color_index, (name, count) in enumerate(label_candidates)
    ]
    archetype_colors = {item["name"]: item["colorIndex"] for item in labeled_archetypes}
    points = [
        {
            "x": round(float(coords[index, 0]), 5),
            "y": round(float(coords[index, 1]), 5),
            "colorIndex": archetype_colors.get(deck["archetype"], -1),
            "archetype": deck["archetype"],
            "source": deck["source"],
        }
        for index, deck in enumerate(decks)
    ]
    output = {
        "meta": {
            "projection": projection_meta["projection_label"],
            "weighting": "Counts + IDF",
            "scope": "Main deck",
            "features": int(features.shape[1]),
            "grouping": "Official archetype",
            "minimumLabelSize": minimum_label_size,
            "labeledArchetypes": labeled_archetypes,
            **duplicate_meta,
        },
        "points": points,
    }
    (root / "paupergeddon-umap.json").write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
    print(f"Wrote {len(points)} points, {len(labeled_archetypes)} labeled archetypes, {features.shape[1]} features")


if __name__ == "__main__":
    main()
