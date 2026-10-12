@echo off
setlocal
cd /d "%~dp0"
title SheboyHaat Setup
echo ==========================================
echo        SHEBOYHAAT - FIRST TIME SETUP
echo ==========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install the LTS version from https://nodejs.org and run this file again.
  pause
  exit /b 1
)
if not exist "backend\node_modules" (
  echo Installing backend packages. This may take a few minutes...
  pushd backend
  call npm install
  if errorlevel 1 (popd & echo Backend install failed. Check internet and try again. & pause & exit /b 1)
  popd
)
if not exist "frontend\node_modules" (
  echo Installing frontend packages. This may take a few minutes...
  pushd frontend
  call npm install
  if errorlevel 1 (popd & echo Frontend install failed. Check internet and try again. & pause & exit /b 1)
  popd
)
if not exist "backend\.env" copy "backend\.env.example" "backend\.env" >nul
echo.
echo Starting backend and frontend in separate windows...
start "SheboyHaat Backend" cmd /k "cd /d ""%~dp0backend"" && npm run dev"
timeout /t 3 /nobreak >nul
start "SheboyHaat Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev -- --host 127.0.0.1"
timeout /t 4 /nobreak >nul
echo.
echo Open this address in Chrome: http://127.0.0.1:5173
echo Admin panel: http://127.0.0.1:5173/admin
echo Keep both black terminal windows open while using the website.
echo.
pause
