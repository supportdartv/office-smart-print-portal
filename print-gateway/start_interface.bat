@echo off
title Office Smart Print - PC Control Panel
echo ================================================================
echo          OFFICE SMART PRINT - PC CONTROL PANEL
echo ================================================================
echo Launching Gateway Desktop Interface...
echo.

python gui_gateway.py
if errorlevel 1 (
    echo.
    echo GUI could not start. Falling back to Console Monitor...
    python gateway.py
)

pause
