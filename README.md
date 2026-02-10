# Vewd

Simple image viewer for batch generations. Built for reviewing AI image outputs.

## Features

- **Auto-refresh** - New images appear automatically
- **Keyboard navigation** - Arrow keys to browse
- **Tagging** - Space to tag keepers
- **Compare** - Select 2 images for side-by-side view
- **Save selects** - Export tagged images with `_select01` suffix
- **ComfyUI integration** - Custom node sends images directly to viewer

## Installation

### Viewer

```bash
# Clone the repo
git clone https://github.com/yourusername/vewd.git
cd vewd

# Run viewer (point to your output folder)
python viewer.py C:\path\to\your\images

# Or use the bat file
viewer.bat
```

### ComfyUI Node

1. Copy the `comfyui` folder to `ComfyUI/custom_nodes/vewd`
2. Restart ComfyUI
3. Add "Vewd Preview" node after VAE Decode
4. Set the folder path to match your viewer

## Usage

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| Arrow keys | Navigate |
| Space | Tag/untag image |
| T | Toggle tagged filter |
| S | Save tagged images |
| Delete | Remove from view |
| R | Refresh folder |
| Escape | Clear selection |
| Ctrl+Click | Multi-select |
| Shift+Click | Range select |

### Workflow

1. Start the viewer pointing to your output folder
2. In ComfyUI, add Vewd Preview node after VAE Decode
3. Set the same folder path in the node
4. Generate images - they appear in the viewer automatically
5. Use Space to tag the ones you like
6. Press S to save tagged images

## Requirements

- Python 3.8+
- PIL (Pillow)
- tkinter (usually included with Python)

```bash
pip install Pillow
```

## License

MIT
