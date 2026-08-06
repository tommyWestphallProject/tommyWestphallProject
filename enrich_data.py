"""
Enriches nodes.json with a 'group' field based on TV franchise patterns.
Also syncs the full dataset to both public/data/ and reactApp/public/data/.

Run this after scraper.py to add visual grouping metadata:
    python enrich_data.py

The 'group' field lets the React front-end colour-code nodes by franchise
(e.g. all CSI shows share one colour, all Star Trek shows share another).
"""
import json
import shutil
from pathlib import Path

SOURCE_DIR = Path("public/data")
TARGET_DIRS = [Path("reactApp/public/data"), Path("public/data")]

# Ordered list — more specific patterns come first so that, e.g.,
# "Law & Order" is matched before "The Office" doesn't accidentally
# swallow a show whose name merely contains the word "order".
FRANCHISE_RULES = [
    ("Star Trek",           ["star trek"]),
    ("Law & Order",         ["law & order"]),
    ("CSI",                 ["csi"]),
    ("NCIS",                ["ncis"]),
    ("Stargate",            ["stargate"]),
    ("Doctor Who",          ["doctor who", "torch wood", "sarah jane", "k-9"]),
    ("The X-Files",         ["x-files", "x files", "millennium", "lone gunman"]),
    ("Marvel",              [
        "dare devil", "daredevil", "jessica jones", "luke cage", "iron fist",
        "punisher", "mcu", "agents of shield", "marvel", "bat woman",
        "super girl", "black lightning", "arrow", "legends of tomorrow",
        "the flash", "defender", "ghost rider", "deadpool", "x-men",
        "spider-man", "wanda vision", "shang-chi", "ms. marvel", "hawk",
        "she-hulk", "moon knight", "runaways",
    ]),
    ("Grey's Anatomy",     ["grey's anatomy", "greys anatomy", "private practice", "station 19"]),
    ("Chicago",            ["chicago"]),
    ("Saved by the Bell",  ["saved by the bell"]),
    ("Degrassi",           ["degrassi"]),
    ("Three's Company",    ["three's company", "three's a crowd", "the ropers"]),
    ("The Office",         ["the office"]),
    ("Twin Peaks",         ["twin peaks"]),
    ("Mission: Impossible",["mission: impossible"]),
    ("M*A*S*H",            ["m*a*s*h", "aftermash", "w*a*l*t*er"]),
    ("Andy Griffith",      ["andy griffith", "gomer pyle", "mayberry", "goober"]),
    ("Cheers / Wings",     ["cheers", "wings", "tattingers", "frasier"]),
    ("The Simpsons",       ["simpsons"]),
    ("The Brady Bunch",    ["the brady"]),
    ("Hill Street Blues",  ["hill street"]),
    ("Friends / Melrose",  ["friends", "mad about you", "melrose place"]),
    ("Family Ties",        ["family ties"]),
    ("The Golden Girls",   ["golden girls", "empty nest", "the golden palace"]),
    ("The Munsters",       ["munster"]),
    ("The Addams Family",  ["addam's family", "the addams family"]),
    ("Batman 1966",        ["batman"]),
    ("The Love Boat",      ["the love boat", "fantasy island", "the love boat"]),
    ("Bewitched",          ["bewitched", "the dick van dyke show", "the andy griffith"]),
    ("Seinfeld",           ["seinfeld"]),
    ("The Twilight Zone",  ["twilight zone"]),
    ("The West Wing",      ["west wing"]),
    ("Twin Peaks",         ["twin peaks"]),
    ("Veronica Mars",      ["veronica mars"]),
    ("Supernatural",       ["supernatural", "supernatural"]),
    ("Smallville",         ["smallville"]),
]


def infer_franchise(label):
    """Return a franchise group name based on the show label."""
    l = (label or "").lower()
    for name, patterns in FRANCHISE_RULES:
        if any(p in l for p in patterns):
            return name
    return "Other"


def enrich():
    # Read source data
    with open(SOURCE_DIR / "nodes.json", "r", encoding="utf-8") as f:
        nodes = json.load(f)
    with open(SOURCE_DIR / "edges.json", "r", encoding="utf-8") as f:
        edges = json.load(f)

    print(f"Loaded {len(nodes)} nodes, {len(edges)} edges from {SOURCE_DIR}")

    # Enrich nodes with group + cleaned label
    for n in nodes:
        label = n.get("label") or n["id"]
        n["label"] = label
        n["group"] = infer_franchise(label)

    # Report group distribution
    from collections import Counter
    groups = Counter(n["group"] for n in nodes)
    print("\nFranchise distribution:")
    for g, count in groups.most_common():
        print(f"  {g:20s} {count:4d} nodes")

    # Write to all target directories
    for d in TARGET_DIRS:
        d.mkdir(parents=True, exist_ok=True)
        with open(d / "nodes.json", "w", encoding="utf-8") as f:
            json.dump(nodes, f, indent=2, ensure_ascii=False)
        with open(d / "edges.json", "w", encoding="utf-8") as f:
            json.dump(edges, f, indent=2, ensure_ascii=False)
        print(f"  Wrote {len(nodes)} nodes, {len(edges)} edges → {d}/")


if __name__ == "__main__":
    enrich()
