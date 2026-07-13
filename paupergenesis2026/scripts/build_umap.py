#!/usr/bin/env python3
"""Precompute an archetype-labeled UMAP for the static report."""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--explorer-root", type=Path)
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    explorer = (args.explorer_root or root.parents[1] / "mtgtop8-pca").resolve()
    sys.path.insert(0, str(explorer / ".deps"))
    sys.path.insert(0, str(explorer))
    import app as deck_explorer

    payload = json.loads((root / "paupergenesis-data.json").read_text())
    decks = payload["decks"]
    aliases = deck_explorer.parse_aliases(
        "Dorks: Llanowar Elves, Fyndhorn Elves, Elvish Mystic\n"
        "Helix: Retraction Helix, Banishing Knack",
        snow_basics_as_basics=True,
    )

    records = []
    for index, deck in enumerate(decks):
        for card in deck["main"]:
            records.append({
                "deck": index,
                "card": deck_explorer.canonical_card_name(card["name"], aliases),
                "copies": card["quantity"],
            })
    frame = pd.DataFrame(records)
    matrix = frame.pivot_table(index="deck", columns="card", values="copies", aggfunc="sum", fill_value=0)
    matrix = matrix.reindex(range(len(decks)), fill_value=0).astype(float)
    weighted = deck_explorer.weighted_card_matrix(matrix, "counts_idf")
    present = (matrix > 0).sum(axis=0)
    features = weighted.loc[:, (present >= 2) & (weighted.var(axis=0) > 0)]
    coords, _, _, projection_meta = deck_explorer.projection_for_features(features.values, "umap_braycurtis")
    coords, duplicate_meta = deck_explorer.snap_duplicate_feature_coords(coords, features)
    archetype_counts = Counter(deck["archetype"] for deck in decks)
    label_candidates = [(name, count) for name, count in archetype_counts.most_common() if count >= 5]
    labeled_archetypes = [
        {"name": name, "count": count, "colorIndex": color_index}
        for color_index, (name, count) in enumerate(label_candidates)
    ]
    archetype_colors = {item["name"]: item["colorIndex"] for item in labeled_archetypes}

    points = []
    for index, deck in enumerate(decks):
        points.append({
            "x": round(float(coords[index, 0]), 5),
            "y": round(float(coords[index, 1]), 5),
            "colorIndex": archetype_colors.get(deck["archetype"], -1),
            "rank": deck["rank"],
            "player": deck["player"],
            "archetype": deck["archetype"],
            "record": deck["record"],
            "url": deck["decklistUrl"],
        })

    output = {
        "meta": {
            "projection": projection_meta["projection_label"],
            "weighting": "Counts + IDF",
            "scope": "Main deck",
            "features": int(features.shape[1]),
            "grouping": "Reported archetype",
            "minimumLabelSize": 5,
            "labeledArchetypes": labeled_archetypes,
            **duplicate_meta,
        },
        "points": points,
    }
    (root / "paupergenesis-umap.json").write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
    print(f"Wrote {len(points)} points, {len(labeled_archetypes)} labeled archetypes, {features.shape[1]} features")


if __name__ == "__main__":
    main()
