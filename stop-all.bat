@echo off
echo ========================================
echo   Face Attendance System - Stop All
echo ========================================
echo.

echo [1/2] Stopping Frontend (port 5173)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo   - Stopped Process ID: %%a
)

echo [2/2] Stopping Backend (port 8000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo   - Stopped Process ID: %%a
)

REM Stop uvicorn and python processes
taskkill /IM uvicorn.exe /F >nul 2>&1
taskkill /IM python.exe /F >nul 2>&1

echo.
echo ========================================
echo   Stopped Successfully!
echo ========================================
timeout /t 2 /nobreak >nul
