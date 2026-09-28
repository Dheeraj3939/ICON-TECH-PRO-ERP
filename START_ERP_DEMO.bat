@echo off
title Icon Tech Pro ERP - Network Launcher (v7.0 Production)
color 0A
cls
echo ========================================================================
echo             ICON TECH PRO - ENTERPRISE ERP SYSTEM v7.0
echo      Ameer Estate, 503 A Block, SR Nagar, Hyderabad - 500038
echo ========================================================================
echo.

:: 1. Check if Node is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not found on your system PATH!
    pause
    exit /b 1
)

:: 2. Check if Next.js production build exists
if not exist "C:\ICON-TECH-PRO-ERP\.next" (
    echo [SETUP] Production build not found. Running npm run build (one-time)...
    cd /d "C:\ICON-TECH-PRO-ERP"
    call npm run build
    echo.
)

:: 3. Check if server is already running on port 3000
powershell -NoProfile -ExecutionPolicy Bypass -Command "$active = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue; if (-not $active) { cscript //nologo 'C:\ICON-TECH-PRO-ERP\run_erp_silent.vbs'; Start-Sleep -Seconds 4 }"

:: 4. Get active Wi-Fi IP Address
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-NetIPAddress -InterfaceAlias 'Wi-Fi*' -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notlike '169.254*' } | Select-Object -First 1).IPAddress"`) do set WIFI_IP=%%i

if "%WIFI_IP%"=="" (
    set WIFI_IP=192.168.1.108
)

echo [STATUS] Latest ICON TECH PRO ERP v7.0 is ACTIVE on all network interfaces.
echo.
echo ========================================================================
echo   Wi-Fi Connection IP : %WIFI_IP%
echo.
echo   >>> SHARE WITH 6 USERS ON WI-FI:
echo       http://%WIFI_IP%:3000
echo.
echo   >>> YOUR LOCAL ACCESS:
echo       http://localhost:3000
echo ========================================================================
echo.
echo    Configured Staff Personas Ready for 1-Click Role Switch:
echo   1. Narsimha Naidu  (Managing Director)
echo   2. Dheeraj         (Admin / BDM)
echo   3. Vineet Babu     (BDM)
echo   4. Reshma          (Sales Executive)
echo   5. Hemalatha       (Accounts)
echo   6. Manisha         (Office Assistant)
echo.
echo ------------------------------------------------------------------------
echo NOTE: The ERP server is running in the background and will STAY OPEN
echo continuously until you run STOP_ERP_DEMO.bat or say "stop".
echo You can safely close or minimize this window.
echo ------------------------------------------------------------------------
echo.
start http://localhost:3000
pause
