@echo off
cd /d "%~dp0"
title LabTrace
where node >nul 2>nul
if errorlevel 1 (
  echo No se encontro Node.js. Se abrira la pagina de descarga.
  echo Instala la version LTS, y luego vuelve a abrir LabTrace.bat
  start https://nodejs.org
  pause
  exit /b 1
)
if not exist "backend\.env" (
  echo Primera vez: hay que pegar las claves de Supabase.
  copy "backend\.env.example" "backend\.env" >nul
  echo Se abrira un archivo: reemplaza los valores [REF], [PASSWORD], etc., guarda y cierra el Bloc de notas.
  notepad "backend\.env"
)
rem Crea el acceso directo en el escritorio la primera vez (si ya existe, no hace nada)
powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\acceso-directo.ps1" >nul 2>nul
node scripts\start.mjs
if errorlevel 1 pause
