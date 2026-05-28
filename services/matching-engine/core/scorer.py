import math
from typing import Dict, Any, Tuple

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine formula to calculate distance between two coordinates in km."""
    R = 6371  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2) * math.sin(dlat/2) + \
        math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * \
        math.sin(dlon/2) * math.sin(dlon/2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c

def calculate_match_score(shipment: Dict[str, Any], capacity: Dict[str, Any]) -> Tuple[int, float, int]:
    """
    Calculates a match score from 0-100 between a shipment and truck capacity.
    Returns: (score, detour_distance_km, added_time_minutes)
    """
    # 1. Capacity Constraints
    if shipment.get("cargo_weight_kg", 0) > capacity.get("available_weight_kg", 0):
        return 0, 0.0, 0
    if shipment.get("cargo_volume_m3", 0) > capacity.get("available_volume_m3", 0):
        return 0, 0.0, 0

    # 2. Extract coordinates
    s_lat, s_lng = shipment.get("pickup_lat", 0), shipment.get("pickup_lng", 0)
    d_lat, d_lng = shipment.get("delivery_lat", 0), shipment.get("delivery_lng", 0)
    c_lat, c_lng = capacity.get("origin_lat", 0), capacity.get("origin_lng", 0)
    c_dest_lat, c_dest_lng = capacity.get("destination_lat", 0), capacity.get("destination_lng", 0)

    # 3. Distance Calculations (straight-line fallback)
    # Original Route
    original_dist = calculate_distance(c_lat, c_lng, c_dest_lat, c_dest_lng)
    
    # New Route (Origin -> Pickup -> Delivery -> Destination)
    new_dist = (
        calculate_distance(c_lat, c_lng, s_lat, s_lng) + 
        calculate_distance(s_lat, s_lng, d_lat, d_lng) + 
        calculate_distance(d_lat, d_lng, c_dest_lat, c_dest_lng)
    )

    detour_dist = max(0, new_dist - original_dist)
    
    # Calculate detour percentage (limit max to 100%)
    if original_dist == 0:
        detour_percent = 100
    else:
        detour_percent = (detour_dist / original_dist) * 100

    # Rule: If detour is > 15%, we don't match. (Except for extremely short routes, but keeping logic simple)
    if detour_percent > 15.0:
        return 0, detour_dist, 0

    # 4. Added Time (Assuming average 70 km/h)
    added_time_hours = detour_dist / 70.0
    added_time_minutes = int(added_time_hours * 60) + 60 # + 60 mins for loading/unloading

    # 5. Score Calculation (0-100)
    # Base score 100, minus penalties for detour and time
    score = 100 - (detour_percent * 2) - (added_time_minutes / 10)
    
    # Capacity Utilization Efficiency Bonus (up to +10)
    utilization = shipment.get("cargo_weight_kg", 0) / max(capacity.get("available_weight_kg", 1), 1)
    score += (utilization * 10)

    final_score = min(100, max(0, int(score)))

    return final_score, round(detour_dist, 2), added_time_minutes
