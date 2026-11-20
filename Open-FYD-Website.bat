@echo off
cd /d "%~dp0"
start "FYD Namma Namakkal Server" cmd /c "node server.js"
timeout /t 2 /nobreak >nul
start "" http://localhost:4173
