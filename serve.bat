@echo off
rem Noman_trading — serve locally on http://localhost:8899 and open the browser
cd /d "%~dp0"
echo Serving Noman_trading at http://localhost:8899/  (Ctrl+C to stop)
start "" http://localhost:8899/
python -m http.server 8899
