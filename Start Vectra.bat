@echo off
REM Launch the full Vectra stack (3 apps + API + DB) via Docker Compose.
REM
REM NOTE: a 0-byte stub C:\Windows\system32\docker.exe shadows the real Docker
REM CLI on PATH and causes "This app can't run on your PC". We call the real
REM docker.exe by full path to avoid it. (Delete the stub to fix it globally:
REM   del "C:\Windows\system32\docker.exe"   — run as Administrator.)
cd /d "%~dp0"

set "DOCKER_EXE=C:\Program Files\Docker\Docker\resources\bin\docker.exe"
if not exist "%DOCKER_EXE%" set "DOCKER_EXE=docker"

start "" "http://localhost:3001"
"%DOCKER_EXE%" compose up --build
