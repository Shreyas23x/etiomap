"""
Chemical–Disease Association API.

Two prediction engines behind one API:
  • network  — chemical→disease links via shared KEGG pathways (always available)
  • model    — disease→chemical ranking from the trained XGBoost model
               (available once model_artifacts/ is present)

Run:  uvicorn app.main:app --reload   (from the 04_backend/ folder)
Docs: http://127.0.0.1:8000/docs
"""
from fastapi import FastAPI, HTTPException, Query, UploadFile, File
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os

from app import network, model, score

app = FastAPI(title="Chemical–Disease Association API", version="1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"],
                   allow_headers=["*"])

# --- user-network module (revertible add-on: delete app/user_network.py and the
#     next two lines to remove the "build a network from your own data" feature) ---
from app import user_network
app.include_router(user_network.router)

# --- pubmed-scan module (revertible add-on: delete app/pubmed_scan.py and the
#     next two lines to remove live PubMed abstract scouring) ---
from app import pubmed_scan
app.include_router(pubmed_scan.router)

# --- pollutant-map module (revertible add-on: delete app/pollutant_map.py and the
#     next two lines to remove the location->pollutant->disease-risk feature) ---
from app import pollutant_map
app.include_router(pollutant_map.router)

STATIC = os.path.join(os.path.dirname(__file__), "..", "static")


@app.get("/api/health")
def health():
    return {"status": "ok", "model_ready": model.is_ready(),
            "diseases": len(network.diseases())}


@app.get("/api/diseases")
def list_diseases():
    return network.diseases()


@app.get("/api/classes")
def list_classes():
    """Compound classes present in the network, with counts."""
    return network.classes()


def _parse_classes(classes: str):
    if not classes:
        return None
    return tuple(c.strip() for c in classes.split(",") if c.strip())


@app.get("/api/disease/{disease}/chemicals")
def disease_chemicals(disease: str,
                      source: str = Query("network", pattern="^(network|model)$"),
                      limit: int = 20,
                      novel_only: bool = False,
                      classes: str = Query(None, description="comma-separated compound "
                                           "classes, e.g. environmental,drug")):
    if source == "model":
        if not model.is_ready():
            raise HTTPException(503, "Model artifacts not loaded; use source=network "
                                     "or run the model notebook and add model_artifacts/.")
        return {"disease": disease, "source": "model",
                "chemicals": model.rank_chemicals(disease, limit)}
    rows = network.chemicals_for_disease(disease, limit, include_known=not novel_only,
                                         classes_filter=_parse_classes(classes))
    if not rows:
        raise HTTPException(404, f"No network links for disease '{disease}'.")
    return {"disease": disease, "source": "network", "chemicals": rows}


@app.get("/api/chemical/{name}/diseases")
def chemical_diseases(name: str, limit: int = 20):
    rows = network.diseases_for_chemical(name, limit)
    if not rows:
        raise HTTPException(404, f"No network links for chemical '{name}'.")
    return {"chemical": name, "diseases": rows}


@app.get("/api/network")
def network_graph(disease: str = None, max_edges: int = 150, classes: str = None):
    return network.graph(disease, max_edges, classes_filter=_parse_classes(classes))


class ScoreReq(BaseModel):
    compounds: list[str]


@app.post("/api/score")
def score_compounds(req: ScoreReq):
    """Score typed compound names against every disease (model likelihood)."""
    if not model.is_ready():
        raise HTTPException(503, "Model artifacts not loaded.")
    names = [c for c in req.compounds if c and c.strip()][:100]
    return {"results": score.score_many(names)}


@app.post("/api/score/csv")
async def score_csv(file: UploadFile = File(...)):
    """Score an uploaded CSV of compounds against every disease."""
    if not model.is_ready():
        raise HTTPException(503, "Model artifacts not loaded.")
    raw = (await file.read()).decode("utf-8", errors="ignore")
    names = score.parse_csv(raw)[:200]
    if not names:
        raise HTTPException(400, "No compound names found in the file.")
    return {"count": len(names), "results": score.score_many(names)}


@app.get("/api/network/full")
def network_full():
    """Full enriched graph (sources, model scores, pathways) for the explorer."""
    import json
    path = os.path.join(os.path.dirname(__file__), "..", "data", "network_full.json")
    with open(path) as f:
        return json.load(f)


@app.get("/explorer")
def explorer():
    return FileResponse(os.path.join(STATIC, "network.html"))


@app.get("/")
def index():
    return FileResponse(os.path.join(STATIC, "network.html"))


@app.get("/demo")
def demo():
    return FileResponse(os.path.join(STATIC, "index.html"))


if os.path.isdir(STATIC):
    app.mount("/static", StaticFiles(directory=STATIC), name="static")
