#!/usr/bin/env python3
"""Download AMAD's typefaces (SIL Open Font License) for self-hosting: latin subset, woff2.
Writes fonts/*.woff2, fonts/fonts.css (relative URLs) and the OFL licence texts."""
import re
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "fonts"
OUT.mkdir(exist_ok=True)
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36"
CSS_URL = ("https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800"
           "&family=Newsreader:ital,opsz,wght@0,6..72,400..600;1,6..72,400..500&display=swap")


def get(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
        return r.read()


css = get(CSS_URL).decode()
blocks = re.findall(r"/\* ([\w-]+) \*/\s*(@font-face \{.*?\})", css, re.S)
out = []
for subset, block in blocks:
    if subset != "latin":
        continue
    family = re.search(r"font-family: '([^']+)'", block).group(1)
    style = re.search(r"font-style: (\w+)", block).group(1)
    url = re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1)
    name = f"{family.lower().replace(' ', '-')}-{style}-latin.woff2"
    (OUT / name).write_bytes(get(url))
    out.append(re.sub(r"url\(https://[^)]+\)", f"url({name})", block))
    print("saved", name)
(OUT / "fonts.css").write_text("/* Self-hosted: Bricolage Grotesque and Newsreader, SIL Open Font License 1.1 (see OFL-*.txt). Latin subset. */\n" + "\n".join(out) + "\n")
for fam in ("bricolagegrotesque", "newsreader"):
    (OUT / f"OFL-{fam}.txt").write_bytes(get(f"https://raw.githubusercontent.com/google/fonts/main/ofl/{fam}/OFL.txt"))
print("done")
