#!/usr/bin/env python3
"""Seed Pipeline Generation records from the existing stakeholder model."""

import json
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STAKEHOLDERS_PATH = ROOT / "src/data/stakeholders.json"
ACCOUNTS_PATH = ROOT / "src/data/accounts.json"
OUTPUT_PATH = ROOT / "src/data/pg.json"


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def empty(value: str | None) -> str:
    return value.strip() if isinstance(value, str) and value.strip() else "UNKNOWN"


def main() -> None:
    stakeholders = json.loads(STAKEHOLDERS_PATH.read_text())
    accounts = json.loads(ACCOUNTS_PATH.read_text())
    account_map = {account["id"]: account for account in accounts}
    created = now()
    records = []

    for person in stakeholders:
        if person["accountId"] != "acciona" or person.get("dataOrigin") != "ORIGINAL EXCEL DATA":
            continue
        excel = person.get("excel") or {}
        values = {
            key: empty(excel.get(key))
            for key in ("businessPain", "action", "whyHighTarget", "whyMeet", "howGetMeeting", "comments")
        }
        records.append(
            {
                "id": f"pg-{person['id']}",
                "accountId": person["accountId"],
                "stakeholderId": person["id"],
                "useCaseIds": [],
                "signalIds": [],
                "salesPlay": "UNKNOWN",
                "businessPain": values["businessPain"],
                "action": values["action"],
                "whyHighTarget": values["whyHighTarget"],
                "whyMeet": values["whyMeet"],
                "howGetMeeting": values["howGetMeeting"],
                "accessRoute": "Direct outreach",
                "comments": values["comments"],
                "message": "",
                "messageLang": "es",
                "status": "TARGET",
                "priority": "LOW",
                "priorityIsAuto": True,
                "owner": "Jorge Poyatos",
                "origin": "ORIGINAL EXCEL DATA",
                "createdAt": created,
                "updatedAt": created,
            }
        )

    mapfre_seeds = [
        ("mapfre-marana", "mapfre-ai-centre", "AI Engineering", ["mapfre-uc-3"]),
        ("mapfre-andujar", "mapfre-ai-centre", "AI Engineering", ["mapfre-uc-3"]),
        ("mapfre-wiznez", "mapfre-reef", "Developer Productivity", ["mapfre-uc-1"]),
        ("mapfre-lacave", "mapfre-legacy-modernization", "Legacy Modernization", ["mapfre-uc-2"]),
        ("mapfre-bodas", "mapfre-ai-centre", "AI Engineering", ["mapfre-uc-3"]),
    ]
    mapfre = account_map["mapfre"]
    initiative_ids = {initiative["id"] for initiative in mapfre["initiatives"]}
    use_case_ids = {use_case["id"] for use_case in mapfre["useCases"]}
    for stakeholder_id, initiative_id, play, use_case_list in mapfre_seeds:
        if initiative_id not in initiative_ids:
            raise ValueError(f"Missing MAPFRE initiative: {initiative_id}")
        if not set(use_case_list) <= use_case_ids:
            raise ValueError(f"Missing MAPFRE use case for {stakeholder_id}")
        records.append(
            {
                "id": f"pg-{stakeholder_id}",
                "accountId": "mapfre",
                "stakeholderId": stakeholder_id,
                "initiativeId": initiative_id,
                "useCaseIds": use_case_list,
                "signalIds": [],
                "salesPlay": play,
                "businessPain": "",
                "action": "",
                "whyHighTarget": "",
                "whyMeet": "",
                "howGetMeeting": "",
                "accessRoute": "Direct outreach",
                "comments": "",
                "message": "",
                "messageLang": "es",
                "status": "TARGET",
                "priority": "LOW",
                "priorityIsAuto": True,
                "owner": "Jorge Poyatos",
                "origin": "SALES HYPOTHESIS",
                "createdAt": created,
                "updatedAt": created,
            }
        )

    OUTPUT_PATH.write_text(json.dumps(records, ensure_ascii=False, indent=2) + "\n")
    print(f"Wrote {len(records)} PG records to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
