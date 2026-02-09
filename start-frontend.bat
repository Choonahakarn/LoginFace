@echo off
title Frontend - Face Attendance
cd /d "%~dp0app"
echo ========================================
echo   Frontend - Face Attendance
echo ========================================
echo.
echo Path: %CD%
echo.

if not exist "package.json" (
    echo [ERROR] package.json not found
    echo.
    pause
    exit /b 1
)

npm --version
echo.
echo Starting Frontend...
echo Frontend: http://localhost:5173
echo.
echo Press Ctrl+C to stop
echo.

npm run dev

pause
