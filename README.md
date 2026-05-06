# easy-trim

A lightweight desktop video trimmer. Load a video, mark the parts you want, and export them stitched into a single file.

Built with Electron, React, TypeScript, and FFmpeg.

---

## Features

- **Non-destructive segment editing** — drag on the timeline to define in/out points; resize edges to adjust
- **Multi-select** — Ctrl/Shift-click segments, invert selection, delete in bulk
- **Timeline navigation** — zoom with Ctrl+scroll, pan with right-click drag
- **Full undo/redo** — edge-drag coalescing means one resize = one undo step
- **Video rotation** — 90° rotation applied at export
- **Export** — selected segments concatenated into a single `_trimmed.mp4` with real-time progress

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Space` | Play / pause |
| `J` / `K` / `L` | Rewind 10s / pause / forward 10s |
| `←` / `→` | Step one frame |
| `Shift+←` / `Shift+→` | Step one second |
| `I` | Set in-point at current time |
| `O` | Set out-point and commit segment |
| `R` | Rotate 90° |
| `F` | Toggle fullscreen |
| `Ctrl+O` | Open video file |
| `Ctrl+E` | Export |
| `Ctrl+A` | Select all segments |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Delete` / `Backspace` | Delete selected segments |
| `Escape` | Clear selection / cancel in-point / exit fullscreen |

---

## Getting started

```bash
npm install
npm run dev
```

### Build

```bash
# Build for current platform (unpacked)
npm run package

# Build installer (NSIS on Windows, DMG on macOS, AppImage on Linux)
npm run make
```

---

## Export details

- **Input formats:** MP4, M4V, MOV
- **Output format:** MP4 (H.264, CRF 21, AAC 192k)
- Source is always re-encoded — no passthrough
- Output file defaults to `<original name>_trimmed.mp4`
