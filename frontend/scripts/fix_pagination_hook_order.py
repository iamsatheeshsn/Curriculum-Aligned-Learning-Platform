"""Keep useClientPagination() calls at the top level of their component, above any guard return.

The pagination rollout inserted each hook directly above the component's final
`return (`, which places it after loading/error guards and breaks the Rules of
Hooks. This moves every call to just after its list argument is defined.
"""
from pathlib import Path
import re
import sys

ROOT = Path("frontend")
HOOK_RE = re.compile(r"^(\s*)const\s+(\w+)\s*=\s*useClientPagination\((.+)\);\s*$")
FUNC_RE = re.compile(r"^(?:export\s+)?(?:default\s+)?function\s+(\w+)")
IDENT_RE = re.compile(r"^[A-Za-z_$][\w$]*$")

apply = "--apply" in sys.argv
moved, skipped = [], []


def body_depths(lines, start, end):
    """Nesting depth of each line relative to the component body (0 = top level)."""
    depths, d = [], 0
    for i in range(start, end):
        stripped = lines[i].strip()
        opens = lines[i].count("{") - lines[i].count("}")
        # a line that only closes a block belongs to the outer level
        depths.append(d - 1 if stripped.startswith("}") and opens < 0 else d)
        d += opens
    return depths


def statement_end(lines, start):
    """Last line index of the statement beginning at `start`."""
    bal = 0
    for i in range(start, len(lines)):
        bal += sum(lines[i].count(c) for c in "([{") - sum(lines[i].count(c) for c in ")]}")
        if bal <= 0 and lines[i].rstrip().endswith((";", "}")):
            return i
    return start


def relocate_one(path, lines):
    """Move the first misplaced hook call found; return True if one was moved."""
    for i, line in enumerate(lines):
        m = HOOK_RE.match(line)
        if not m:
            continue
        arg = m.group(3).strip()
        arg_name = arg.split(",")[0].strip()

        fn_start = next((j for j in range(i - 1, -1, -1) if FUNC_RE.match(lines[j])), None)
        if fn_start is None:
            continue

        body = range(fn_start + 1, i)
        depths = body_depths(lines, fn_start + 1, i + 1)
        hook_depth = depths.pop()

        # first top-level guard (a bare return, or an if-block containing one)
        guard = None
        for idx, j in enumerate(body):
            if depths[idx] != 0:
                continue
            s = lines[j].strip()
            if s.startswith("return"):
                guard = j
                break
            if s.startswith("if (") or s.startswith("if("):
                end = statement_end(lines, j)
                if any(l.strip().startswith("return") for l in lines[j : end + 1]):
                    guard = j
                    break

        if guard is None and hook_depth == 0:
            continue

        # prefer sitting right after the list argument's definition
        insert_after = None
        if IDENT_RE.match(arg_name):
            pattern = re.compile(rf"^\s*const\s+(?:\[\s*{arg_name}\b|{arg_name}\s*[=:])")
            for idx, j in enumerate(body):
                if depths[idx] == 0 and pattern.match(lines[j]):
                    insert_after = statement_end(lines, j)
                    break
            if insert_after is not None and guard is not None and insert_after >= guard:
                skipped.append((path, i + 1, f"`{arg_name}` defined after guard"))
                continue
        if insert_after is None:
            if guard is None:
                skipped.append((path, i + 1, "nested, no guard to anchor against"))
                continue
            insert_after = guard - 1
            while insert_after > fn_start and not lines[insert_after].strip():
                insert_after -= 1

        cut_end = i + 1
        if cut_end < len(lines) and not lines[cut_end].strip():
            cut_end += 1
        del lines[i:cut_end]

        block = [f"  const {m.group(2)} = useClientPagination({arg});"]
        if lines[insert_after + 1].strip():
            block.append("")
        lines[insert_after + 1 : insert_after + 1] = block
        moved.append((path, i + 1, insert_after + 2))
        return True
    return False


for p in sorted(ROOT.rglob("*.tsx")):
    if "node_modules" in p.parts:
        continue
    text = p.read_text(encoding="utf-8")
    if "useClientPagination(" not in text:
        continue
    lines = text.splitlines()
    changed = False
    while relocate_one(p, lines):
        changed = True
    if changed and apply:
        p.write_text("\n".join(lines) + "\n", encoding="utf-8")

for path, frm, to in moved:
    print(f"move  {path}: line {frm} -> {to}")
for path, line, why in skipped:
    print(f"SKIP  {path}:{line}  ({why})")
print(f"\n{len(moved)} moved, {len(skipped)} skipped{'' if apply else '  [dry run]'}")
