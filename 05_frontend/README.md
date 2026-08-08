# EtioMap — front-end (React + Vite)

Professional light-theme web app for the chemical–disease atlas. Swiss-Modernism
design system (navy + emerald on off-white, Fraunces / Inter / Roboto Mono).

## Pages
- **Home** (`/`) — landing: hero, stats, feature cards, how-it-works.
- **Analyze** (`/analyze`) — three modes:
  - *By disease* → ranked chemical drivers (model likelihood or network significance)
  - *By compound* → per-disease likelihood + related compounds for any typed compound
  - *Upload list* → score a CSV of your own compounds against all six diseases
  - every result is downloadable as CSV
- **Network** (`/explorer`) — the interactive Cytoscape explorer (light-themed), with
  the left settings toolbar, progressive filters, model + pathway toggles, click-to-
  inspect with PubMed sources, and selection → CSV download.

## Run (dev)
Two servers; the Vite dev server proxies `/api` → FastAPI (see `vite.config.js`).

```bash
# 1) backend  (from 04_backend/, needs xgboost + fastapi + uvicorn + python-multipart)
uvicorn app.main:app --port 8000

# 2) front-end (from 05_frontend/)
npm install      # first time
npm run dev      # http://localhost:5173
```

## Build (production)
```bash
npm run build    # outputs static site to dist/
npm run preview  # serve the build locally
```
`dist/` is a static bundle; serve it behind any static host and point its `/api`
at the FastAPI backend (reverse proxy or same-origin mount).

## Notes
- No login (per project decision); the tool is open.
- The Cytoscape bundle is the bulk of the JS payload; code-splitting the explorer
  route would trim the initial Home/Analyze load if needed later.
