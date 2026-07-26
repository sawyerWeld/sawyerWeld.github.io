#!/usr/bin/env python3
"""Build a Common Ground Cup 4 survivorship snapshot from public TopDeck data."""

from __future__ import annotations

import argparse
import json
import re
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path


TID = "the-4th-common-ground-cup-presented-by-the-common-ground"
EVENT_URL = f"https://topdeck.gg/event/{TID}"
BRACKET_URL = f"https://topdeck.gg/bracket/{TID}"
FIRESTORE_URL = (
    "https://firestore.googleapis.com/v1/projects/eminence-1b40b/"
    f"databases/(default)/documents/tournaments/{TID}"
)
PLAYERS_URL = f"https://topdeck.gg/PublicPData/{TID}"
SWISS_ROUNDS = 7
TOP_CUT = 8
MAX_POINT_DEFICIT = 5


def fetch_json(url: str) -> dict:
    request = urllib.request.Request(url, headers={"User-Agent": "sawyerwelden.com tournament report"})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def decode_firestore(value):
    if "nullValue" in value:
        return None
    for key in ("stringValue", "timestampValue", "referenceValue"):
        if key in value:
            return value[key]
    for key in ("integerValue", "doubleValue"):
        if key in value:
            return int(value[key]) if key == "integerValue" else float(value[key])
    if "booleanValue" in value:
        return value["booleanValue"]
    if "arrayValue" in value:
        return [decode_firestore(item) for item in value["arrayValue"].get("values", [])]
    if "mapValue" in value:
        return {
            key: decode_firestore(item)
            for key, item in value["mapValue"].get("fields", {}).items()
        }
    raise ValueError(f"Unsupported Firestore value: {value}")


def decode_document(document: dict) -> dict:
    return {key: decode_firestore(value) for key, value in document["fields"].items()}


def load_labels(path: Path) -> dict:
    if not path.exists():
        return {"byUid": {}, "byName": {}, "topCut": []}
    labels = json.loads(path.read_text())
    labels.setdefault("byUid", {})
    labels.setdefault("byName", {})
    labels.setdefault("topCut", [])
    return labels


def archetype_for(uid: str, name: str, labels: dict) -> str:
    return labels["byUid"].get(uid) or labels["byName"].get(name) or "Unclassified"


def table_keys(document: dict, round_number: int) -> list[str]:
    prefix = f"S1:R{round_number}:T"
    keys = [
        key for key in document
        if key.startswith(prefix) and re.fullmatch(rf"S1:R{round_number}:T\d+", key)
    ]
    return sorted(keys, key=lambda key: int(key.rsplit("T", 1)[1]))


def match_result(own_games: int, opponent_games: int) -> str:
    if own_games > opponent_games:
        return "W"
    if own_games < opponent_games:
        return "L"
    return "D"


def record_text(record: dict[str, int]) -> str:
    return f"{record['wins']}-{record['losses']}-{record['draws']}"


def game_record_text(record: dict[str, int]) -> str:
    return f"{record['gameWins']}-{record['gameLosses']}-{record['gameDraws']}"


def point_deficit(record: dict[str, int]) -> int:
    return record["losses"] * 3 + record["draws"] * 2


def match_win_percentage(record: dict[str, int]) -> float:
    matches = record["wins"] + record["losses"] + record["draws"]
    return (record["wins"] * 3 + record["draws"]) / (matches * 3) if matches else 0


def game_win_percentage(record: dict[str, int]) -> float:
    games = record["gameWins"] + record["gameLosses"] + record["gameDraws"]
    return (record["gameWins"] * 3 + record["gameDraws"]) / (games * 3) if games else 0


def opponent_average(
    uid: str,
    round_number: int,
    players: dict[str, dict],
    records: dict[str, dict],
    percentage,
) -> float:
    opponent_ids = [
        item["opponentId"]
        for item in players[uid]["rounds"]
        if item["round"] <= round_number and item.get("opponentId") in records
    ]
    if not opponent_ids:
        return 0
    return sum(max(1 / 3, percentage(records[opponent_id])) for opponent_id in opponent_ids) / len(opponent_ids)


def standing_rows(
    round_number: int,
    players: dict[str, dict],
    records: dict[str, dict],
) -> dict[str, dict]:
    rows = {}
    for uid, record in records.items():
        rows[uid] = {
            "points": record["wins"] * 3 + record["draws"],
            "matchRecord": record_text(record),
            "gameRecord": game_record_text(record),
            "omw": opponent_average(
                uid, round_number, players, records, match_win_percentage
            ),
            "gw": max(1 / 3, game_win_percentage(record)) if (
                record["gameWins"] + record["gameLosses"] + record["gameDraws"]
            ) else 0,
            "ogw": opponent_average(
                uid, round_number, players, records, game_win_percentage
            ),
        }
    ordered = sorted(
        rows,
        key=lambda uid: (
            -rows[uid]["points"],
            -rows[uid]["omw"],
            -rows[uid]["gw"],
            -rows[uid]["ogw"],
            players[uid]["name"].casefold(),
        ),
    )
    for rank, uid in enumerate(ordered, 1):
        rows[uid]["rank"] = rank
    return rows


def archetype_rows(uids: set[str], players: dict[str, dict]) -> list[dict]:
    counts = Counter(players[uid]["archetype"] for uid in uids)
    total = len(uids)
    return [
        {"name": name, "count": count, "share": round(count / total * 100, 4) if total else 0}
        for name, count in sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    ]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--labels",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "archetypes.json",
        help="JSON file containing byUid/byName archetype labels and an optional topCut list.",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    output_path = root / "survivorship" / "data" / "common-ground-cup-4-survivorship.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)

    document = decode_document(fetch_json(FIRESTORE_URL))
    public_players = fetch_json(PLAYERS_URL)
    labels = load_labels(args.labels)

    entity_to_uid = {
        int(match.group(1)): uid
        for key, uid in document.items()
        if (match := re.fullmatch(r"E(\d+):P1", key)) and uid != "_x_"
    }
    players = {
        uid: {
            "id": uid,
            "name": row.get("name") or uid,
            "archetype": archetype_for(uid, row.get("name") or uid, labels),
            "rounds": [],
            "failureRound": None,
            "censoredRound": None,
        }
        for uid, row in public_players.items()
        if row.get("CheckedIn", True)
    }
    records = {
        uid: {
            "wins": 0,
            "losses": 0,
            "draws": 0,
            "gameWins": 0,
            "gameLosses": 0,
            "gameDraws": 0,
        }
        for uid in players
    }
    active = set(players)
    completed_rounds = [
        round_number
        for round_number in range(1, SWISS_ROUNDS + 1)
        if document.get(f"S1:R{round_number}:End")
    ]
    snapshots = [{
        "round": 0,
        "atRisk": len(active),
        "failures": 0,
        "censored": 0,
        "survivors": len(active),
        "archetypes": archetype_rows(active, players),
    }]

    for round_number in completed_rounds:
        round_entries: dict[str, dict] = {}
        for key in table_keys(document, round_number):
            table = document[key]
            entities = table.get("Es") or []
            game_wins = table.get("Wins") or []
            if len(entities) != 2 or len(game_wins) != 2:
                continue
            for index, entity in enumerate(entities):
                uid = entity_to_uid.get(int(entity))
                opponent_uid = entity_to_uid.get(int(entities[1 - index]))
                if uid not in players:
                    continue
                result = match_result(int(game_wins[index]), int(game_wins[1 - index]))
                round_entries[uid] = {
                    "round": round_number,
                    "table": int(key.rsplit("T", 1)[1]),
                    "opponentId": opponent_uid,
                    "opponent": players.get(opponent_uid, {}).get("name", "Unknown"),
                    "result": result,
                    "games": f"{game_wins[index]}-{game_wins[1 - index]}-{table.get('Draws', 0)}",
                }

        bye = document.get(f"S1:R{round_number}:TB") or {}
        for entity in bye.get("Es") or []:
            uid = entity_to_uid.get(int(entity))
            if uid in players:
                round_entries[uid] = {
                    "round": round_number,
                    "table": "Bye",
                    "opponentId": None,
                    "opponent": "Bye",
                    "result": "W",
                    "games": "2-0-0",
                }

        for uid, entry in round_entries.items():
            result_key = {"W": "wins", "L": "losses", "D": "draws"}[entry["result"]]
            records[uid][result_key] += 1
            own_games, opponent_games, game_draws = (
                int(value) for value in entry["games"].split("-")
            )
            records[uid]["gameWins"] += own_games
            records[uid]["gameLosses"] += opponent_games
            records[uid]["gameDraws"] += game_draws
            entry["record"] = record_text(records[uid])
            entry["points"] = records[uid]["wins"] * 3 + records[uid]["draws"]
            players[uid]["rounds"].append(entry)

        round_standings = standing_rows(round_number, players, records)
        for uid, entry in round_entries.items():
            entry["standing"] = round_standings[uid]

        at_risk = len(active)
        failures = 0
        censored = 0
        for uid in list(active):
            if uid not in round_entries:
                active.remove(uid)
                players[uid]["censoredRound"] = round_number - 1
                censored += 1
            elif point_deficit(records[uid]) > MAX_POINT_DEFICIT:
                active.remove(uid)
                players[uid]["failureRound"] = round_number
                failures += 1

        snapshots.append({
            "round": round_number,
            "atRisk": at_risk,
            "failures": failures,
            "censored": censored,
            "survivors": len(active),
            "archetypes": archetype_rows(active, players),
        })

    final_standings = standing_rows(SWISS_ROUNDS, players, records)
    standings = sorted(
        players.values(),
        key=lambda player: final_standings[player["id"]]["rank"],
    )
    top_cut_names = set(labels["topCut"])

    output = {
        "event": {
            "name": "The 4th Common Ground Cup",
            "date": "2026-07-25",
            "location": "Columbia, Tennessee",
            "sourceUrl": EVENT_URL,
            "bracketUrl": BRACKET_URL,
            "players": len(players),
            "swissRounds": SWISS_ROUNDS,
            "completedRounds": len(completed_rounds),
            "topCut": TOP_CUT,
            "status": "complete" if len(completed_rounds) == SWISS_ROUNDS else "live",
        },
        "model": {
            "name": "X-1-1 survivorship",
            "description": "A player remains alive while no worse than one loss and one draw from perfect.",
            "formula": "3 * losses + 2 * draws <= 5",
            "maxPointDeficit": MAX_POINT_DEFICIT,
        },
        "labels": {
            "ready": all(player["archetype"] != "Unclassified" for player in players.values()),
            "classified": sum(player["archetype"] != "Unclassified" for player in players.values()),
            "total": len(players),
        },
        "rounds": snapshots,
        "players": [
            {
                **player,
                "final": {
                    **final_standings[player["id"]],
                },
                "topCut": player["name"] in top_cut_names or player["id"] in top_cut_names,
            }
            for player in standings
        ],
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }
    output_path.write_text(json.dumps(output, ensure_ascii=False, separators=(",", ":")))
    print(
        f"Wrote {len(players)} players through round {len(completed_rounds)}; "
        f"{len(active)} remain X-1-1 or better; "
        f"{output['labels']['classified']} archetypes labeled."
    )


if __name__ == "__main__":
    main()
