@echo off
setlocal
cd /d "%~dp0.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-codex-skills.ps1"
if errorlevel 1 (
  echo.
  echo Falha na instalacao. Veja a mensagem acima.
  pause
  exit /b 1
)
echo.
pause
