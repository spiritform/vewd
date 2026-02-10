# Vewd

Simple image viewer for batch generations. Built for reviewing AI image outputs.

## Features

- **Auto-refresh** - New images appear automatically
- **Keyboard navigation** - Arrow keys to browse
- **Tagging** - Space to tag keepers
- **Compare** - Select 2 images for side-by-side view
- **Save selects** - Export tagged images with `_select01` suffix
- **ComfyUI integration** - Custom node sends images directly to viewer

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/spiritform/vewd.git
```

### 2. Run the viewer

```bash
cd vewd
python viewer.py "C:\path\to\your\images"
```

Or double-click `viewer.bat` (edit the default folder path first).

The viewer opens in your browser and watches the folder for new images.

## ComfyUI Node

### Install

Clone directly into ComfyUI's custom_nodes folder:

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/spiritform/vewd.git
```

Restart ComfyUI.

### Usage

1. Add **Vewd Preview** node (found under `image` category)
2. Connect it after VAE Decode
3. Set the `folder` path to where you want images saved
4. Run the viewer pointing to the same folder
5. Generate - images appear in viewer automatically

```
[VAE Decode] ──IMAGE──> [Vewd Preview]
                              │
                           folder: C:/AI/outputs/vewd
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ← → ↑ ↓ | Navigate grid |
| Space | Tag/untag image |
| T | Toggle tagged filter |
| S | Save tagged images |
| Delete | Remove from view |
| R | Refresh folder |
| Escape | Clear selection |
| Ctrl+Click | Multi-select |
| Shift+Click | Range select |

## Workflow

1. Start viewer: `python viewer.py "C:/AI/outputs/vewd"`
2. Generate images in ComfyUI with Vewd Preview node
3. Images appear in viewer as they're generated
4. Navigate with arrow keys, press **Space** to tag keepers
5. Press **T** to filter to tagged only
6. Press **S** to save tagged images (copies with `_select01` suffix)

## Requirements

- Python 3.8+
- Pillow

```bash
pip install Pillow
```

## License

MIT
