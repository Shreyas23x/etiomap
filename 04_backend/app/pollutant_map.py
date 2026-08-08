"""Location -> pollutant -> respiratory-disease risk (revertible add-on).

Pinpoint a spot on a map of India; this fetches the current air-quality at that
coordinate (Open-Meteo Air Quality API, keyless) and connects each measured
pollutant to EtioMap's six respiratory diseases:

  * gaseous, single-molecule pollutants (NO2, SO2, O3, CO, NH3) are scored by the
    trained XGBoost model, exactly like any other compound (app.score);
  * particulates (PM2.5, PM10, dust) are mixtures with no single PubChem
    structure, so they carry curated epidemiological disease weights instead
    (clearly tagged `curated`, never presented as model output).

A location's per-disease risk = sum over pollutants of
    (how far the pollutant exceeds its WHO guideline) x (its disease association).
So the *ranking of diseases* comes from EtioMap's association engine, while the
*location-specific magnitude* comes from the live measured concentrations.

Revert: delete this file and the two marked lines in app/main.py; remove
`pollutantMap` in the frontend api.js, the PollutantMap route/nav links, and the
`leaflet` dependency if nothing else uses it.
"""
from fastapi import APIRouter, HTTPException, Query
from functools import lru_cache
import math
import requests

router = APIRouter(prefix="/api/pollutant-map", tags=["pollutant-map"])

OPEN_METEO = "https://air-quality-api.open-meteo.com/v1/air-quality"

# key -> (display, kind, pubchem name | ctd chemical, WHO 2021 guideline µg/m³ | None)
#   kind "model"   -> scored by the XGBoost model through app.score
#   kind "curated" -> particulate mixture; the 4th field names the CTD chemical
#                     whose curated evidence backs it (see CTD_PM_REFS)
POLLUTANTS = [
    ("pm2_5",            "PM2.5", "curated", "Particulate Matter", 15),
    ("pm10",             "PM10",  "curated", "Particulate Matter", 45),
    ("dust",             "Dust",  "curated", "Dust",               45),
    ("nitrogen_dioxide", "NO₂", "model", "nitrogen dioxide", 25),
    ("sulphur_dioxide",  "SO₂", "model", "sulfur dioxide",   40),
    ("ozone",            "O₃", "model", "ozone",            100),
    ("carbon_monoxide",  "CO",    "model", "carbon monoxide",   4000),
    ("ammonia",          "NH₃", "model", "ammonia",         None),
]

# CTD curated (DirectEvidence = "marker/mechanism") reference counts for the
# particulate chemicals vs each disease, pulled from CTD's per-disease batch export
# (06_expansion/raw/chems_D*.tsv). These are REAL curated PubMed-backed associations
# — the count of curated references is used as the association strength (log-scaled),
# never a hand-set prior. Diseases with no curated PM evidence under that exact MeSH
# term (e.g. Carcinoma, Bronchogenic — CTD files PM lung-cancer evidence under the
# broader "Lung Neoplasms") are simply absent, i.e. weight 0.
CTD_PM_REFS = {
    "Particulate Matter": {"Pneumonia": 25, "Asthma": 21,
                           "Pulmonary Disease, Chronic Obstructive": 7,
                           "Bronchitis": 6, "Rhinitis, Allergic": 1},
    "Dust": {"Pneumonia": 4, "Asthma": 3,
             "Pulmonary Disease, Chronic Obstructive": 1},
}
_CTD_REF_MAX = max(n for refs in CTD_PM_REFS.values() for n in refs.values())  # 25


def _ctd_weight(refs):
    """Curated reference count -> 0..1 association strength (log-scaled, so a
    25-ref association isn't treated as 25x a 1-ref one)."""
    return math.log2(1 + refs) / math.log2(1 + _CTD_REF_MAX)


# How much each evidence stream counts toward a location's disease risk. The model
# (novelty of EtioMap) leads; curated particulate evidence corroborates at half weight.
W_MODEL = 1.0
W_CURATED = 0.5


def _aqi_band(aqi):
    if aqi is None:
        return ("Unknown", "#94a3b8")
    for hi, name, color in [(50, "Good", "#16a34a"), (100, "Moderate", "#ca8a04"),
                            (150, "Unhealthy for sensitive groups", "#ea580c"),
                            (200, "Unhealthy", "#dc2626"),
                            (300, "Very unhealthy", "#9333ea"),
                            (10 ** 9, "Hazardous", "#7f1d1d")]:
        if aqi <= hi:
            return (name, color)
    return ("Hazardous", "#7f1d1d")


@lru_cache(maxsize=1)
def _gas_assoc():
    """Model likelihood of each gaseous pollutant vs every disease.
    Concentration-independent, so computed once and cached."""
    from app import score, model
    out = {}
    if not model.is_ready():
        return out
    for key, _disp, kind, pubchem, _g in POLLUTANTS:
        if kind != "model":
            continue
        try:
            res = score.score_compound(pubchem)
            if res.get("resolved"):
                out[key] = {"cid": res.get("cid"),
                            "diseases": {s["disease"]: s["likelihood"] for s in res["scores"]}}
        except Exception:
            pass
    return out


def _fetch_air(lat, lon):
    fields = ",".join(k for k, *_ in POLLUTANTS) + ",us_aqi"
    try:
        r = requests.get(OPEN_METEO, params={
            "latitude": lat, "longitude": lon, "current": fields, "timezone": "auto"
        }, timeout=20)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        raise HTTPException(502, f"Air-quality service unavailable: {e}")


@router.get("/air")
def air(lat: float = Query(..., ge=-90, le=90),
        lon: float = Query(..., ge=-180, le=180),
        label: str = ""):
    data = _fetch_air(lat, lon)
    cur = data.get("current", {})
    gas = _gas_assoc()

    us_aqi = cur.get("us_aqi")
    band, band_color = _aqi_band(us_aqi)

    pollutants = []
    gas_raw = {}   # disease -> {"score", "drivers": {name: contrib}}  (summed over gases)
    pm_raw = {}    # disease -> {"score", "driver"}                    (MAX over particulates)
    for key, disp, kind, ref4, guide in POLLUTANTS:
        val = cur.get(key)
        if val is None:
            continue
        exceed = round(val / guide, 2) if (guide and guide > 0) else None
        # exposure factor: excess OVER the guideline, log-scaled (diminishing
        # returns). Pollutants within guideline pose no excess risk -> 0.
        expo = math.log2(exceed) if (exceed and exceed > 1) else 0.0

        if kind == "curated":
            refs = CTD_PM_REFS.get(ref4, {})
            assoc = {d: _ctd_weight(n) for d, n in refs.items()}
            cid, ctd = None, {"chemical": ref4, "refs": refs}
        else:
            g = gas.get(key, {})
            assoc = g.get("diseases", {})
            cid, ctd = g.get("cid"), None

        if exceed is None:
            level = "—"
        elif exceed >= 4:
            level = "very high"
        elif exceed >= 2:
            level = "high"
        elif exceed >= 1:
            level = "above guideline"
        else:
            level = "within guideline"
        pollutants.append({
            "key": key, "name": disp, "kind": kind, "cid": cid, "ctd": ctd,
            "value": val, "unit": "µg/m³",  # Open-Meteo omits charset; hardcode to avoid mojibake
            "who_guideline": guide, "exceedance": exceed, "level": level,
            "diseases": sorted(
                ({"disease": d, "weight": round(w, 3)} for d, w in assoc.items()),
                key=lambda x: x["weight"], reverse=True)[:3],
        })
        if expo <= 0:
            continue
        if kind == "model":
            for d, a in assoc.items():
                slot = gas_raw.setdefault(d, {"score": 0.0, "drivers": {}})
                c = expo * a
                slot["score"] += c
                slot["drivers"][disp] = slot["drivers"].get(disp, 0.0) + c
        else:  # particulates: take the single strongest, don't triple-count PM
            for d, a in assoc.items():
                c = expo * a
                slot = pm_raw.setdefault(d, {"score": 0.0, "driver": None})
                if c > slot["score"]:
                    slot["score"], slot["driver"] = c, disp

    # combine the two streams: model (gases) leads, curated particulates corroborate
    combined = {}
    for d in set(gas_raw) | set(pm_raw):
        gs, ps = gas_raw.get(d), pm_raw.get(d)
        drivers = {n: W_MODEL * c for n, c in (gs["drivers"].items() if gs else [])}
        score = W_MODEL * (gs["score"] if gs else 0.0)
        if ps and ps["driver"]:
            score += W_CURATED * ps["score"]
            drivers[ps["driver"]] = drivers.get(ps["driver"], 0.0) + W_CURATED * ps["score"]
        combined[d] = {"score": score, "drivers": drivers}

    # normalise disease risk to 0-100 (relative; absolute severity is the AQI)
    top = max((v["score"] for v in combined.values()), default=0.0)
    disease_risk = []
    for d, v in combined.items():
        drivers = sorted(v["drivers"].items(), key=lambda x: x[1], reverse=True)
        disease_risk.append({
            "disease": d,
            "score": round(100 * v["score"] / top, 1) if top else 0.0,
            "drivers": [name for name, _ in drivers[:3]],
        })
    disease_risk.sort(key=lambda x: x["score"], reverse=True)

    return {
        "location": {"lat": lat, "lon": lon, "label": label or None},
        "time": cur.get("time"),
        "aqi": {"us_aqi": us_aqi, "band": band, "color": band_color},
        "pollutants": pollutants,
        "disease_risk": disease_risk,
        "prevention": _prevention(band, pollutants),
        "model_ready": bool(gas),
    }


def _prevention(band, pollutants):
    """Practical guidance keyed to the AQI band and which pollutants are elevated."""
    tips = []
    high = {p["name"] for p in pollutants if p["exceedance"] and p["exceedance"] >= 1}
    pm = any(p["key"] in ("pm2_5", "pm10", "dust") and p["exceedance"] and p["exceedance"] >= 1
             for p in pollutants)
    severe = band in ("Unhealthy", "Very unhealthy", "Hazardous")

    if severe:
        tips.append("Limit time outdoors; people with asthma, COPD, or heart conditions, "
                    "the elderly, and children should stay indoors during peak hours.")
    else:
        tips.append("Air is acceptable for most people; sensitive individuals should still "
                    "watch for symptoms on higher-pollution days.")
    if pm:
        tips.append("Wear a well-fitted N95/FFP2 respirator outdoors — cloth and surgical "
                    "masks do not filter fine particulate (PM2.5).")
        tips.append("Run a HEPA air purifier indoors and keep windows shut during peak "
                    "traffic and early-morning smog.")
    if "NO₂" in high or "CO" in high:
        tips.append("Avoid busy roads and traffic at rush hour — NO₂ and CO track "
                    "vehicle exhaust and are highest kerbside.")
    if "O₃" in high:
        tips.append("Ozone peaks in afternoon heat; shift outdoor exercise to early morning.")
    tips.append("Check the local AQI before outdoor exertion, and reschedule strenuous "
                "activity when it is elevated.")
    return tips
