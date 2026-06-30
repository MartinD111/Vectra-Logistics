@echo off
REM Launch the full Vectra stack (3 apps + API + DB) via Docker Compose.
cd /d "%~dp0"
start "" "http://localhost:3001"
docker compose up --build
