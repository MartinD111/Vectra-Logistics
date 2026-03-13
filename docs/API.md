# VECTRA API Endpoints

This document outlines the core backend endpoints (Node.js) and matching-engine endpoints (Python).

## Node.js Backend API (Base: `/api`)

### Authentication
- `POST /api/auth/register`: Register user
- `POST /api/auth/login`: Authenticate and return JWT token

### Shipments
- `POST /api/shipments`: Create a new shipment request
- `GET /api/shipments`: List available shipments
- `GET /api/shipments/:id`: Get shipment details

### Capacity
- `POST /api/capacity`: Post available truck capacity
- `GET /api/capacity`: List published capacities
- `GET /api/capacity/:id`: Get truck capacity listing details

### Bookings & Matches
- `GET /api/matches`: List matches based on user's active listings/shipments
- `POST /api/bookings`: Confirm a booking (agree to a match)

### Documents
- `POST /api/documents/generate-cmr`: Trigger generation of a CMR document

## Python Matching Engine (Base: `/`)

The backend interacts with this internally.

- `POST /match`: Given a shipment or capacity, calculates potential matches and returns a score array.
- `GET /ping`: Health check endpoint.
