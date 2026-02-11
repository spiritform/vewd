# vewd

A media viewer for reviewing, comparing, and selecting images. Works on Mac and PC. Use it as a **standalone app** with any folder of images, or as a **ComfyUI node** that auto-captures generations.

![Vewd Screenshot](screenshot.png)

## Why Vewd?

**Reduce waste, save only what you want.** Instead of saving hundreds of images and sorting through them later, Vewd lets you review in real-time, heart your favorites, and export only your selects.

## Features

- **Grid + preview** - Thumbnail grid with side-by-side preview and compare
- **Heart favorites** - Spacebar to heart, filter to show only selects
- **All media types** - Images, videos, and audio
- **Media filters** - Filter by all, images, videos, or audio
- **Export selects** - Export hearted media to a `selects/` subfolder
- **Non-destructive** - Delete only removes from viewer, not your files

![Vewd Node Toolbar](screenshot2.png)

*Completely wireless clean and minimal UI design*

![Vewd Clean UI](screenshot3.png)

## ComfyUI Node

### Installation

#### Via Git

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/spiritform/vewd.git
```

Restart ComfyUI.

#### Manual

Download and extract to `ComfyUI/custom_nodes/vewd/`

### Usage

1. Add the **Vewd** node to your workflow (found in `image` category)
2. Run your workflow - media automatically appears in the grid
3. Click to preview, Ctrl+click or Shift+click to select multiple
4. Space to heart favorites
5. Click **export selects** to save hearted media

**No wiring needed** - Vewd captures everything automatically.

### Node Settings

- **folder** - Where to export hearted media (creates `/selects` subfolder)
- **filename_prefix** - Prefix for exported files (e.g., `myproject_001.png`)

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ← → ↑ ↓ | Navigate grid |
| Spacebar | Heart/unheart |
| Delete | Remove from viewer |
| Esc | Exit fullscreen |

## Standalone App

No ComfyUI required. Just Python.

```bash
# Windows
vewd.bat

# Mac / Linux
chmod +x vewd.sh
./vewd.sh

# or directly
python viewer.py path/to/images
```

Point it at any folder of images, videos, or audio. Opens a browser-based viewer to review, heart, compare, and export your selects.


## License

MIT
