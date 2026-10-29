@echo off
rem Lance un petit serveur local puis ouvre le jeu dans le navigateur.
cd /d "%~dp0"
start "" cmd /c "timeout /t 2 >nul & start http://localhost:8766/"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serveur.ps1" -Port 8766 -Root "%~dp0."
