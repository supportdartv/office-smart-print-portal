#!/usr/bin/env bash
echo "================================================================"
echo "          OFFICE SMART PRINT GATEWAY (OFFLINE LAUNCHER)"
echo "================================================================"
echo " No pip packages required. Pure Python 3 standard library."
echo "================================================================"

if ! command -v python3 &> /dev/null
then
    echo "[ERROR] Python 3 could not be found. Please install Python 3."
    exit 1
fi

if [ ! -f .env ] && [ -f .env.example ]; then
    echo "[INFO] Creating .env from .env.example..."
    cp .env.example .env
fi

mkdir -p temp_jobs

echo "[INFO] Starting Print Gateway..."
python3 gateway.py
