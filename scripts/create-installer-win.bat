@echo off
echo 🌌 Starting VST GOD Windows Installer Compilation...

cd %~dp0\..

set "ISCC_PATH="
if exist "C:\Program Files (x86)\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files (x86)\Inno Setup 6\ISCC.exe"
if exist "C:\Program Files\Inno Setup 6\ISCC.exe" set "ISCC_PATH=C:\Program Files\Inno Setup 6\ISCC.exe"

if "%ISCC_PATH%"=="" (
    echo ❌ Error: Inno Setup 6 Compiler (ISCC.exe) not found in standard paths.
    echo Please install Inno Setup 6 or configure its location in this script.
    exit /b 1
)

echo 🔨 Compiling installer using %ISCC_PATH%...
"%ISCC_PATH%" scripts\installer.iss

echo ✅ Success! Installer generated at: build\VST_God_The_God_Realm_Installer.exe
