@echo off
cd /d "%~dp0apps\workspaces"
start "" "http://localhost:3001"
npm run dev
