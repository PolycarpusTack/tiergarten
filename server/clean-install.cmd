@echo off
echo Cleaning and reinstalling server dependencies...
echo.

REM Force remove node_modules
echo Removing node_modules...
rmdir /s /q node_modules 2>nul
del /f /q package-lock.json 2>nul

echo.
echo Installing new dependencies...
npm install

echo.
echo Installation complete!