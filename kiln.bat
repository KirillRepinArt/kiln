@echo off
rem Kiln launcher: starts the local server (if it isn't running) and opens Kiln in its own Edge window.
setlocal
cd /d "%~dp0"

rem Kiln only talks to localhost; a system proxy (VPN clients) must not get in the way.
set NO_PROXY=*
set no_proxy=*

set PORT=7870
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command "try{(Get-Content config.local.json -Raw | ConvertFrom-Json).port}catch{}"`) do set PORT=%%p

where py >nul 2>nul && (set "PY=py -3") || (set "PY=python")

rem Start the server unless something already answers on the port.
powershell -NoProfile -Command "$c=New-Object Net.Sockets.TcpClient; try{$c.Connect('127.0.0.1',%PORT%);exit 0}catch{exit 1}finally{$c.Dispose()}"
if errorlevel 1 (
  start "Kiln server" /min %PY% -u server.py
  timeout /t 2 /nobreak >nul
)

set "EDGE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not exist "%EDGE%" set "EDGE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if exist "%EDGE%" (
  start "" "%EDGE%" --app=http://127.0.0.1:%PORT% --window-size=1400,900
) else (
  start "" http://127.0.0.1:%PORT%
)
