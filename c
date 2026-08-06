"""Verify enriched data and check App.js consistency."""
import json

# Check enriched nodes
nodes = json.load(open('public/data/nodes.json', encoding='utf-8'))
print(f'Nodes: {len(nodes)}')
print(f'Has group field: {all("group" in n for n in nodes)}')

# Show examples of each group
seen = set()
for n in nodes:
    g = n['group']
    if g not in seen:
        seen.add(g)
        print(f'  group={g!r:25s}  example: {n["id"]}')

# Check both data dirs are in sync
nodes_a = json.load(open('public/data/nodes.json', encoding='utf-8'))
nodes_b = json.load(open('reactApp/public/data/nodes.json', encoding='utf-8'))
edges_a = json.load(open('public/data/edges.json', encoding='utf-8'))
edges_b = json.load(open('reactApp/public/data/edges.json', encoding='utf-8'))
print(f'\nRoot nodes: {len(nodes_a)}, reactApp nodes: {len(nodes_b)}')
print(f'Root edges: {len(edges_a)}, reactApp edges: {len(edges_b)}')
print(f'Data in sync: {nodes_a == nodes_b and edges_a == edges_b}')

# Check reactApp/src/App.js matches src/App.js
import filecmp
print(f'\nApp.js files match: {filecmp.cmp("src/App.js", "reactApp/src/App.js")}')
print(f'App.css files match: {filecmp.cmp("src/App.css", "reactApp/src/App.css")}')
print(f'index.html files match: {filecmp.cmp("public/index.html", "reactApp/public/index.html")}')
