@echo off
rem Kiln launcher: starts the local server (if it isn't running) and opens Kiln in its own Edge window.
setlocal
cd /d "%~dp0"

rem Kiln only talks to localhost; a system proxy (VPN clients) must not get in the way.
set NO_PROXY=*
set no_proxy=*

where py >nul 2>nul && (set "PY=py -3") || (set "PY=python")

set PORT=7870
if exist config.local.json (
  for /f "usebackq delims=" %%p in (`%PY% -c "import json;print(int(json.load(open('config.local.json',encoding='utf-8')).get('port',7870)))" 2^>nul`) do set PORT=%%p
)

rem Start the server unless something already answers on the port.
powershell -NoProfile -Command "$c=New-Object Net.Sockets.TcpClient; try{$c.Connect('127.0.0.1',%PORT%);exit 0}catch{exit 1}finally{$c.Dispose()}"
if errorlevel 1 start "Kiln server" /min %PY% -u server.py

rem Wait until the server answers (first start can take a few seconds), up to ~20 s.
powershell -NoProfile -Command "for($i=0;$i -lt 40;$i++){$c=New-Object Net.Sockets.TcpClient;try{$c.Connect('127.0.0.1',%PORT%);exit 0}catch{Start-Sleep -Milliseconds 500}finally{$c.Dispose()}};exit 1"
if errorlevel 1 (
  echo Kiln server did not start - see the "Kiln server" window for the error.
  pause
  exit /b 1
)

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  rem Own Edge instance: separate profile (so the flags apply even if Edge is already open) and no proxy,
  rem so VPN clients that hijack the system proxy can't block 127.0.0.1.
  start "" "%EDGE%" --user-data-dir="%LOCALAPPDATA%\Kiln\Edge" --no-proxy-server --no-first-run --no-default-browser-check --app=http://127.0.0.1:%PORT% --window-size=1400,900
) else (
  start "" http://127.0.0.1:%PORT%
)
