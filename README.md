# VECTRA Platform

VECTRA is an intelligent digital marketplace for **unused truck capacity**, specialized in dynamic consolidation of Less-Than-Truckload (LTL) shipments. It allows carriers to monetize unused cargo space in partially loaded trucks that would otherwise drive empty kilometers.

This repository is built as a complete monorepo, encompassing the frontend UI, matching engine for routing and logistics matching, and scalable backend infrastructure.

## Project Structure

```text
vectra-platform/
├── frontend/         # Next.js (React) application
├── backend/          # Node.js Express backend
├── services/         # Microservices (e.g. Python Matching Engine)
├── database/         # Database migrations / initialization scripts
├── docs/             # Project documentation
├── docker-compose.yml# Docker orchestration
└── README.md         # This file
```

## Setup & Quick Start

1. Ensure [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/) are installed on your machine.
2. Clone this repository.
3. Copy `.env.example` to `.env` in the root directory.
4. Run `docker-compose up --build -d` to build and start the containers.
5. The services will be available at:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8080
   - Python Matching Engine: http://localhost:8000
   - PostgreSQL DB exposed on 5432
   - Redis exposed on 6379

## Technology Stack

- **Frontend**: Next.js, React, TailwindCSS, TypeScript, Leaflet.js
- **Backend API**: Node.js, Express, TypeScript, Socket.io
- **Microservices**: Python, FastAPI
- **Database**: PostgreSQL (relational DB for users, shipments, bookings, etc.)
- **Caching**: Redis
- **Infra**: Docker, Docker Compose

## Development

Please refer to `docs/CONTRIBUTING.md` for guidelines on branching strategies, creating Pull Requests, and working collaboratively in this monorepo.

For a detailed view of the REST API, consult `docs/API.md`.
