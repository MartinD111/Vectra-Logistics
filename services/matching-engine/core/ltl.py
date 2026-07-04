"""
Silent LTL (less-than-truckload) matching (Phase 7).

Given active FTL routes (each an origin→destination trip with spare capacity) and
unassigned partial loads, find profitable insertions: routing origin→pickup→
dropoff→destination instead of origin→destination. A partial is a candidate for
a route when the truck has spare weight, the extra distance (detour) is within a
percentage cap of the base route, and the offered rate beats the detour's fuel
cost — i.e. the empty space earns money.

Straight-line (haversine) distances, mirroring core/scorer.py — good enough to
rank suggestions; a real router refines the winners.
"""

from typing import Dict, Any, List
from core.scorer import calculate_distance

DEFAULT_MAX_DETOUR_PCT = 30.0   # detour capped at 30% of the base route
DEFAULT_COST_PER_KM = 1.2       # €/km marginal cost of the detour (fuel + time)


def _pt(obj: Dict[str, Any], key: str):
    p = obj.get(key) or {}
    return float(p.get("lat", 0)), float(p.get("lng", 0))


def match_partials(routes: List[Dict[str, Any]], partials: List[Dict[str, Any]],
                   max_detour_pct: float = DEFAULT_MAX_DETOUR_PCT,
                   cost_per_km: float = DEFAULT_COST_PER_KM) -> List[Dict[str, Any]]:
    """Return the best profitable route for each partial, sorted by margin desc."""
    best_by_partial: Dict[str, Dict[str, Any]] = {}

    for partial in partials:
        weight = float(partial.get("weight_kg", 0))
        rate = float(partial.get("rate_eur", 0))
        p_lat, p_lng = _pt(partial, "pickup")
        d_lat, d_lng = _pt(partial, "dropoff")

        for route in routes:
            spare = float(route.get("spare_kg", 0))
            if weight <= 0 or weight > spare:
                continue

            o_lat, o_lng = _pt(route, "origin")
            e_lat, e_lng = _pt(route, "destination")

            base = calculate_distance(o_lat, o_lng, e_lat, e_lng)
            if base <= 0:
                continue
            new_dist = (
                calculate_distance(o_lat, o_lng, p_lat, p_lng)
                + calculate_distance(p_lat, p_lng, d_lat, d_lng)
                + calculate_distance(d_lat, d_lng, e_lat, e_lng)
            )
            detour_km = max(0.0, new_dist - base)
            detour_pct = (detour_km / base) * 100.0
            if detour_pct > max_detour_pct:
                continue

            detour_cost = detour_km * cost_per_km
            margin = rate - detour_cost
            if margin <= 0:
                continue

            utilization = weight / spare if spare else 0
            score = int(max(0, min(100, 100 - detour_pct * 1.5 + utilization * 15)))
            detour_min = int((detour_km / 70.0) * 60) + 30  # + 30 min handling

            suggestion = {
                "route_id": route.get("id"),
                "route_label": route.get("label"),
                "partial_id": partial.get("id"),
                "partial_label": partial.get("label"),
                "detour_km": round(detour_km, 1),
                "detour_pct": round(detour_pct, 1),
                "detour_min": detour_min,
                "detour_cost_eur": round(detour_cost, 2),
                "added_revenue_eur": round(rate, 2),
                "margin_eur": round(margin, 2),
                "score": score,
            }
            prev = best_by_partial.get(partial.get("id"))
            if prev is None or suggestion["margin_eur"] > prev["margin_eur"]:
                best_by_partial[partial.get("id")] = suggestion

    return sorted(best_by_partial.values(), key=lambda s: s["margin_eur"], reverse=True)
