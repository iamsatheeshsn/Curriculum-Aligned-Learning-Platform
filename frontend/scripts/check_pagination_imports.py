from pathlib import Path
import re

root = Path("frontend/apps")
broken = []
for p in root.rglob("*.tsx"):
    t = p.read_text(encoding="utf-8", errors="ignore")
    if "useClientPagination" not in t and "PaginationBar" not in t:
        continue
    m = re.search(r"import \{([^}]+)\} from '@stemora/ui'", t, re.S)
    if not m:
        broken.append(f"{p}: no @stemora/ui import match")
        continue
    names = m.group(1)
    if "useClientPagination" in t and "useClientPagination" not in names:
        broken.append(f"{p}: missing useClientPagination import")
    if "<PaginationBar" in t and "PaginationBar" not in names:
        broken.append(f"{p}: missing PaginationBar import")

print("broken", len(broken))
for b in broken:
    print(b)
