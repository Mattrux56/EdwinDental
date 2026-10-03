@echo off
cd /d "%~dp0"
title LabTrace
where node >nul 2>nul || (echo No se encontro Node.js. Instalalo desde https://nodejs.org & pause & exit /b 1)
node scripts\start.mjs
if errorlevel 1 pause
