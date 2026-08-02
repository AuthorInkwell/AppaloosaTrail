@echo off
title The Appaloosa Trail
cd /d "%~dp0"

rem Windows ships with PowerShell, so there is nothing to install. Bypass only
rem applies to this one command; it does not change any machine settings.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0launcher\serve.ps1"

rem If PowerShell could not start at all, say so instead of vanishing.
if errorlevel 9009 (
  echo.
  echo   Could not start Windows PowerShell, which this launcher needs.
  echo   You can still play by opening the file:
  echo.
  echo     game\index.html
  echo.
  echo   ...in Chrome, Edge or Firefox.
  echo.
  pause
)
