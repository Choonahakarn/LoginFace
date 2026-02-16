@echo off
cd /d "%~dp0"

echo ========================================
echo   Face Attendance System - Start All
echo ========================================
echo.

echo [1/2] Starting Backend (with Auto-Reload)...
cd backend
start "Backend - Face Attendance API" cmd /k "python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000"
cd ..

echo [2/2] Starting Frontend (with Hot Module Replacement)...
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
echo   Auto-Reload Enabled:
echo   - Backend:  Auto-reloads when Python files change
echo   - Frontend: Auto-reloads when code files change (HMR)
echo.
echo   Backend and Frontend are running in separate windows.
echo   Press any key to close this window...
pause
