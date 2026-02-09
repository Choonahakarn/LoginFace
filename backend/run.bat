@echo off
cd /d "%~dp0"
pip install -r requirements.txt
:loop
uvicorn main:app --reload --host 0.0.0.0 --port 8000
echo.
echo [Restart] Backend หยุดทำงาน — กำลังเริ่มใหม่อัตโนมัติใน 3 วินาที...
timeout /t 3 /nobreak >nul
goto loop
