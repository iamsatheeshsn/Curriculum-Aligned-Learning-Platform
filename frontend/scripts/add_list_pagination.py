"""Add client-side list pagination (10/page) to Control directory pages."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "apps" / "control" / "src" / "features"


def patch_ui_import(text: str) -> str:
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
    new_import = f"import {{\n{formatted},\n}} from '@stemora/ui';"
    return text[: m.start()] + new_import + text[m.end() :]


def insert_hook(text: str) -> tuple[str, bool]:
    if "const listPage = useClientPagination" in text:
        return text, True
    hook = "  const listPage = useClientPagination(rows);\n\n"
    patterns = [
        r"(  return \(\n    <div className=\{`\$\{P\}page`\})",
        r'(  return \(\n    <div className="[^"]*page")',
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            return text[: m.start()] + hook + text[m.start() :], True
    m = re.search(r"\n  return \(\n    <div", text)
    if m:
        return text[: m.start() + 1] + hook + text[m.start() + 1 :], True
    return text, False


def insert_pager(text: str) -> tuple[str, bool]:
    if "<PaginationBar" in text:
        return text, True
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
    if not m:
        return text, False
    return text[: m.start(1)] + m.group(1) + bar + m.group(2) + text[m.end() :], True


def patch_file(path: Path) -> str | None:
    text = path.read_text(encoding="utf-8")
    if "useClientPagination" in text:
        return None
    if "const [rows, setRows]" not in text:
        return None
    if not re.search(r"\brows\.map\(\(row\)", text):
        return None

    text = patch_ui_import(text)
    text, ok_hook = insert_hook(text)
    if not ok_hook:
        return f"skip-hook:{path.name}"

    text2, n = re.subn(
        r"^([ \t]*)rows\.map\(\(row\)",
        r"\1listPage.pageItems.map((row)",
        text,
        flags=re.M,
    )
    text = text2
    if n == 0:
        return f"skip-map:{path.name}"

    text, ok_pager = insert_pager(text)
    path.write_text(text, encoding="utf-8", newline="\n")
    return f"ok:{path.relative_to(ROOT)} (maps={n}, pager={ok_pager})"


def main() -> None:
    results = []
    for path in sorted(ROOT.rglob("*.tsx")):
        if path.name == "ResourcePage.tsx":
            continue
        result = patch_file(path)
        if result:
            results.append(result)
    for line in results:
        print(line)
    print(f"TOTAL {len(results)}")


if __name__ == "__main__":
    main()
