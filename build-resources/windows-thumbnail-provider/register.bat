@echo off
REM Registers the Kanso Video Thumbnail Provider COM server and file
REM associations for local development/debugging. Must be run as Administrator.
REM
REM The DLL is a .NET Framework 4.x assembly, so we register it via RegAsm,
REM not regsvr32 (which cannot load managed assemblies).

setlocal
set "DLL_PATH=%~dp0bin\KansoThumbnailProvider.dll"
set "CLSID={E8F3A4C0-5D8B-4A3E-9B2F-1C7D8E9F0A1B}"
set "IFACE={e357fccd-a995-4576-b01f-234630154c96}"

if not exist "%DLL_PATH%" (
    echo Error: DLL not found at %DLL_PATH%
    echo Please build the thumbnail provider first: bun run build:thumbnail:win
    pause
    exit /b 1
)

set "REGASM=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"
if not exist "%REGASM%" set "REGASM=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\RegAsm.exe"
if not exist "%REGASM%" (
    echo Error: RegAsm.exe not found. Install .NET Framework 4.x.
    pause
    exit /b 1
)

echo Registering COM server...
"%REGASM%" /codebase /s "%DLL_PATH%"
if errorlevel 1 (
    echo Error: RegAsm failed with code %errorlevel%
    pause
    exit /b 1
)

echo Registering file associations...
REM Windows resolves the IThumbnailProvider shellex through the extension's
REM ProgID when one is active (e.g. Kanso is set as default), so we need to
REM register in three parallel locations to cover every configuration.
for %%E in (.mp4 .mkv .webm .mov .avi .m4v .ts) do (
    reg add "HKCR\%%E\shellex\%IFACE%" /ve /t REG_SZ /d "%CLSID%" /f >nul
    reg add "HKCR\SystemFileAssociations\%%E\shellex\%IFACE%" /ve /t REG_SZ /d "%CLSID%" /f >nul
    for /f "tokens=2,*" %%A in ('reg query "HKCR\%%E" /ve 2^>nul ^| findstr /i "REG_SZ"') do (
        if not "%%B"=="" (
            reg add "HKCR\%%B\shellex\%IFACE%" /ve /t REG_SZ /d "%CLSID%" /f >nul
            echo   %%E -^> ProgID %%B
        )
    )
)

echo.
echo Thumbnail provider registered successfully.
echo Restart Windows Explorer for changes to take effect.
echo.
pause
endlocal
