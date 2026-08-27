@echo off
title Office Smart Print Gateway - Offline Setup
echo ================================================================
echo           OFFICE SMART PRINT GATEWAY - OFFLINE SETUP
echo ================================================================
echo This offline setup validates your local environment without
echo requiring any internet connection or external pip downloads.
echo ================================================================
echo.

echo [1/3] Checking Python installation...
python --version
if %ERRORLEVEL% NEQ 0 (
    echo [FAIL] Python is not installed or not in PATH.
    echo Please install Python 3.8+ on this PC first.
    pause
    exit /b 1
)
echo [OK] Python detected successfully.

echo.
echo [2/3] Preparing configuration file (.env)...
if not exist .env (
    if exist .env.example (
        copy .env.example .env >nul
        echo [OK] Created .env configuration file from template.
    ) else (
        echo [WARN] .env.example not found.
    )
) else (
    echo [OK] Existing .env file found.
)

echo.
echo [3/3] Creating local job spool cache directory...
if not exist temp_jobs (
    mkdir temp_jobs
)
echo [OK] Local storage ready.

echo.
echo ================================================================
echo  Offline Installation & Setup Complete!
echo  Double-click "run_gateway.bat" or run "python gateway.py" to start.
echo ================================================================
echo.
pause
