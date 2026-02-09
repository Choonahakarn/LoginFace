@echo off
cd /d "%~dp0"

echo ========================================
echo   Face Attendance System - Start All
echo ========================================
echo.

echo [1/2] Starting Backend...
cd backend
start "Backend - Face Attendance API" cmd /k "python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
cd ..

echo [2/2] Starting Frontend...
cd app
start "Frontend - Face Attendance" cmd /k "npm run dev"
cd ..

echo.
echo ========================================
echo   Started Successfully!
echo ========================================
echo.
echo   Backend:  http://localhost:8000
echo   Frontend: http://localhost:5173
echo.
echo   Backend and Frontend are running in separate windows.
echo   Press any key to close this window...
pause
