@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo BookSaver necesita Node.js 22 o superior.
  echo Instala Node.js y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

echo Abriendo BookSaver en http://127.0.0.1:5173 ...
start "" "http://127.0.0.1:5173"
node src\server.js
pause
