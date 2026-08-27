@echo off
title Install Office Print Gateway on Windows Startup
echo ================================================================
echo    CONFIGURE OFFICE PRINT GATEWAY TO AUTO-START ON PC BOOT
echo ================================================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\OfficePrintGateway.bat"
set "CURRENT_DIR=%~dp0"

echo Creating auto-start launcher in Windows Startup folder...
(
    echo @echo off
    echo cd /d "%CURRENT_DIR%"
    echo start "" pythonw gateway.py
) > "%SHORTCUT_PATH%"

if exist "%SHORTCUT_PATH%" (
    echo.
    echo [SUCCESS] Office Print Gateway has been registered to Windows Startup!
    echo Every time this PC turns on, the gateway will automatically start
    echo in the background and connect to your cloud portal.
    echo.
    echo Location: %SHORTCUT_PATH%
) else (
    echo.
    echo [ERROR] Failed to write to Startup folder. Please run as Administrator.
)

echo.
pause
