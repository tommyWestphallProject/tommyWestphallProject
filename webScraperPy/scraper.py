"""
Scrapes the Tommy Westphall Universe wiki (a Fandom/MediaWiki site) and
produces nodes.json + edges.json ready to drop straight into the React app.

Why the rewrite:
- The old version scraped raw HTML (via html_to_json) from three different
  sources, including IMDB, which blocks scrapers with 403s and has no
  free API. It also never produced usable node/edge data -- just HTML dumps.
- Fandom wikis run on MediaWiki, which exposes a free, stable, no-auth-needed
  JSON API (api.php). Using it instead of HTML scraping is far more robust
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


def get_links_for_titles(titles):
    """Outgoing main-namespace links for many pages in one query."""
    params = {
        "action": "query",
        "titles": "|".join(titles),
        "prop": "links",
        "pllimit": "max",
        "format": "json",
        "redirects": "1",
    }
    return _query_links(params)


def get_page_links(title):
    linked = get_links_for_titles([title])
    for links in linked.values():
        return links
    return []


def orchestrator():
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching master list of shows...")
    shows = get_master_list_links(MASTER_LIST_PAGE)
    node_set = set(shows)
    print(f"Found {len(shows)} shows.")

    nodes = [{"id": title, "label": title} for title in shows]
    edges = []
    seen_edges = set()

    batch_size = 25
    for start in range(0, len(shows), batch_size):
        batch = shows[start:start + batch_size]
        print(f"[{start + 1}-{start + len(batch)}/{len(shows)}] fetching links")
        try:
            linked_by_title = get_links_for_titles(batch)
        except requests.exceptions.HTTPError as e:
            print(f"  ERROR: HTTP {e.response.status_code} fetching a batch, retrying one by one")
            linked_by_title = {}
            for title in batch:
                try:
                    linked_by_title[title] = get_page_links(title)
                except Exception as inner:
                    print(f"  ERROR: {title}: {inner}")
                time.sleep(REQUEST_DELAY_SECONDS)
        except Exception as e:
            print(f"  ERROR: unexpected error fetching a batch: {e}")
            continue

        for title, linked_titles in linked_by_title.items():
            if title not in node_set:
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
