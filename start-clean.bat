@echo off
echo Cleaning up Tiergarten processes...

REM Kill any node processes
echo Stopping any running Node.js processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak > nul

REM Check if ports are free
echo Checking ports...
netstat -ano | findstr :3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo Port 3000 is still in use. Trying to free it...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
        echo Killing process %%a
        taskkill /F /PID %%a 2>nul
    )
)

netstat -ano | findstr :3001 >nul 2>&1
if %errorlevel% equ 0 (
    echo Port 3001 is still in use. Trying to free it...
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do (
        echo Killing process %%a
        taskkill /F /PID %%a 2>nul
    )
)

timeout /t 2 /nobreak > nul

echo.
echo Starting Tiergarten...
echo.

REM Start the dev server
npm run dev