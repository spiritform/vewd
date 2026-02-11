#!/bin/bash
# Image Viewer - pass a folder as argument, or edit DEFAULT_FOLDER below

DEFAULT_FOLDER="$HOME/ComfyUI/output/vewd"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "$1" ]; then
    python3 "$SCRIPT_DIR/viewer.py" "$DEFAULT_FOLDER"
else
    python3 "$SCRIPT_DIR/viewer.py" "$1"
fi
