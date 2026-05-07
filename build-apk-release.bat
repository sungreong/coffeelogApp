@echo off
setlocal

cd /d "%~dp0"
set NODE_ENV=production

echo Building CoffeeLog release APK...
call npm run apk:release
if errorlevel 1 (
  echo.
  echo Build failed.
  pause
  exit /b 1
)

echo.
echo Build complete:
echo %CD%\android\app\build\outputs\apk\release\app-release.apk
echo.
echo Note: this project currently signs release builds with the Android debug keystore.
echo Use a private release keystore before Play Store or public production distribution.
pause
