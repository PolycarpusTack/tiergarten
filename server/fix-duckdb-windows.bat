@echo off
echo Fixing DuckDB installation for Windows...
echo.

REM Remove existing DuckDB packages
echo Removing existing DuckDB packages...
call npm uninstall @duckdb/node-api @duckdb/node-bindings

REM Clear npm cache
echo Clearing npm cache...
call npm cache clean --force

REM Reinstall DuckDB
echo Reinstalling DuckDB for Windows...
call npm install @duckdb/node-api

echo.
echo Done! Try running start.bat again.