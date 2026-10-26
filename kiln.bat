@echo off
rem Kiln launcher: finds Python, then Kiln does the rest (server\launch.py) — uses the Kiln already running for this
rem data folder or starts one (its log in a minimized "Kiln server" window), and opens Kiln in its own window:
rem Edge, else Chrome / Chromium, else your default browser.
setlocal
cd /d "%~dp0"

rem Kiln only talks to localhost; a system proxy (VPN clients) must not get in the way.
set NO_PROXY=*
set no_proxy=*

where py >nul 2>nul && (set "PY=py -3") || (set "PY=python")
%PY% --version >nul 2>nul
if errorlevel 1 (
  echo Kiln needs Python 3.10 or newer: https://www.python.org/downloads/
  pause
  exit /b 1
)

%PY% -m server --launch
if errorlevel 1 pause
