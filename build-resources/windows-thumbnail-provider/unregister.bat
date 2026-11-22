@echo off
REM Unregisters the Kanso Video Thumbnail Provider COM server and file
REM associations from HKCU and (when elevated) HKLM.

setlocal
set "DLL_PATH=%~dp0bin\KansoThumbnailProvider.dll"
set "CLSID={E8F3A4C0-5D8B-4A3E-9B2F-1C7D8E9F0A1B}"
set "IFACE={e357fccd-a995-4576-b01f-234630154c96}"
set "PROGID_NAME=KansoThumbnailProvider.VideoThumbnailProvider"
set "ALT_PROGID=Kanso.VideoThumbnailProvider"
set "APPROVED_KEY=Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved"

set "REG_VIEW="
if exist "%WINDIR%\SysWOW64" set "REG_VIEW=/reg:64"

set "IS_ADMIN=0"
net session >nul 2>&1
if %errorlevel%==0 set "IS_ADMIN=1"

echo Removing file associations...
call :clean_root "HKCU\Software\Classes"
if "%IS_ADMIN%"=="1" call :clean_root "HKLM\Software\Classes"

echo Removing COM registration keys...
reg delete "HKCU\Software\Classes\CLSID\%CLSID%" /f %REG_VIEW% >nul 2>&1
reg delete "HKCU\Software\Classes\%PROGID_NAME%" /f %REG_VIEW% >nul 2>&1
reg delete "HKCU\Software\Classes\%ALT_PROGID%" /f %REG_VIEW% >nul 2>&1
reg delete "HKCU\%APPROVED_KEY%" /v "%CLSID%" /f %REG_VIEW% >nul 2>&1

if "%IS_ADMIN%"=="1" (
    if exist "%DLL_PATH%" (
        set "REGASM=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"
        if not exist "%REGASM%" set "REGASM=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\RegAsm.exe"
        if exist "%REGASM%" (
            echo Unregistering COM server via RegAsm...
            "%REGASM%" /u /s "%DLL_PATH%"
        )
    )
    reg delete "HKLM\Software\Classes\CLSID\%CLSID%" /f %REG_VIEW% >nul 2>&1
    reg delete "HKLM\Software\Classes\%PROGID_NAME%" /f %REG_VIEW% >nul 2>&1
    reg delete "HKLM\Software\Classes\%ALT_PROGID%" /f %REG_VIEW% >nul 2>&1
    reg delete "HKLM\%APPROVED_KEY%" /v "%CLSID%" /f %REG_VIEW% >nul 2>&1
)

powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class KansoShell { [DllImport(\"shell32.dll\")] public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2); }'; [KansoShell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)" >nul 2>&1

echo.
echo Thumbnail provider unregistered.
echo Restart Windows Explorer for changes to take effect.
echo.
if /i not "%~1"=="--silent" if /i not "%~1"=="/s" pause
endlocal
exit /b 0

:clean_root
set "CLASSES_ROOT=%~1"
call :delete_if_owned "%CLASSES_ROOT%\Kanso Video\shellex\%IFACE%"
for %%E in (.mp4 .mkv .webm .mov .avi .m4v .ts) do (
    call :delete_if_owned "%CLASSES_ROOT%\%%E\shellex\%IFACE%"
    call :delete_if_owned "%CLASSES_ROOT%\SystemFileAssociations\%%E\shellex\%IFACE%"
    for /f "tokens=2,*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\%%E\UserChoice" /v ProgId %REG_VIEW% 2^>nul ^| findstr /i "REG_SZ"') do (
        call :delete_progid_if_owned "%CLASSES_ROOT%" "%%B"
    )
    for /f "tokens=2,*" %%A in ('reg query "HKCR\%%E" /ve %REG_VIEW% 2^>nul ^| findstr /i "REG_SZ"') do (
        call :delete_progid_if_owned "%CLASSES_ROOT%" "%%B"
    )
)
exit /b 0

:delete_progid_if_owned
set "CR=%~1"
set "PROG=%~2"
if "%PROG%"=="" exit /b 0
if /i "%PROG%"=="(value not set)" exit /b 0
call :delete_if_owned "%CR%\%PROG%\shellex\%IFACE%"
exit /b 0

:delete_if_owned
set "TARGET=%~1"
reg query "%TARGET%" /ve %REG_VIEW% 2>nul | findstr /i "%CLSID%" >nul
if %errorlevel%==0 reg delete "%TARGET%" /f %REG_VIEW% >nul 2>&1
exit /b 0
