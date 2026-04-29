#!/usr/bin/env python3
"""
setup-bba-org.py — Full BBA Paperclip org setup (24 agents)
Run: python3 ops/scripts/setup-bba-org.py
Safe to re-run: skips existing routines, updates existing agents.
"""
import json, subprocess, sys, os, stat
from pathlib import Path

BASE       = "http://localhost:3100/api"
COMPANY_ID = "159ab843-22f7-4a60-9864-0556ea0b3ef2"
PROJECT_ID = "3ace8247-a04b-4f9f-aeeb-ad239c12807b"
REPO       = Path(__file__).resolve().parents[2]
SCRIPTS    = REPO / "ops" / "scripts"
CONFIG     = REPO / "ops" / ".routines-config.json"
LAUNCH_DIR = Path.home() / "Library" / "LaunchAgents"
AGENTS_DIR = Path.home() / ".paperclip-bba/instances/default/companies" / COMPANY_ID / "agents"

# ── API helper ────────────────────────────────────────────────────────────────

def api(method, path, body=None):
    cmd = ["curl", "-sf", "-X", method, f"{BASE}{path}",
           "-H", "Content-Type: application/json"]
    if body:
        cmd += ["-d", json.dumps(body)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.stderr and "error" in r.stderr.lower():
        print(f"    [API ERR] {method} {path}: {r.stderr[:200]}")
    try:
        data = json.loads(r.stdout) if r.stdout.strip() else None
        if data and "error" in (data if isinstance(data, dict) else {}):
            print(f"    [API ERR] {data['error']}: {data.get('details','')}")
            return None
        return data
    except:
        return None

def get_agents():
    return {a["name"]: a for a in (api("GET", f"/companies/{COMPANY_ID}/agents") or [])}

def get_routines():
    return {r["assigneeAgentId"]: r for r in (api("GET", f"/companies/{COMPANY_ID}/routines") or [])}

# ── Agent definitions ─────────────────────────────────────────────────────────
# "existing_id" = reuse this agent; "current_name" = rename from this name
# "manager_ref" = key into AGENTS list to resolve reportsTo after creation

AGENTS = [
    # Layer 1: CEO
    {"key": "johnson", "name": "Johnson", "title": "CEO / Slack Gateway", "role": "ceo",
     "existing_id": "3a0cb4c0-53fb-4229-87c1-b1f02e130ebd", "manager_ref": None,
     "routine_desc": "Route manager escalations to George via Slack DM. Filter, synthesise, chase."},

    # Layer 2: Managers
    {"key": "content_manager", "name": "Content Manager", "title": "Content Team Lead", "role": "pm",
     "manager_ref": "johnson",
     "routine_desc": "Daily content team standup. Check KPIs, chase blockers, update team doc."},
    {"key": "website_manager", "name": "Website Manager", "title": "Website Strategy Lead", "role": "pm",
     "manager_ref": "johnson",
     "routine_desc": "Weekly website review. Read analyst data, delegate tasks, enforce QA gate."},
    {"key": "outbound_manager", "name": "Outbound Manager", "title": "Outbound Sales Lead", "role": "pm",
     "manager_ref": "johnson",
     "routine_desc": "Daily outbound check. Maximise Instantly sending, review campaign performance."},
    {"key": "analytics_manager", "name": "Analytics Manager", "title": "Performance Intelligence", "role": "pm",
     "manager_ref": "johnson",
     "routine_desc": "Distribute analytics data to managers. Flag reporting improvements."},
    {"key": "hiring_qa_manager", "name": "Hiring and QA Manager", "title": "Team Quality Lead", "role": "pm",
     "manager_ref": "johnson",
     "routine_desc": "Weekly agent quality review. Audit skills, recommend improvements."},
    {"key": "software_manager", "name": "Software Manager", "title": "Software Team Lead (Placeholder)", "role": "pm",
     "manager_ref": "johnson",
     "routine_desc": "Placeholder. No active agents yet."},

    # Layer 3: Content Team
    {"key": "blog_writer", "name": "Blog Writer", "title": "SEO Blog Writer", "role": "general",
     "existing_id": "1b609cf0-f26f-4c02-b288-ff1316788159", "manager_ref": "content_manager",
     "routine_desc": "Pull from content calendar, write SEO blog posts. SETUP_MODE until calendar approved."},
    {"key": "pipeline_engineer", "name": "Pipeline Engineer", "title": "Video Processing", "role": "general",
     "existing_id": "ca082a66-f620-4b0c-a893-7e2aba08d636", "current_name": "Content Inventory",
     "manager_ref": "content_manager",
     "routine_desc": "Scan Google Drive for new videos. Process, transcribe, generate content options."},
    {"key": "copywriter", "name": "Copywriter", "title": "Brand Voice Auditor", "role": "general",
     "existing_id": "1909e5d1-4ff2-4c54-a563-7a2bfc4d1a2c", "manager_ref": "content_manager",
     "routine_desc": "Brand voice audit on all content. Read voice.md, flag issues, update rules."},
    {"key": "content_strategist", "name": "Content Strategist", "title": "Content Planning", "role": "general",
     "existing_id": "ef91dbbd-0453-4247-acf3-32b6a09984f9", "manager_ref": "content_manager",
     "routine_desc": "Weekly topic suggestions + fortnightly full content calendar."},
    {"key": "queue_sentinel", "name": "Queue Sentinel", "title": "Buffer Queue Monitor", "role": "general",
     "manager_ref": "content_manager",
     "routine_desc": "Daily Buffer queue check. Alert if YouTube queue drops below 3."},
    {"key": "content_analyst", "name": "Content Analyst", "title": "Content Performance Analyst", "role": "researcher",
     "manager_ref": "content_manager",
     "routine_desc": "Weekly YouTube performance analysis. Identify what titles, hooks, subjects, and formats are working. Feed insights to Content Strategist."},
    {"key": "question_master", "name": "Question Master", "title": "Ambiguity Resolver", "role": "general",
     "manager_ref": "content_manager",
     "routine_desc": "Resolve ambiguity for content team agents. Route questions to George via Johnson."},

    # Layer 3: Website Team
    {"key": "website_analyst", "name": "Website Analyst", "title": "CRO Investigator", "role": "general",
     "existing_id": "e3d818f0-9594-46ff-8879-aeecccbbdfda", "current_name": "Website Review",
     "manager_ref": "website_manager",
     "routine_desc": "Weekly GA4 + Clarity CRO report with 3 actionable tasks."},
    {"key": "uiux_designer", "name": "UI/UX Designer", "title": "Design Recommendations", "role": "general",
     "manager_ref": "website_manager",
     "routine_desc": "Produce design recommendations and visual specs for website tasks."},
    {"key": "web_developer", "name": "Web Developer", "title": "Website Implementation", "role": "general",
     "manager_ref": "website_manager",
     "routine_desc": "Implement website changes in staging. Iterate with QA Agent."},
    {"key": "qa_agent", "name": "QA Agent", "title": "Pre-Deploy QA", "role": "general",
     "manager_ref": "website_manager",
     "routine_desc": "Review staging for broken elements, responsive issues, design consistency."},

    # Layer 3: Outbound Team
    {"key": "campaign_builder", "name": "Campaign Builder", "title": "Cold Email Architect", "role": "general",
     "existing_id": "d054ce54-9202-45c6-a070-e50b074f9aed", "manager_ref": "outbound_manager",
     "routine_desc": "Write cold email sequences with spintax. Create campaigns in Instantly."},
    {"key": "campaign_monitor", "name": "Campaign Monitoring Agent", "title": "Instantly Tracker", "role": "general",
     "existing_id": "03e516a6-4308-4156-95a2-36bfe850f319", "current_name": "Hot Lead Monitor",
     "manager_ref": "outbound_manager",
     "routine_desc": "Track Instantly responses every 4 hours. Report interested leads."},
    {"key": "apollo_list_builder", "name": "Apollo List Builder", "title": "Lead List Manager", "role": "general",
     "manager_ref": "outbound_manager",
     "routine_desc": "Create Apollo saved searches, manage credits, deduplicate against Instantly."},

    # Layer 3: Analytics Team
    {"key": "morning_brief", "name": "Morning Brief", "title": "Daily Intelligence Officer", "role": "researcher",
     "existing_id": "9a7feac8-092e-4f8e-8d79-efd49fbe46eb", "manager_ref": "analytics_manager",
     "routine_desc": "Daily intelligence brief. Pull Instantly, YouTube, GA4, Clarity stats."},
    {"key": "weekly_ceo_brief", "name": "Weekly/CEO Brief", "title": "Weekly KPI + Strategic Brief", "role": "researcher",
     "existing_id": "e1571b40-9cbd-4f52-b270-0c321f9dc7da", "current_name": "Weekly Analytics",
     "manager_ref": "analytics_manager",
     "routine_desc": "Monday weekly KPIs + Sunday CEO strategic brief with momentum score."},

    # Layer 3: Hiring & QA Team
    {"key": "chief_of_staff", "name": "Chief of Staff", "title": "Weekly Performance Reviewer", "role": "general",
     "existing_id": "5dc2b660-8258-441a-ac19-fe95a647515d", "manager_ref": "hiring_qa_manager",
     "routine_desc": "Sunday agent performance review. Query Paperclip for run data."},
    {"key": "cron_watchdog", "name": "Cron Watchdog", "title": "Infrastructure Monitor", "role": "general",
     "existing_id": "80e11527-9ee5-48d2-b268-3aaf81ae275a", "manager_ref": "hiring_qa_manager",
     "routine_desc": "Nightly check that all expected agents ran today."},
]

# Agents to retire
RETIRE_IDS = [
    "2f9d9ecf-77dc-4758-b2b9-c24c9c3c2846",  # Pipeline Chase
    "8e236c6a-6b20-4e91-97cf-5d83160d942b",  # CEO Brief
    "0d8eb859-4cf5-4a97-b8be-a833703de0d4",  # Content Pipeline
    "a7c9d349-2b8d-45f7-88ba-79b5fb4e7e47",  # test-engineer
]

# Routines to clean up
RETIRE_ROUTINES = [
    "cceceeae-a966-4722-9706-9dad3a246527",  # __TEST_ROUTINE__
]

# ── Launchd bundles ───────────────────────────────────────────────────────────

BUNDLES = {
    "morning": {
        "agents": ["morning_brief", "pipeline_engineer"],
        "plist": "com.bba.morning",
        "schedule": {"Hour": 8, "Minute": 0},
        "weekdays": [1, 2, 3, 4, 5],
    },
    "outbound": {
        "agents": ["outbound_manager", "campaign_monitor"],
        "plist": "com.bba.outbound",
        "schedule": {"Hour": 12, "Minute": 0},
    },
    "queue": {
        "agents": ["queue_sentinel"],
        "plist": "com.bba.queue",
        "schedule": {"Hour": 6, "Minute": 0},
    },
    "monday": {
        "agents": ["content_analyst", "weekly_ceo_brief", "content_strategist"],
        "plist": "com.bba.monday",
        "schedule": {"Hour": 8, "Minute": 30},
        "weekdays": [1],
    },
    "sunday": {
        "agents": ["chief_of_staff", "website_analyst", "website_manager",
                    "hiring_qa_manager", "weekly_ceo_brief"],
        "plist": "com.bba.sunday",
        "schedule": {"Hour": 7, "Minute": 0},
        "weekdays": [0],
    },
    "nightly": {
        "agents": ["cron_watchdog"],
        "plist": "com.bba.nightly",
        "schedule": {"Hour": 23, "Minute": 0},
    },
    "campaign_4h": {
        "agents": ["campaign_monitor"],
        "plist": "com.bba.campaign-monitor",
        "interval": 14400,
    },
}

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("BBA Paperclip Org Setup")
    print("=" * 60)

    # Phase 1: Create/update agents (two passes: managers first, then set reportsTo)
    print("\n--- Phase 1: Create/Update Agents ---")
    agent_ids = {}  # key -> agent_id

    for a in AGENTS:
        agent_id = a.get("existing_id")
        payload = {
            "name": a["name"],
            "title": a["title"],
            "role": a["role"],
            "adapterType": "claude_local",
            "adapterConfig": {
                "cwd": "/Users/george/byebyeadmin",
                "dangerouslySkipPermissions": True,
                "instructionsBundleMode": "managed",
                "maxTurnsPerRun": 300,
            },
        }

        if agent_id:
            # Update existing — PATCH doesn't accept adapterType
            patch_payload = {k: v for k, v in payload.items() if k != "adapterType"}
            result = api("PATCH", f"/agents/{agent_id}", patch_payload)
            if result:
                print(f"  Updated: {a['name']} ({agent_id[:8]}...)")
            else:
                print(f"  FAILED to update: {a['name']}")
        else:
            # Create new
            result = api("POST", f"/companies/{COMPANY_ID}/agents", payload)
            if result:
                agent_id = result["id"]
                print(f"  Created: {a['name']} ({agent_id[:8]}...)")
            else:
                print(f"  FAILED to create: {a['name']}")
                continue

        agent_ids[a["key"]] = agent_id

        # Ensure instructions dir exists
        inst_dir = AGENTS_DIR / agent_id / "instructions"
        inst_dir.mkdir(parents=True, exist_ok=True)
        agents_md = inst_dir / "AGENTS.md"
        if not agents_md.exists():
            agents_md.write_text(f"# {a['name']}\n\nInstructions pending. Update via Paperclip UI.\n")
            print(f"    -> Created placeholder AGENTS.md")

    # Phase 1b: Set reportsTo
    print("\n--- Phase 1b: Set Reporting Lines ---")
    for a in AGENTS:
        agent_id = agent_ids.get(a["key"])
        if not agent_id:
            continue
        manager_key = a.get("manager_ref")
        reports_to = agent_ids.get(manager_key) if manager_key else None
        api("PATCH", f"/companies/{COMPANY_ID}/agents/{agent_id}", {"reportsTo": reports_to})
        manager_name = manager_key or "George"
        print(f"  {a['name']} -> {manager_name}")

    # Phase 2: Retire old agents
    print("\n--- Phase 2: Retire Old Agents ---")
    for rid in RETIRE_IDS:
        api("PATCH", f"/agents/{rid}", {"status": "paused", "pauseReason": "Retired in org overhaul"})
        print(f"  Paused: {rid[:8]}...")

    # Phase 3: Clean up old routines
    print("\n--- Phase 3: Clean Up Old Routines ---")
    existing_routines = api("GET", f"/companies/{COMPANY_ID}/routines") or []
    existing_routine_by_agent = {}
    for r in existing_routines:
        existing_routine_by_agent[r["assigneeAgentId"]] = r
        if r["id"] in RETIRE_ROUTINES:
            api("PATCH", f"/companies/{COMPANY_ID}/routines/{r['id']}", {"status": "paused"})
            print(f"  Paused routine: {r['title']}")

    # Phase 4: Create routines + webhooks
    print("\n--- Phase 4: Create Routines + Webhooks ---")
    config = {}

    for a in AGENTS:
        agent_id = agent_ids.get(a["key"])
        if not agent_id:
            continue

        # Check if routine already exists for this agent
        if agent_id in existing_routine_by_agent:
            routine = existing_routine_by_agent[agent_id]
            routine_id = routine["id"]
            # Update title/description
            api("PATCH", f"/companies/{COMPANY_ID}/routines/{routine_id}", {
                "title": a["name"],
                "description": a["routine_desc"],
            })
            # Get existing trigger
            triggers = routine.get("triggers", [])
            if triggers:
                t = triggers[0]
                # We need publicId and secret from existing config
                old_config = {}
                if CONFIG.exists():
                    old_config = json.loads(CONFIG.read_text())
                old_entry = old_config.get(a["key"], {})
                public_id = old_entry.get("publicId", t.get("publicId", ""))
                secret = old_entry.get("webhookSecret", "UNKNOWN")
                config[a["key"]] = {
                    "title": a["name"],
                    "agentId": agent_id,
                    "routineId": routine_id,
                    "publicId": public_id,
                    "webhookSecret": secret,
                }
                print(f"  Reused routine: {a['name']} (existing)")
                continue

        # Create new routine
        routine = api("POST", f"/companies/{COMPANY_ID}/routines", {
            "projectId": PROJECT_ID,
            "title": a["name"],
            "description": a["routine_desc"],
            "assigneeAgentId": agent_id,
            "priority": "high",
            "status": "active",
            "concurrencyPolicy": "skip_if_active",
            "catchUpPolicy": "skip_missed",
        })
        if not routine:
            print(f"  FAILED routine: {a['name']}")
            continue
        routine_id = routine["id"]

        # Create webhook trigger
        trigger = api("POST", f"/routines/{routine_id}/triggers", {
            "kind": "webhook",
            "label": "launchd",
            "signingMode": "bearer",
        })
        if not trigger:
            print(f"  FAILED trigger: {a['name']}")
            continue

        public_id = trigger["trigger"]["publicId"]
        secret = trigger["secretMaterial"]["webhookSecret"]
        config[a["key"]] = {
            "title": a["name"],
            "agentId": agent_id,
            "routineId": routine_id,
            "publicId": public_id,
            "webhookSecret": secret,
        }
        print(f"  Created routine + webhook: {a['name']}")

    # Phase 5: Save config
    print("\n--- Phase 5: Save Config ---")
    CONFIG.write_text(json.dumps(config, indent=2) + "\n")
    print(f"  Wrote {CONFIG}")

    # Phase 6: Generate shell scripts
    print("\n--- Phase 6: Generate Shell Scripts ---")

    def fire_cmd(key):
        c = config.get(key)
        if not c:
            return f"# MISSING config for {key}"
        return (
            f'curl -sf -X POST "http://127.0.0.1:3100/api/routine-triggers/public/{c["publicId"]}/fire" \\\n'
            f'  -H "Authorization: Bearer {c["webhookSecret"]}" \\\n'
            f'  -H "Content-Type: application/json" -d \'{{}}\' &'
        )

    for bundle_name, bundle in BUNDLES.items():
        script_name = f"bba-{bundle_name.replace('_', '-')}.sh"
        script_path = SCRIPTS / script_name
        agent_names = ", ".join(config.get(k, {}).get("title", k) for k in bundle["agents"])
        lines = [
            "#!/bin/bash",
            f"# Bundle: {bundle_name} ({agent_names})",
            f"# Auto-generated by setup-bba-org.py",
            "",
        ]
        for k in bundle["agents"]:
            lines.append(f"# {config.get(k, {}).get('title', k)}")
            lines.append(fire_cmd(k))
            lines.append("")
        lines.append("wait")
        script_path.write_text("\n".join(lines) + "\n")
        script_path.chmod(script_path.stat().st_mode | stat.S_IEXEC)
        print(f"  Wrote {script_name}")

    # Phase 7: Generate launchd plists
    print("\n--- Phase 7: Generate Launchd Plists ---")
    LAUNCH_DIR.mkdir(parents=True, exist_ok=True)

    for bundle_name, bundle in BUNDLES.items():
        plist_id = bundle["plist"]
        script_name = f"bba-{bundle_name.replace('_', '-')}.sh"
        script_path = SCRIPTS / script_name

        if "interval" in bundle:
            calendar = f"    <key>StartInterval</key>\n    <integer>{bundle['interval']}</integer>"
        else:
            sched = bundle["schedule"]
            cal_entries = []
            weekdays = bundle.get("weekdays")
            if weekdays:
                for wd in weekdays:
                    cal_entries.append(
                        f"      <dict>\n"
                        f"        <key>Hour</key><integer>{sched['Hour']}</integer>\n"
                        f"        <key>Minute</key><integer>{sched['Minute']}</integer>\n"
                        f"        <key>Weekday</key><integer>{wd}</integer>\n"
                        f"      </dict>"
                    )
                calendar = (
                    f"    <key>StartCalendarInterval</key>\n"
                    f"    <array>\n" + "\n".join(cal_entries) + "\n    </array>"
                )
            else:
                calendar = (
                    f"    <key>StartCalendarInterval</key>\n"
                    f"    <dict>\n"
                    f"      <key>Hour</key><integer>{sched['Hour']}</integer>\n"
                    f"      <key>Minute</key><integer>{sched['Minute']}</integer>\n"
                    f"    </dict>"
                )

        plist = f"""<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>{plist_id}</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/bash</string>
      <string>{script_path}</string>
    </array>
{calendar}
    <key>StandardOutPath</key>
    <string>/tmp/{plist_id}.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/{plist_id}.err</string>
</dict>
</plist>
"""
        plist_path = LAUNCH_DIR / f"{plist_id}.plist"
        plist_path.write_text(plist)
        print(f"  Wrote {plist_id}.plist")

    # Phase 8: Summary
    print("\n" + "=" * 60)
    print("DONE. Summary:")
    print(f"  Agents: {len(agent_ids)}")
    print(f"  Routines: {len(config)}")
    print(f"  Shell scripts: {len(BUNDLES)}")
    print(f"  Plists: {len(BUNDLES)}")
    print(f"\nConfig saved to: {CONFIG}")
    print(f"\nTo load plists, run:")
    for bundle in BUNDLES.values():
        plist_path = LAUNCH_DIR / f"{bundle['plist']}.plist"
        print(f"  launchctl load {plist_path}")
    print(f"\nTo test Johnson webhook:")
    j = config.get("johnson", {})
    if j:
        print(f'  curl -sf -X POST "http://127.0.0.1:3100/api/routine-triggers/public/{j["publicId"]}/fire" \\')
        print(f'    -H "Authorization: Bearer {j["webhookSecret"]}" \\')
        print(f'    -H "Content-Type: application/json" -d \'{{}}\'')

    # Print agent ID reference
    print(f"\n--- Agent ID Reference ---")
    for a in AGENTS:
        aid = agent_ids.get(a["key"], "???")
        print(f"  {a['key']:25s} {aid}")

if __name__ == "__main__":
    main()
