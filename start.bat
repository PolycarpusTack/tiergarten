@echo off
echo Starting Tiergarten...

REM Kill any existing processes on ports
echo Checking for processes on ports 3600 and 36590...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3600" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| find ":36590" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul

REM Start backend server
echo Starting backend server...
start "Tiergarten Backend" cmd /k "cd server && npm run dev"

REM Wait a moment for backend to start
timeout /t 3 /nobreak > nul

REM Start frontend
echo Starting frontend...
start "Tiergarten Frontend" cmd /k "npm start"

echo.
echo Tiergarten is starting...
echo Backend: http://localhost:3600
echo Frontend: http://localhost:36590
echo.
echo Press any key to stop all servers...
pause > nul

REM Kill the servers when done
taskkill /F /FI "WINDOWTITLE eq Tiergarten Backend*" 2>nul
taskkill /F /FI "WINDOWTITLE eq Tiergarten Frontend*" 2>nul