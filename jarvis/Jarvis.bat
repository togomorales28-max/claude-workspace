@echo off
REM Doble clic para encender Jarvis en Windows (abre su propia ventana).
cd /d "%~dp0"
start "Jarvis (no cierres esta ventana)" /min node server.js --open
