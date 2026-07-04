from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from core.scorer import calculate_match_score
from core.ltl import match_partials

app = FastAPI(title="VECTRA Matching Engine")

class MatchRequest(BaseModel):
    type: str # "shipment" or "capacity"
    data: Dict[str, Any]

class BatchMatchRequest(BaseModel):
    shipments: List[Dict[str, Any]]
    capacities: List[Dict[str, Any]]

class LtlMatchRequest(BaseModel):
    routes: List[Dict[str, Any]]
    partials: List[Dict[str, Any]]
    max_detour_pct: Optional[float] = None
    cost_per_km: Optional[float] = None

@app.get("/ping")
async def ping():
    return {"status": "OK", "service": "VECTRA Matching Engine"}

@app.post("/match")
async def match_single(request: MatchRequest):
    """
    Called when a single new shipment or capacity is added.
    For the MVP this is a mock returning a hardcoded score.
    """
    # Logic to fetch candidates from redis or DB goes here.
    # We return a dummy match array for demonstration.
    
    dummy_match = {
        "shipment_id": request.data.get("id", "unknown"),
        "capacity_listing_id": "dummy-capacity-id",
        "match_score": 85,
        "detour_distance_km": 12.5,
        "added_time_minutes": 18,
        "estimated_revenue": 150.00
    }
    return {"matches": [dummy_match]}

@app.post("/batch-match")
async def batch_match(request: BatchMatchRequest):
    """
    Scheduled job calls this every 5 minutes.
    We cross-reference all pending shipments against all available capacities.
    """
    results = []
    for shipment in request.shipments:
        for capacity in request.capacities:
            score, detour, time_added = calculate_match_score(shipment, capacity)
            if score > 75 and detour <= 15: # 15% Detour limit
                results.append({
                    "shipment_id": shipment.get("id"),
                    "capacity_listing_id": capacity.get("id"),
                    "match_score": score,
                    "detour_distance_km": detour,
                    "added_time_minutes": time_added,
                    "estimated_revenue": shipment.get("cargo_weight_kg", 0) * 0.1 # dummy calc
                })
    return {"matches": results}

@app.post("/ltl-match")
async def ltl_match(request: LtlMatchRequest):
    """
    Silent LTL matching (Phase 7): scan active FTL routes against unassigned
    partial loads and return profitable detour insertions. Called by the Node
    ltl service on a scan; the best profitable route per partial is returned.
    """
    kwargs = {}
    if request.max_detour_pct is not None:
        kwargs["max_detour_pct"] = request.max_detour_pct
    if request.cost_per_km is not None:
        kwargs["cost_per_km"] = request.cost_per_km
    suggestions = match_partials(request.routes, request.partials, **kwargs)
    return {"suggestions": suggestions}
