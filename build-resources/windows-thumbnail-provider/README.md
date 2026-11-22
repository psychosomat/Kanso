# Kanso Video Thumbnail Provider

Windows COM shell thumbnail provider (`IThumbnailProvider`) for generating video thumbnails in File Explorer.

## Building

Requires .NET Framework 4.8 (or .NET SDK / Visual Studio MSBuild / built-in .NET 4.x `csc.exe`). Produces `bin\KansoThumbnailProvider.dll` targeting AnyCPU:

```powershell
powershell -ExecutionPolicy Bypass -File build.ps1
```

Or from the repository root:

```bash
bun run build:thumbnail:win
```

## Installing

Run `register.bat` (registers per-user under `HKCU\Software\Classes` when non-admin, or system-wide via `RegAsm.exe` when run as Administrator):

```bat
register.bat
```

## Uninstalling

Run `unregister.bat`:

```bat
unregister.bat
```

## How it works

The thumbnail provider:
1. Implements `IThumbnailProvider`, `IInitializeWithItem` (using `IShellItem::GetDisplayName(SIGDN_FILESYSPATH)`), and `IInitializeWithFile` so Explorer passes file paths directly without copying videos to temp files.
2. Runs in-process at normal user medium IL (`InprocServer32` = `mscoree.dll`, `DisableProcessIsolation = 1`, `DisableLowILProcessIsolation = 1`) so it can read `%LOCALAPPDATA%\Programs\Kanso` and spawn `ffmpeg.exe`.
3. Extracts a frame with `ffmpeg.exe` (seeking to `00:00:01` with fallback to `00:00:00`), composites the `kanso-logo.png` watermark, and returns a top-down 32bpp `BI_RGB` DIB section (`CreateDIBSection`) with premultiplied ARGB pixels.

## Supported formats

- MP4 (`.mp4`)
- MKV (`.mkv`)
- WebM (`.webm`)
- MOV (`.mov`)
- AVI (`.avi`)
- M4V (`.m4v`)
- TS (`.ts`)
