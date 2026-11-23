@echo off
REM Registers the Kanso Video Thumbnail Provider COM server and file
REM associations for local development/debugging.
REM Supports both elevated system-wide registration (HKLM via RegAsm) and
REM non-admin per-user registration (HKCU\Software\Classes).

setlocal
set "DLL_PATH=%~dp0bin\KansoThumbnailProvider.dll"
set "CLSID={E8F3A4C0-5D8B-4A3E-9B2F-1C7D8E9F0A1B}"
set "IFACE={e357fccd-a995-4576-b01f-234630154e96}"
set "LEGACY_IFACE={e357fccd-a995-4576-b01f-234630154c96}"
set "CATID={62C8FE65-4EBB-45e7-B440-6E39B2CDBF29}"
set "CLASS_NAME=KansoThumbnailProvider.VideoThumbnailProvider"
set "ASSEMBLY_NAME=KansoThumbnailProvider, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null"
set "RUNTIME_VER=v4.0.30319"
set "PROGID_NAME=KansoThumbnailProvider.VideoThumbnailProvider"
set "PROVIDER_DESC=Kanso Video Thumbnail Provider"
set "APPROVED_KEY=Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved"

set "REG_VIEW="
if exist "%WINDIR%\SysWOW64" set "REG_VIEW=/reg:64"

if not exist "%DLL_PATH%" (
    echo Error: DLL not found at %DLL_PATH%
    echo Please build the thumbnail provider first: bun run build:thumbnail:win
    if /i not "%~1"=="--silent" if /i not "%~1"=="/s" pause
    exit /b 1
)

set "IS_ADMIN=0"
net session >nul 2>&1
if %errorlevel%==0 set "IS_ADMIN=1"

if "%IS_ADMIN%"=="1" (
    set "REG_ROOT=HKLM"
    set "CLASSES_ROOT=HKLM\Software\Classes"
    set "REGASM=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"
    if not exist "%REGASM%" set "REGASM=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\RegAsm.exe"
    if not exist "%REGASM%" (
        echo Error: RegAsm.exe not found. Install .NET Framework 4.x.
        if /i not "%~1"=="--silent" if /i not "%~1"=="/s" pause
        exit /b 1
    )

    echo Registering COM server ^(system-wide via RegAsm^)...
    "%REGASM%" /codebase /s "%DLL_PATH%"
    if errorlevel 1 (
        echo Error: RegAsm failed.
        if /i not "%~1"=="--silent" if /i not "%~1"=="/s" pause
        exit /b 1
    )

    REM Ensure mscoree.dll remains intact and disable process isolation
    reg add "HKLM\Software\Classes\CLSID\%CLSID%" /ve /t REG_SZ /d "%PROVIDER_DESC%" /f %REG_VIEW% >nul
    reg add "HKLM\Software\Classes\CLSID\%CLSID%" /v DisableProcessIsolation /t REG_DWORD /d 1 /f %REG_VIEW% >nul
    reg add "HKLM\Software\Classes\CLSID\%CLSID%" /v DisableLowILProcessIsolation /t REG_DWORD /d 1 /f %REG_VIEW% >nul
    reg add "HKLM\Software\Classes\CLSID\%CLSID%\InprocServer32" /ve /t REG_SZ /d "mscoree.dll" /f %REG_VIEW% >nul
    reg add "HKLM\Software\Classes\CLSID\%CLSID%\InprocServer32" /v ThreadingModel /t REG_SZ /d "Both" /f %REG_VIEW% >nul
    reg add "HKLM\%APPROVED_KEY%" /v "%CLSID%" /t REG_SZ /d "%PROVIDER_DESC%" /f %REG_VIEW% >nul
) else (
    set "REG_ROOT=HKCU"
    set "CLASSES_ROOT=HKCU\Software\Classes"
    echo Not elevated; registering COM server per-user ^(HKCU\Software\Classes^)...

    reg add "HKCU\Software\Classes\CLSID\%CLSID%" /ve /t REG_SZ /d "%PROVIDER_DESC%" /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\CLSID\%CLSID%" /v DisableProcessIsolation /t REG_DWORD /d 1 /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\CLSID\%CLSID%" /v DisableLowILProcessIsolation /t REG_DWORD /d 1 /f %REG_VIEW% >nul

    reg add "HKCU\Software\Classes\CLSID\%CLSID%\InprocServer32" /ve /t REG_SZ /d "mscoree.dll" /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\CLSID\%CLSID%\InprocServer32" /v ThreadingModel /t REG_SZ /d "Both" /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\CLSID\%CLSID%\InprocServer32" /v Class /t REG_SZ /d "%CLASS_NAME%" /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\CLSID\%CLSID%\InprocServer32" /v Assembly /t REG_SZ /d "%ASSEMBLY_NAME%" /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\CLSID\%CLSID%\InprocServer32" /v RuntimeVersion /t REG_SZ /d "%RUNTIME_VER%" /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\CLSID\%CLSID%\InprocServer32" /v CodeBase /t REG_SZ /d "file:///%DLL_PATH:\=/%" /f %REG_VIEW% >nul

    reg add "HKCU\Software\Classes\CLSID\%CLSID%\InprocServer32\1.0.0.0" /v Class /t REG_SZ /d "%CLASS_NAME%" /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\CLSID\%CLSID%\InprocServer32\1.0.0.0" /v Assembly /t REG_SZ /d "%ASSEMBLY_NAME%" /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\CLSID\%CLSID%\InprocServer32\1.0.0.0" /v RuntimeVersion /t REG_SZ /d "%RUNTIME_VER%" /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\CLSID\%CLSID%\InprocServer32\1.0.0.0" /v CodeBase /t REG_SZ /d "file:///%DLL_PATH:\=/%" /f %REG_VIEW% >nul

    reg add "HKCU\Software\Classes\CLSID\%CLSID%\ProgId" /ve /t REG_SZ /d "%PROGID_NAME%" /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\CLSID\%CLSID%\Implemented Categories\%CATID%" /f %REG_VIEW% >nul

    reg add "HKCU\Software\Classes\%PROGID_NAME%" /ve /t REG_SZ /d "%CLASS_NAME%" /f %REG_VIEW% >nul
    reg add "HKCU\Software\Classes\%PROGID_NAME%\CLSID" /ve /t REG_SZ /d "%CLSID%" /f %REG_VIEW% >nul

    reg add "HKCU\%APPROVED_KEY%" /v "%CLSID%" /t REG_SZ /d "%PROVIDER_DESC%" /f %REG_VIEW% >nul
)

echo Registering file associations under %CLASSES_ROOT%...
call :delete_if_owned "%CLASSES_ROOT%\Kanso Video\shellex\%LEGACY_IFACE%"
reg add "%CLASSES_ROOT%\Kanso Video\shellex\%IFACE%" /ve /t REG_SZ /d "%CLSID%" /f %REG_VIEW% >nul

for %%E in (.mp4 .mkv .webm .mov .avi .m4v .ts) do (
    call :delete_if_owned "%CLASSES_ROOT%\%%E\shellex\%LEGACY_IFACE%"
    call :delete_if_owned "%CLASSES_ROOT%\SystemFileAssociations\%%E\shellex\%LEGACY_IFACE%"
    reg add "%CLASSES_ROOT%\%%E\shellex\%IFACE%" /ve /t REG_SZ /d "%CLSID%" /f %REG_VIEW% >nul
    reg add "%CLASSES_ROOT%\SystemFileAssociations\%%E\shellex\%IFACE%" /ve /t REG_SZ /d "%CLSID%" /f %REG_VIEW% >nul

    for /f "tokens=2,*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\%%E\UserChoice" /v ProgId %REG_VIEW% 2^>nul ^| findstr /i "REG_SZ"') do (
        call :wire_progid "%%E" "UserChoice" "%%B"
    )

    for /f "tokens=2,*" %%A in ('reg query "HKCR\%%E" /ve %REG_VIEW% 2^>nul ^| findstr /i "REG_SZ"') do (
        call :wire_progid "%%E" "ProgID" "%%B"
    )
)

powershell -NoProfile -Command "Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class KansoShell { [DllImport(\"shell32.dll\")] public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2); }'; [KansoShell]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)" >nul 2>&1

echo.
echo Thumbnail provider registered successfully.
echo Restart Windows Explorer if cached thumbnails do not refresh immediately.
echo.
if /i not "%~1"=="--silent" if /i not "%~1"=="/s" pause
endlocal
exit /b 0

:wire_progid
set "EXT=%~1"
set "KIND=%~2"
set "PROG=%~3"
if "%PROG%"=="" exit /b 0
if /i "%PROG%"=="(value not set)" exit /b 0
call :delete_if_owned "%CLASSES_ROOT%\%PROG%\shellex\%LEGACY_IFACE%"
reg add "%CLASSES_ROOT%\%PROG%\shellex\%IFACE%" /ve /t REG_SZ /d "%CLSID%" /f %REG_VIEW% >nul
echo   %EXT% -^> %KIND% %PROG%
exit /b 0

:delete_if_owned
set "TARGET=%~1"
reg query "%TARGET%" /ve %REG_VIEW% 2>nul | findstr /i "%CLSID%" >nul
if %errorlevel%==0 reg delete "%TARGET%" /f %REG_VIEW% >nul 2>&1
exit /b 0
