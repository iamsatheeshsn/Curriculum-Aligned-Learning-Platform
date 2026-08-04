"""Pagination for lists that use non-`rows` state names or alternate map signatures."""

from __future__ import annotations

import re
from pathlib import Path

FILES = [
    # (path, state_var, map_pattern_group_name for item)
    (
        Path(r"apps/control/src/features/audit/ActivityLogsPage.tsx"),
        "rows",
        r"rows\.map\(\(row, index\)",
        r"listPage.pageItems.map((row, index)",
    ),
    (
        Path(r"apps/control/src/features/audit/LoginHistoryPage.tsx"),
        "rows",
        r"rows\.map\(\(row, index\)",
        r"listPage.pageItems.map((row, index)",
    ),
    (
        Path(r"apps/control/src/features/audit/AuditLogsPage.tsx"),
        "rows",
        r"rows\.map\(\(row, index\)",
        r"listPage.pageItems.map((row, index)",
    ),
    (
        Path(r"apps/control/src/features/integrations/IntegrationsWorkspace.tsx"),
        "filteredRows",
        r"filteredRows\.map\(\(row\)",
        r"listPage.pageItems.map((row)",
    ),
    (
        Path(r"apps/control/src/features/super-admin/SchoolGroupsPage.tsx"),
        "groups",
        r"groups\.map\(\(row\)",
        r"listPage.pageItems.map((row)",
    ),
    (
        Path(r"apps/control/src/features/super-admin/CampusesPage.tsx"),
        "campuses",
        r"campuses\.map\(\(row\)",
        r"listPage.pageItems.map((row)",
    ),
]

ROOT = Path(__file__).resolve().parents[1]


def patch_ui_import(text: str) -> str:
    if "useClientPagination" in text and "PaginationBar" in text:
        # may still need import if only one present
        pass
    m = re.search(r"import \{\n(?P<body>.*?)\n\} from '@stemora/ui';", text, re.S)
    if not m:
        return text
    lines = [ln.strip().rstrip(",") for ln in m.group("body").splitlines() if ln.strip()]
    insert_at = 0
    for i, ln in enumerate(lines):
        if ln == "Button":
            insert_at = i + 1
            break
    for name in ("PaginationBar", "useClientPagination"):
        if name not in lines:
            lines.insert(insert_at, name)
            insert_at += 1
    formatted = ",\n".join(f"  {n}" for n in lines)
    return text[: m.start()] + f"import {{\n{formatted},\n}} from '@stemora/ui';" + text[m.end() :]


def main() -> None:
    for rel, state, map_pat, map_repl in FILES:
        path = ROOT / rel
        if not path.exists():
            print("missing", rel)
            continue
        text = path.read_text(encoding="utf-8")
        if f"useClientPagination({state})" in text:
            print("skip", rel)
            continue

        # detect actual map patterns
        if not re.search(map_pat, text):
            # try alternate patterns
            alts = [
                (rf"{state}\.map\(\(row\)", f"listPage.pageItems.map((row)"),
                (rf"{state}\.map\(\(g\)", f"listPage.pageItems.map((g)"),
                (rf"{state}\.map\(\(c\)", f"listPage.pageItems.map((c)"),
                (rf"{state}\.map\(\(group\)", f"listPage.pageItems.map((group)"),
                (rf"{state}\.map\(\(campus\)", f"listPage.pageItems.map((campus)"),
            ]
            found = False
            for ap, ar in alts:
                if re.search(ap, text):
                    map_pat, map_repl = ap, ar
                    found = True
                    break
            if not found:
                print("no-map", rel, state)
                # show map-like lines
                for line in text.splitlines():
                    if ".map((" in line and state in line:
                        print("  hint:", line.strip()[:120])
                continue

        text = patch_ui_import(text)
        if f"const listPage = useClientPagination({state})" not in text:
            hook = f"  const listPage = useClientPagination({state});\n\n"
            m = re.search(r"\n  return \(\n    <div", text)
            if not m:
                print("no-return", rel)
                continue
            text = text[: m.start() + 1] + hook + text[m.start() + 1 :]

        text, n = re.subn(map_pat, map_repl, text, count=1)
        if n == 0:
            print("map-fail", rel)
            continue

        if "<PaginationBar" not in text:
            bar = (
                "          <PaginationBar\n"
                "            page={listPage.page}\n"
                "            lastPage={listPage.lastPage}\n"
                "            total={listPage.total}\n"
                "            onPageChange={listPage.setPage}\n"
                "            disabled={loading}\n"
                "          />\n"
            )
            m = re.search(r"(</table>\r?\n[ \t]*</div>\r?\n)([ \t]*</Panel>)", text)
            if m:
                text = text[: m.start(1)] + m.group(1) + bar + m.group(2) + text[m.end() :]
            else:
                print("no-pager-anchor", rel)

        path.write_text(text, encoding="utf-8", newline="\n")
        print("ok", rel)


if __name__ == "__main__":
    main()
