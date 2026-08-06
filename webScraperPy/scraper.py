"""
Scrapes the Tommy Westphall Universe wiki (a Fandom/MediaWiki site) and
produces nodes.json + edges.json ready to drop straight into the React app.

Why the rewrite:
- The old version scraped raw HTML (via html_to_json) from three different
  sources, including IMDB, which blocks scrapers with 403s and has no
  free API.  It also never produced usable node/edge data -- just HTML dumps.
- Fandom wikis run on MediaWiki, which exposes a free, stable, no-auth-needed
  JSON API (api.php).  Using it instead of HTML scraping is far more robust
  and gives us exactly what we need:
    1) every show page linked from the master list page  -> our node set
    2) every wikilink FROM each show's page that also points at another
       show in our node set -> a crossover edge between them

Usage:
    pip install requests
    python scraper.py

Output:
    fileDump/jsonDump/nodes.json
    fileDump/jsonDump/edges.json
    (also copied into reactApp/public/data/ so the React app can fetch them
     at runtime -- see reactApp/src/App.js)
"""
import json
import shutil
import time
from pathlib import Path

import requests

API_URL = "https://tommywestphall.fandom.com/api.php"
MASTER_LIST_PAGE = "List of television series in the Tommy Westphall Universe"
HEADERS = {
    "User-Agent": "TommyWestphallGraphBot/1.0 "
    "(https://github.com/tommyWestphallProject/tommyWestphallProject; contact via GitHub issues)"
}
OUT_DIR = Path("fileDump/jsonDump")
PUBLIC_DATA_DIRS = [Path("reactApp/public/data"), Path("public/data")]
REQUEST_DELAY_SECONDS = 0.2  # be polite to Fandom's API

# ── Franchise detection (for node grouping / colour-coding) ──
# Each rule is a (group_name, list_of_lowercase_substring_patterns).
# A show is assigned to the *first* matching group.
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
    ("Grey's Anatomy",      ["grey's anatomy", "greys anatomy", "private practice", "station 19"]),
    ("Chicago",             ["chicago"]),
    ("Saved by the Bell",   ["saved by the bell"]),
    ("Degrassi",            ["degrassi"]),
    ("Three's Company",     ["three's company", "three's a crowd", "the ropers"]),
    ("The Office",          ["the office"]),
    ("Twin Peaks",          ["twin peaks"]),
    ("Mission: Impossible", ["mission: impossible"]),
    ("M*A*S*H",             ["m*a*s*h", "aftermash", "w*a*l*t*er"]),
    ("Andy Griffith",       ["andy griffith", "gomer pyle", "mayberry", "goober"]),
    ("Cheers / Wings",      ["cheers", "wings", "tattingers", "frasier"]),
    ("The Simpsons",        ["simpsons"]),
    ("Brady Bunch",         ["the brady"]),
    ("Hill Street Blues",   ["hill street"]),
    ("Friends / Melrose",   ["friends", "mad about you", "melrose place"]),
    ("Family Ties",         ["family ties"]),
    ("Golden Girls",        ["golden girls", "empty nest", "the golden palace"]),
    ("The Munsters",        ["munster"]),
    ("Addams Family",       ["addam's family", "the addams family"]),
    ("Batman 1966",         ["batman"]),
    ("Love Boat",           ["the love boat", "fantasy island"]),
    ("Bewitched",           ["bewitched"]),
    ("Seinfeld",            ["seinfeld"]),
    ("Twilight Zone",       ["twilight zone"]),
    ("West Wing",           ["west wing"]),
    ("Smallville",          ["smallville"]),
]


def infer_franchise(title):
    """Return a franchise group name for a show title (for visual grouping)."""
    l = (title or "").lower()
    for grp, patterns in FRANCHISE_RULES:
        if any(p in l for p in patterns):
            return grp
    return "Other"


def _query_links(params_base):
    """Run a prop=links MediaWiki query, following continuation, and
    return {page_title: [linked_title, ...]} for main-namespace links only."""
    result = {}
    params = dict(params_base)
    while True:
        resp = requests.get(API_URL, params=params, headers=HEADERS, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        pages = data.get("query", {}).get("pages", {})
        for page in pages.values():
            title = page.get("title")
            links = [l["title"] for l in page.get("links", []) if l.get("ns") == 0]
            result.setdefault(title, []).extend(links)
        if "continue" in data:
            params.update(data["continue"])
            time.sleep(REQUEST_DELAY_SECONDS)
        else:
            break
    return result


def get_master_list_links(page_title):
    """Every show page linked from the master list page = our node set."""
    params = {
        "action": "query",
        "titles": page_title,
        "prop": "links",
        "pllimit": "max",
        "format": "json",
    }
    linked = _query_links(params)
    all_links = [title for links in linked.values() for title in links]
    return sorted(set(all_links))


def get_page_links(title):
    params = {
        "action": "query",
        "titles": title,
        "prop": "links",
        "pllimit": "max",
        "format": "json",
    }
    linked = _query_links(params)
    for links in linked.values():
        return links
    return []


def orchestrator():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching master list of shows...")
    shows = get_master_list_links(MASTER_LIST_PAGE)
    node_set = set(shows)
    print(f"Found {len(shows)} shows.")

    nodes = [{"id": title, "label": title, "group": infer_franchise(title)} for title in shows]
    edges = []
    seen_edges = set()

    for i, title in enumerate(shows):
        print(f"[{i + 1}/{len(shows)}] {title}")
        try:
            linked_titles = get_page_links(title)
        except requests.exceptions.HTTPError as e:
            print(f"  ERROR: HTTP {e.response.status_code} fetching links for {title}")
            continue
        except Exception as e:
            print(f"  ERROR: unexpected error fetching links for {title}: {e}")
            continue

        for target in linked_titles:
            if target in node_set and target != title:
                pair = tuple(sorted((title, target)))
                if pair not in seen_edges:
                    seen_edges.add(pair)
                    edges.append(
                        {"id": f"{pair[0]}__{pair[1]}", "source": pair[0], "target": pair[1]}
                    )
        time.sleep(REQUEST_DELAY_SECONDS)

    nodes_path = OUT_DIR / "nodes.json"
    edges_path = OUT_DIR / "edges.json"
    with open(nodes_path, "w", encoding="utf-8") as f:
        json.dump(nodes, f, indent=2)
    with open(edges_path, "w", encoding="utf-8") as f:
        json.dump(edges, f, indent=2)
    print(f"Wrote {len(nodes)} nodes and {len(edges)} edges to {OUT_DIR}/")

    for public_dir in PUBLIC_DATA_DIRS:
        try:
            public_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy(nodes_path, public_dir / "nodes.json")
            shutil.copy(edges_path, public_dir / "edges.json")
            print(f"Copied nodes.json/edges.json into {public_dir}/")
        except OSError as e:
            print(f"  NOTE: could not copy into {public_dir}/ ({e})")


if __name__ == "__main__":
    orchestrator()
