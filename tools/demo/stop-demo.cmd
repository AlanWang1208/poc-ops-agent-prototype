@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..\..") do set "REPO_ROOT=%%~fI"
set "PID_DIR=%REPO_ROOT%\.demo\pids"

echo ============================================================
echo Ops Agent Windows Demo Stopper
echo ============================================================
echo.

if not exist "%PID_DIR%" (
  echo No PID directory found: %PID_DIR%
  echo If demo windows are still open, close windows titled:
  echo   OpsAgent Demo Worker
  echo   OpsAgent Demo Control Plane
  echo   OpsAgent Demo Console
  pause
  exit /b 0
)

for %%F in ("%PID_DIR%\*.pid") do (
  if exist "%%~fF" (
    for /f "usebackq delims=" %%P in ("%%~fF") do (
      if not "%%P"=="" (
        echo Stopping PID %%P from %%~nxF
        taskkill /PID %%P /T /F >nul 2>nul
        if errorlevel 1 (
          echo PID %%P was already stopped or could not be stopped.
        )
      )
    )
  )
)

echo Applying fixed demo window title fallback...
taskkill /FI "WINDOWTITLE eq OpsAgent Demo Worker" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq OpsAgent Demo Control Plane" /T /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq OpsAgent Demo Console" /T /F >nul 2>nul

echo.
echo Demo stop command completed. Logs remain in .demo\logs.
pause
exit /b 0
