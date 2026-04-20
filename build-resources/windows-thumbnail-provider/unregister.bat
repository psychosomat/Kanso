@echo off
REM Unregisters the Kanso Video Thumbnail Provider. Must be run as Administrator.

setlocal
set "DLL_PATH=%~dp0bin\KansoThumbnailProvider.dll"
set "IFACE={e357fccd-a995-4576-b01f-234630154c96}"

echo Removing file associations...
for %%E in (.mp4 .mkv .webm .mov .avi .m4v .ts) do (
    reg delete "HKCR\%%E\shellex\%IFACE%" /f >nul 2>&1
    reg delete "HKCR\SystemFileAssociations\%%E\shellex\%IFACE%" /f >nul 2>&1
    for /f "tokens=2,*" %%A in ('reg query "HKCR\%%E" /ve 2^>nul ^| findstr /i "REG_SZ"') do (
        if not "%%B"=="" reg delete "HKCR\%%B\shellex\%IFACE%" /f >nul 2>&1
    )
)

if exist "%DLL_PATH%" (
    set "REGASM=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"
    if not exist "%REGASM%" set "REGASM=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\RegAsm.exe"
    if exist "%REGASM%" (
        echo Unregistering COM server...
        "%REGASM%" /u /s "%DLL_PATH%"
    ) else (
        echo Warning: RegAsm.exe not found, skipping COM unregistration.
    )
) else (
    echo Warning: DLL not found at %DLL_PATH%, skipping COM unregistration.
)

echo.
echo Thumbnail provider unregistered.
echo Restart Windows Explorer for changes to take effect.
echo.
pause
endlocal
