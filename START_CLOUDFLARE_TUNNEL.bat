@echo off
title Icon Tech Pro ERP - Cloudflare Temporary HTTPS UAT Tunnel
color 0B
cls
echo ========================================================================
echo       ICON TECH PRO ERP v7.0 — SECURE CLOUDFLARE HTTPS UAT TUNNEL
echo ========================================================================
echo.
echo [INFO] Verifying local ERP server on port 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$active = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if (-not $active) { Write-Host '[WARNING] ERP Server on port 3000 is not running. Starting ERP...' -ForegroundColor Yellow; cscript //nologo 'C:\ICON-TECH-PRO-ERP\run_erp_silent.vbs'; Start-Sleep -Seconds 4 }"

echo.
echo [STARTING] Launching Cloudflare Quick Tunnel...
echo [SECURITY] Zero router port forwarding. End-to-end TLS encrypted tunnel.
echo.
echo ========================================================================
echo Look for your temporary public HTTPS link below:
echo Example: https://xxxx.trycloudflare.com
echo Share this HTTPS link with external UAT testers.
echo ========================================================================
echo.
echo Press Ctrl+C anytime to stop the tunnel.
echo ------------------------------------------------------------------------
echo.
"%LOCALAPPDATA%\cloudflared\cloudflared.exe" tunnel --url http://localhost:3000
pause
