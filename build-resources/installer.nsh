; NSIS installer script for Kanso with thumbnail provider support
; This script is included by electron-builder during Windows installer creation.
;
; The thumbnail provider is a .NET Framework 4.x COM DLL loaded via mscoree.dll.
; Because Kanso installs per-user without elevation by default, we write the full
; .NET COM registration keys under SHCTX (HKCU\Software\Classes for per-user,
; HKLM\Software\Classes for per-machine) and also invoke RegAsm.exe when
; elevated. Setting DisableProcessIsolation=1 and DisableLowILProcessIsolation=1
; keeps Windows Explorer loading the provider at medium IL so it can read
; %LOCALAPPDATA%\Programs\Kanso and spawn ffmpeg.exe.

!define KANSO_THUMB_CLSID "{E8F3A4C0-5D8B-4A3E-9B2F-1C7D8E9F0A1B}"
!define KANSO_THUMB_INTERFACE "{e357fccd-a995-4576-b01f-234630154e96}"
!define KANSO_THUMB_INTERFACE_LEGACY "{e357fccd-a995-4576-b01f-234630154c96}"
!define KANSO_THUMB_CAT_MANAGED "{62C8FE65-4EBB-45e7-B440-6E39B2CDBF29}"
!define KANSO_THUMB_CLASS "KansoThumbnailProvider.VideoThumbnailProvider"
!define KANSO_THUMB_ASSEMBLY "KansoThumbnailProvider, Version=1.0.0.0, Culture=neutral, PublicKeyToken=null"
!define KANSO_THUMB_RUNTIME "v4.0.30319"
!define KANSO_THUMB_DESC "Kanso Video Thumbnail Provider"
!define KANSO_THUMB_PROGID "KansoThumbnailProvider.VideoThumbnailProvider"
!define KANSO_THUMB_ALT_PROGID "Kanso.VideoThumbnailProvider"
!define KANSO_APPROVED_KEY "Software\Microsoft\Windows\CurrentVersion\Shell Extensions\Approved"

!macro _KansoFindRegAsm _RegAsmVar
  StrCpy ${_RegAsmVar} "$WINDIR\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"
  ${IfNot} ${FileExists} "${_RegAsmVar}"
    StrCpy ${_RegAsmVar} "$WINDIR\Microsoft.NET\Framework\v4.0.30319\RegAsm.exe"
  ${EndIf}
!macroend

!macro _KansoBackslashToForward _InVar _OutVar
  Push $R0
  Push $R1
  Push $R2
  Push $R3
  StrCpy $R0 "${_InVar}"
  StrCpy $R1 ""
  StrLen $R2 $R0
  ${DoWhile} $R2 > 0
    StrCpy $R3 $R0 1
    StrCpy $R0 $R0 "" 1
    ${If} $R3 == "\"
      StrCpy $R1 "$R1/"
    ${Else}
      StrCpy $R1 "$R1$R3"
    ${EndIf}
    IntOp $R2 $R2 - 1
  ${Loop}
  StrCpy ${_OutVar} $R1
  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
!macroend

!macro _KansoWriteClsidKeys _Root _CodeBaseUrl
  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}" "" "${KANSO_THUMB_DESC}"
  WriteRegDWORD ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}" "DisableProcessIsolation" 1
  WriteRegDWORD ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}" "DisableLowILProcessIsolation" 1

  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\InprocServer32" "" "mscoree.dll"
  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\InprocServer32" "ThreadingModel" "Both"
  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\InprocServer32" "Class" "${KANSO_THUMB_CLASS}"
  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\InprocServer32" "Assembly" "${KANSO_THUMB_ASSEMBLY}"
  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\InprocServer32" "RuntimeVersion" "${KANSO_THUMB_RUNTIME}"
  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\InprocServer32" "CodeBase" "${_CodeBaseUrl}"

  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\InprocServer32\1.0.0.0" "Class" "${KANSO_THUMB_CLASS}"
  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\InprocServer32\1.0.0.0" "Assembly" "${KANSO_THUMB_ASSEMBLY}"
  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\InprocServer32\1.0.0.0" "RuntimeVersion" "${KANSO_THUMB_RUNTIME}"
  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\InprocServer32\1.0.0.0" "CodeBase" "${_CodeBaseUrl}"

  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\ProgId" "" "${KANSO_THUMB_PROGID}"
  WriteRegStr ${_Root} "Software\Classes\CLSID\${KANSO_THUMB_CLSID}\Implemented Categories\${KANSO_THUMB_CAT_MANAGED}" "" ""

  WriteRegStr ${_Root} "Software\Classes\${KANSO_THUMB_PROGID}" "" "${KANSO_THUMB_CLASS}"
  WriteRegStr ${_Root} "Software\Classes\${KANSO_THUMB_PROGID}\CLSID" "" "${KANSO_THUMB_CLSID}"

  WriteRegStr ${_Root} "${KANSO_APPROVED_KEY}" "${KANSO_THUMB_CLSID}" "${KANSO_THUMB_DESC}"
!macroend

!macro _KansoDeleteShellexIfOwned _Root _ShellexParent
  ClearErrors
  ReadRegStr $R7 ${_Root} "${_ShellexParent}\${KANSO_THUMB_INTERFACE}" ""
  ${IfNot} ${Errors}
  ${AndIf} "$R7" == "${KANSO_THUMB_CLSID}"
    DeleteRegKey ${_Root} "${_ShellexParent}\${KANSO_THUMB_INTERFACE}"
  ${EndIf}

  ClearErrors
  ReadRegStr $R7 ${_Root} "${_ShellexParent}\${KANSO_THUMB_INTERFACE_LEGACY}" ""
  ${IfNot} ${Errors}
  ${AndIf} "$R7" == "${KANSO_THUMB_CLSID}"
    DeleteRegKey ${_Root} "${_ShellexParent}\${KANSO_THUMB_INTERFACE_LEGACY}"
  ${EndIf}

  DeleteRegKey /ifempty ${_Root} "${_ShellexParent}"
!macroend

; Thumbnail shell extensions have to be registered in several places because
; Windows resolves them through whichever ProgID currently owns the file type.
; To cover every case we write the shellex association into:
;   1. SHCTX Software\Classes\.<ext>\shellex\{guid}
;   2. SHCTX Software\Classes\SystemFileAssociations\.<ext>\shellex\{guid}
;   3. SHCTX Software\Classes\Kanso Video\shellex\{guid}
;   4. HKCU UserChoice ProgId -> SHCTX Software\Classes\<ProgId>\shellex\{guid}
;   5. HKCR\.<ext> default ProgId -> SHCTX Software\Classes\<ProgId>\shellex\{guid}
!macro _KansoWriteThumbnailAssoc _Ext
  !insertmacro _KansoDeleteShellexIfOwned SHCTX "Software\Classes\${_Ext}\shellex"
  !insertmacro _KansoDeleteShellexIfOwned SHCTX "Software\Classes\SystemFileAssociations\${_Ext}\shellex"
  WriteRegStr SHCTX "Software\Classes\${_Ext}\shellex\${KANSO_THUMB_INTERFACE}" "" "${KANSO_THUMB_CLSID}"
  WriteRegStr SHCTX "Software\Classes\SystemFileAssociations\${_Ext}\shellex\${KANSO_THUMB_INTERFACE}" "" "${KANSO_THUMB_CLSID}"

  ClearErrors
  ReadRegStr $R8 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\${_Ext}\UserChoice" "ProgId"
  ${IfNot} ${Errors}
  ${AndIf} "$R8" != ""
    !insertmacro _KansoDeleteShellexIfOwned SHCTX "Software\Classes\$R8\shellex"
    WriteRegStr SHCTX "Software\Classes\$R8\shellex\${KANSO_THUMB_INTERFACE}" "" "${KANSO_THUMB_CLSID}"
    DetailPrint "Thumbnail assoc: ${_Ext} (UserChoice=$R8)"
  ${EndIf}

  ClearErrors
  ReadRegStr $R9 HKCR "${_Ext}" ""
  ${IfNot} ${Errors}
  ${AndIf} "$R9" != ""
    !insertmacro _KansoDeleteShellexIfOwned SHCTX "Software\Classes\$R9\shellex"
    WriteRegStr SHCTX "Software\Classes\$R9\shellex\${KANSO_THUMB_INTERFACE}" "" "${KANSO_THUMB_CLSID}"
    DetailPrint "Thumbnail assoc: ${_Ext} (ProgID=$R9)"
  ${EndIf}
!macroend

!macro _KansoDeleteThumbnailAssoc _Ext
  !insertmacro _KansoDeleteShellexIfOwned SHCTX "Software\Classes\${_Ext}\shellex"
  !insertmacro _KansoDeleteShellexIfOwned SHCTX "Software\Classes\SystemFileAssociations\${_Ext}\shellex"
  !insertmacro _KansoDeleteShellexIfOwned HKLM "Software\Classes\${_Ext}\shellex"
  !insertmacro _KansoDeleteShellexIfOwned HKLM "Software\Classes\SystemFileAssociations\${_Ext}\shellex"

  ClearErrors
  ReadRegStr $R8 HKCU "Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\${_Ext}\UserChoice" "ProgId"
  ${IfNot} ${Errors}
  ${AndIf} "$R8" != ""
    !insertmacro _KansoDeleteShellexIfOwned SHCTX "Software\Classes\$R8\shellex"
    !insertmacro _KansoDeleteShellexIfOwned HKLM "Software\Classes\$R8\shellex"
  ${EndIf}

  ClearErrors
  ReadRegStr $R9 HKCR "${_Ext}" ""
  ${IfNot} ${Errors}
  ${AndIf} "$R9" != ""
    !insertmacro _KansoDeleteShellexIfOwned SHCTX "Software\Classes\$R9\shellex"
    !insertmacro _KansoDeleteShellexIfOwned HKLM "Software\Classes\$R9\shellex"
  ${EndIf}
!macroend

; SHCNE_ASSOCCHANGED = 0x08000000, SHCNF_IDLIST = 0x0000
!ifndef SHCNE_ASSOCCHANGED
  !define SHCNE_ASSOCCHANGED 0x08000000
!endif
!ifndef SHCNF_IDLIST
  !define SHCNF_IDLIST 0x0000
!endif

!macro _KansoNotifyShell
  ; Ask the shell to refresh file associations without restarting Explorer.
  ; Killing explorer.exe is fragile on Win10/11 and can leave the desktop
  ; without a shell, so we prefer this soft-refresh instead.
  System::Call 'shell32::SHChangeNotify(i ${SHCNE_ASSOCCHANGED}, i ${SHCNF_IDLIST}, i 0, i 0)'
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Welcome to Kanso Setup"
  !define MUI_WELCOMEPAGE_TEXT "Kanso is a modern media player focused on convenience, beauty, and performance.$\r$\n$\r$\nClick Next to continue."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Remove Kanso"
  !define MUI_WELCOMEPAGE_TEXT "Kanso will be removed from your computer.$\r$\n$\r$\nYour library and settings are kept and will be available if you install Kanso again."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend

!macro customInstall
  DetailPrint "Installing Kanso Video Thumbnail Provider..."

  StrCpy $0 "$INSTDIR\resources\app.asar.unpacked\build-resources\windows-thumbnail-provider\bin\KansoThumbnailProvider.dll"

  ${If} ${FileExists} "$0"
    !insertmacro _KansoBackslashToForward "$0" $3
    StrCpy $4 "file:///$3"

    ; Try RegAsm when elevated / per-machine; enforce mscoree.dll + isolation flags if it succeeds.
    !insertmacro _KansoFindRegAsm $1
    ${If} ${FileExists} "$1"
      nsExec::ExecToLog '"$1" /codebase /s "$0"'
      Pop $2
      ${If} $2 == 0
        !insertmacro _KansoWriteClsidKeys HKLM "$4"
        DetailPrint "Thumbnail provider COM server registered via RegAsm (HKLM)"
      ${Else}
        DetailPrint "Per-user install: registering thumbnail provider COM server under SHCTX"
      ${EndIf}
    ${Else}
      DetailPrint "RegAsm.exe not found; registering thumbnail provider COM server directly"
    ${EndIf}

    ; Always write full CLSID keys under SHCTX so non-admin per-user installs work
    ; and override any stale HKLM entries.
    !insertmacro _KansoWriteClsidKeys SHCTX "$4"

    ; Explicitly wire Kanso Video ProgID as well as extension/UserChoice/HKCR targets
    !insertmacro _KansoDeleteShellexIfOwned SHCTX "Software\Classes\Kanso Video\shellex"
    WriteRegStr SHCTX "Software\Classes\Kanso Video\shellex\${KANSO_THUMB_INTERFACE}" "" "${KANSO_THUMB_CLSID}"

    !insertmacro _KansoWriteThumbnailAssoc ".mp4"
    !insertmacro _KansoWriteThumbnailAssoc ".mkv"
    !insertmacro _KansoWriteThumbnailAssoc ".webm"
    !insertmacro _KansoWriteThumbnailAssoc ".mov"
    !insertmacro _KansoWriteThumbnailAssoc ".avi"
    !insertmacro _KansoWriteThumbnailAssoc ".m4v"
    !insertmacro _KansoWriteThumbnailAssoc ".ts"
  ${Else}
    DetailPrint "Warning: Thumbnail provider DLL not found at $0. Skipping."
  ${EndIf}

  !insertmacro _KansoNotifyShell
  DetailPrint "Thumbnails will appear as you browse folders. Existing cached"
  DetailPrint "icons may take a moment to refresh, or sign out/in once."
!macroend

!macro customUnInstall
  DetailPrint "Uninstalling Kanso Video Thumbnail Provider..."

  !insertmacro _KansoDeleteShellexIfOwned SHCTX "Software\Classes\Kanso Video\shellex"
  !insertmacro _KansoDeleteShellexIfOwned HKLM "Software\Classes\Kanso Video\shellex"

  !insertmacro _KansoDeleteThumbnailAssoc ".mp4"
  !insertmacro _KansoDeleteThumbnailAssoc ".mkv"
  !insertmacro _KansoDeleteThumbnailAssoc ".webm"
  !insertmacro _KansoDeleteThumbnailAssoc ".mov"
  !insertmacro _KansoDeleteThumbnailAssoc ".avi"
  !insertmacro _KansoDeleteThumbnailAssoc ".m4v"
  !insertmacro _KansoDeleteThumbnailAssoc ".ts"

  StrCpy $0 "$INSTDIR\resources\app.asar.unpacked\build-resources\windows-thumbnail-provider\bin\KansoThumbnailProvider.dll"
  ${If} ${FileExists} "$0"
    !insertmacro _KansoFindRegAsm $1
    ${If} ${FileExists} "$1"
      nsExec::ExecToLog '"$1" /u /s "$0"'
      Pop $2
      DetailPrint "Thumbnail provider COM server unregistered via RegAsm ($2)"
    ${EndIf}
  ${EndIf}

  ClearErrors
  DeleteRegKey SHCTX "Software\Classes\CLSID\${KANSO_THUMB_CLSID}"
  DeleteRegKey SHCTX "Software\Classes\${KANSO_THUMB_PROGID}"
  DeleteRegKey SHCTX "Software\Classes\${KANSO_THUMB_ALT_PROGID}"
  DeleteRegValue SHCTX "${KANSO_APPROVED_KEY}" "${KANSO_THUMB_CLSID}"

  DeleteRegKey HKLM "Software\Classes\CLSID\${KANSO_THUMB_CLSID}"
  DeleteRegKey HKLM "Software\Classes\${KANSO_THUMB_PROGID}"
  DeleteRegKey HKLM "Software\Classes\${KANSO_THUMB_ALT_PROGID}"
  DeleteRegValue HKLM "${KANSO_APPROVED_KEY}" "${KANSO_THUMB_CLSID}"
  DeleteRegValue HKCU "${KANSO_APPROVED_KEY}" "${KANSO_THUMB_CLSID}"
  ClearErrors

  !insertmacro _KansoNotifyShell
!macroend
