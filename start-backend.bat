@echo off
title Backend - Face Attendance
cd /d "%~dp0backend"
echo ========================================
echo   Backend - Face Attendance API
echo ========================================
echo.
echo Path: %CD%
echo.

if not exist "main.py" (
    echo [ERROR] main.py not found
    echo.
    pause
    exit /b 1
)

python --version
echo.
echo Starting Backend...
echo Backend: http://localhost:8000
echo.
echo Press Ctrl+C to stop
echo.

python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

pause
