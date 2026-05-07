@echo off
setlocal

cd /d "%~dp0"

echo Building CoffeeLog debug APK...
call npm run apk:debug
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Build complete:
echo %CD%\android\app\build\outputs\apk\debug\app-debug.apk
pause
