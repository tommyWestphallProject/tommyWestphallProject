# tommyWestphallProject
"The Tommy Westphall Universe is an internet meme that takes its premise from the final moments of the series finale of St. Elsewhere, which reveals that the entire show had taken place in the mind of an autistic boy. Television fans hypothesized that, because of television crossovers and spin-offs, a large fictional universe all takes place inside this boy’s imagination.

For example, in an episode of St Elsewhere, the doctors visit the bar from Cheers and are served by Carla Tortelli (Rhea Perlman) who mentions giving birth in St. Eligius, the fictional hospital at the centre of the show. The doctors also appeared on Homicide: Life on the Street, where another character (Detective John Munch, played by Richard Belzer) has crossed over into at least ten other series alone.

Intrepid fans cross-referenced television data bases and determined that 290 television shows were intertwined with St. Elsewhere, connected by fictional characters, places and corporations." [1]

This is an attempt to generate an interactive graph of nodes of all pieces of entertainment involved with the theory.

1) one time set up
    1) install node JS and npm to start
    2) install react as well: 
    3) guide for both: https://www.freecodecamp.org/news    how-to-install-react-a-step-by-step-guide/
    4) npm install react-scripts --save

1) everytime start up steps
    1) 'npm start' to run the react app locally


1) Steps carried out to create Project.

    1) figure out how to handle front end
    2) figure out how to setup and use react
    3) figure out how to handle graph creation
    4) figure out how to setup and use reactflow
    5) figure out how to have auto poisiton for nodes
    6) figure out how to use dagre or alternatives (https://reactflow.dev/examples/layout/dagre or https://github.com/kieler/elkjs)
    7) figure out how to not harcode nodes and edges
    8) figure out how to give nodes via some input (JSON File)
    9) figure out how to give edges via some input (JSON File)
    10) figure out a good way to explain connections
    11) figure out a good way to display connection explainations
    12) figure out how to build rest of the site (imptove visually)
    13) add 
    14) need to figure out how to host on github page
    15) need to figure out how to import from API from fandom: https://tommywestphall.fandom.com/wiki/List_of_television_series_in_the_Tommy_Westphall_Universe  see https://community.fandom.com/f/p/3198055608221698748 to fill the edges and nodes JSON 
    16) write a parser tp fix and make JSON reactFlow acceptable to create nodes and edges.

    Source: 
    [1] https://www.dave-dyment.com/addendum-to-the-tommy-westphall-universe-2

## Generating the data (steps 5-9, 15-16)

`webScraperPy/scraper.py` pulls the node list from the master list page and
infers crossover edges from Fandom's MediaWiki API (`api.php`), instead of
scraping raw HTML or IMDB (which blocks scrapers with 403s and has no API):

```
cd webScraperPy
pip install -r requirements.txt
python scraper.py
```

This writes `fileDump/jsonDump/nodes.json` and `edges.json`, and copies them
into `reactApp/public/data/` (and `public/data/`, since `public/` is a
symlink to `reactApp/public/`) so the React app can fetch them at runtime.

`src/App.js` fetches those two files, lays the graph out automatically with
dagre (step 6), and renders it with a search box that highlights matching
shows. A small seed `nodes.json`/`edges.json` is committed so the app runs
out of the box; run the scraper to replace it with the full ~500-show
dataset from the wiki.

