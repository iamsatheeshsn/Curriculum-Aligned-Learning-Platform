from pathlib import Path
import re
from collections import Counter

root = Path("frontend")
sm = xs = md_explicit = default_md = 0
no_size = Counter()
for p in root.rglob("*.tsx"):
    t = p.read_text(encoding="utf-8", errors="ignore")
    for m in re.finditer(r"<(Button|ConfirmButton)\b([^>]*)>", t, re.S):
        attrs = " ".join(m.group(2).split())
        if 'size="sm"' in attrs or "size='sm'" in attrs:
            sm += 1
        elif 'size="xs"' in attrs or "size='xs'" in attrs:
            xs += 1
        elif 'size="md"' in attrs or "size='md'" in attrs:
            md_explicit += 1
        else:
            default_md += 1
            no_size[str(p.relative_to(root))] += 1

print(f"sm={sm} xs={xs} md_explicit={md_explicit} no_size(defaults to sm)={default_md}")
print("files missing explicit size:")
for f, n in no_size.most_common(20):
    print(f"  {n:3d}  {f}")
