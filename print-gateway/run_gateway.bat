@echo off
title Office Smart Print Gateway
echo ================================================================
echo           OFFICE SMART PRINT GATEWAY (OFFLINE LAUNCHER)
echo ================================================================
echo  No internet package installation (pip) required.
echo  Uses native Python standard library.
echo ================================================================
echo.

:: Check if Python is installed
python --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Python 3 is not found in your system PATH!
    echo Please install Python 3 (check "Add Python to PATH") and try again.
    echo.
    pause
    exit /b 1
)

:: Create .env from .env.example if missing
if not exist .env (
    if exist .env.example (
        echo [INFO] Creating initial .env configuration file...
        copy .env.example .env >nul
    )
)

echo [INFO] Starting Print Gateway service...
echo Press Ctrl+C at any time to stop.
echo.

python gateway.py

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [NOTICE] Gateway exited with code %ERRORLEVEL%.
    pause
)
