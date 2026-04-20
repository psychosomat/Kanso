# Kanso Video Thumbnail Provider

Windows COM server for generating video thumbnails in File Explorer.

## Building

Requires .NET Framework 4.8 and MSBuild.

```bash
msbuild KansoThumbnailProvider.csproj /p:Configuration=Release /p:Platform=x64
```

## Installing

Run the registration script as Administrator:

```bash
register.bat
```

## Uninstalling

Run the unregistration script as Administrator:

```bash
unregister.bat
```

## How it works

The thumbnail provider:
1. Implements the IThumbnailProvider COM interface
2. Uses ffmpeg to extract a frame from the video file
3. Returns the frame as a bitmap to Windows Explorer

## Supported formats

- MP4
- MKV
- WebM
- MOV
- AVI
- M4V
- TS
