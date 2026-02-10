# Vewd

A media viewer node for ComfyUI. Auto-captures all generated images into a grid for easy review, tagging, and export.

![Vewd Screenshot](screenshot.png)

## Why Vewd?

**Reduce waste, save only what you want.** Instead of saving hundreds of images to your hard drive and sorting through them later, Vewd lets you review generations in real-time, tag the ones you like, and export only your selects.

## Features

- **Auto-capture** - Automatically captures all images generated in your workflow
- **Grid view** - See all generations in a thumbnail grid
- **Preview** - Click to preview full size
- **Tagging** - Space to tag your favorites
- **Export selects** - Export tagged images with custom filename prefix
- **Fullscreen** - Expand to fullscreen for better viewing
- **Duplicate detection** - Only shows new images, skips cached results

## Installation

### Via Git

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/spiritform/vewd.git
```

Restart ComfyUI.

### Manual

Download and extract to `ComfyUI/custom_nodes/vewd/`

## Usage

1. Add the **Vewd** node to your workflow (found in `image` category)
2. Run your workflow - images automatically appear in the grid
3. Click images to preview, Space to tag favorites
4. Click **Export** to save tagged images

No wiring needed - it captures everything automatically.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ← → ↑ ↓ | Navigate grid |
| Space | Tag/untag image |
| Delete | Remove from grid |
| T | Toggle tagged filter |
| Esc | Exit fullscreen |

## Node Settings

- **folder** - Where to export tagged images (creates `/selects` subfolder)
- **filename_prefix** - Prefix for exported files (e.g., `myproject_001.png`)

## License

MIT
