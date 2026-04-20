; NSIS installer script for Kanso with thumbnail provider support
; This script is included by electron-builder during Windows installer creation.
;
; The thumbnail provider is a .NET Framework 4.x COM DLL so it must be
; registered with RegAsm.exe /codebase — regsvr32 cannot register managed
; assemblies.

!define KANSO_THUMB_CLSID "{E8F3A4C0-5D8B-4A3E-9B2F-1C7D8E9F0A1B}"
!define KANSO_THUMB_INTERFACE "{e357fccd-a995-4576-b01f-234630154c96}"

!macro _KansoFindRegAsm _RegAsmVar
  StrCpy ${_RegAsmVar} "$WINDIR\Microsoft.NET\Framework64\v4.0.30319\RegAsm.exe"
  ${IfNot} ${FileExists} "${_RegAsmVar}"
    StrCpy ${_RegAsmVar} "$WINDIR\Microsoft.NET\Framework\v4.0.30319\RegAsm.exe"
  ${EndIf}
!macroend

; Thumbnail shell extensions have to be registered in several places because
; Windows resolves them through whichever ProgID currently owns the file type.
; When Kanso is the user's default app for a given extension, the extension's
; default value points at a ProgID (e.g. "Kanso Video"), and the shell looks
; for shellex under HKCR\<ProgID>\shellex\..., NOT HKCR\.<ext>\shellex\... .
;
; To cover every case we write the shellex association into three locations:
;   1. HKCR\.<ext>\shellex\{guid}                      (ext fallback)
;   2. HKCR\SystemFileAssociations\.<ext>\shellex\{guid} (system-wide)
;   3. HKCR\<currentProgId>\shellex\{guid}             (ProgID active right now)
!macro _KansoWriteThumbnailAssoc _Ext
  WriteRegStr HKCR "${_Ext}\shellex\${KANSO_THUMB_INTERFACE}" "" "${KANSO_THUMB_CLSID}"
  WriteRegStr HKCR "SystemFileAssociations\${_Ext}\shellex\${KANSO_THUMB_INTERFACE}" "" "${KANSO_THUMB_CLSID}"
  ClearErrors
  ReadRegStr $R9 HKCR "${_Ext}" ""
  ${If} ${Errors}
  ${OrIf} "$R9" == ""
  ${Else}
    WriteRegStr HKCR "$R9\shellex\${KANSO_THUMB_INTERFACE}" "" "${KANSO_THUMB_CLSID}"
    DetailPrint "Thumbnail assoc: ${_Ext} (ProgID=$R9)"
  ${EndIf}
!macroend

!macro _KansoDeleteThumbnailAssoc _Ext
  DeleteRegKey HKCR "${_Ext}\shellex\${KANSO_THUMB_INTERFACE}"
  DeleteRegKey HKCR "SystemFileAssociations\${_Ext}\shellex\${KANSO_THUMB_INTERFACE}"
  ClearErrors
  ReadRegStr $R9 HKCR "${_Ext}" ""
  ${If} ${Errors}
  ${OrIf} "$R9" == ""
  ${Else}
    DeleteRegKey HKCR "$R9\shellex\${KANSO_THUMB_INTERFACE}"
  ${EndIf}
!macroend

; SHCNE_ASSOCCHANGED = 0x08000000, SHCNF_IDLIST = 0x0000
!define SHCNE_ASSOCCHANGED 0x08000000
!define SHCNF_IDLIST 0x0000

!macro _KansoNotifyShell
  ; Ask the shell to refresh file associations without restarting Explorer.
  ; Killing explorer.exe is fragile on Win10/11 and can leave the desktop
  ; without a shell, so we prefer this soft-refresh instead.
  System::Call 'shell32::SHChangeNotify(i ${SHCNE_ASSOCCHANGED}, i ${SHCNF_IDLIST}, i 0, i 0)'
!macroend

!macro customInstall
  DetailPrint "Installing Kanso Video Thumbnail Provider..."

  StrCpy $0 "$INSTDIR\resources\app.asar.unpacked\build-resources\windows-thumbnail-provider\bin\KansoThumbnailProvider.dll"

  ${If} ${FileExists} "$0"
    !insertmacro _KansoFindRegAsm $1
    ${If} ${FileExists} "$1"
      nsExec::ExecToLog '"$1" /codebase /s "$0"'
      Pop $2
      ${If} $2 == 0
        DetailPrint "Thumbnail provider COM server registered"
      ${Else}
        DetailPrint "Warning: RegAsm.exe exited with code $2"
      ${EndIf}
    ${Else}
      DetailPrint "Warning: RegAsm.exe not found. Install .NET Framework 4.x."
    ${EndIf}

    ; Wire shellex\{IThumbnailProvider} -> our CLSID for each supported extension
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

  StrCpy $0 "$INSTDIR\resources\app.asar.unpacked\build-resources\windows-thumbnail-provider\bin\KansoThumbnailProvider.dll"

  ${If} ${FileExists} "$0"
    !insertmacro _KansoFindRegAsm $1
    ${If} ${FileExists} "$1"
      nsExec::ExecToLog '"$1" /u /s "$0"'
      Pop $2
      DetailPrint "Thumbnail provider COM server unregistered"
    ${EndIf}
  ${EndIf}

  !insertmacro _KansoDeleteThumbnailAssoc ".mp4"
  !insertmacro _KansoDeleteThumbnailAssoc ".mkv"
  !insertmacro _KansoDeleteThumbnailAssoc ".webm"
  !insertmacro _KansoDeleteThumbnailAssoc ".mov"
  !insertmacro _KansoDeleteThumbnailAssoc ".avi"
  !insertmacro _KansoDeleteThumbnailAssoc ".m4v"
  !insertmacro _KansoDeleteThumbnailAssoc ".ts"

  !insertmacro _KansoNotifyShell
!macroend
