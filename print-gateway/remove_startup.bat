@echo off
title Remove Office Print Gateway from Windows Startup
echo ================================================================
echo    REMOVE OFFICE PRINT GATEWAY FROM WINDOWS AUTO-START
echo ================================================================
echo.

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\OfficePrintGateway.bat"

if exist "%SHORTCUT_PATH%" (
    del "%SHORTCUT_PATH%"
    echo [SUCCESS] Removed Office Print Gateway from Windows Startup.
) else (
    echo [INFO] Gateway was not found in Windows Startup.
)

echo.
pause
