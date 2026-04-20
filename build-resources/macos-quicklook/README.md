# Kanso Video Quick Look Generator

macOS Quick Look generator for displaying video thumbnails in Finder.

## Building

Requires Xcode and macOS SDK.

```bash
xcodebuild -project KansoQuickLook.xcodeproj -scheme KansoQuickLook -configuration Release
```

## Installing

Copy the generated `.qlgenerator` bundle to:

```bash
~/Library/QuickLook/
```

Or system-wide:

```bash
/Library/QuickLook/
```

Then restart Quick Look:

```bash
qlmanage -r
qlmanage -r cache
```

## Uninstalling

Remove the bundle from the QuickLook directory and restart Quick Look:

```bash
qlmanage -r
qlmanage -r cache
```

## Supported formats

- MP4
- MKV
- WebM
- MOV
- AVI
- M4V
- TS
