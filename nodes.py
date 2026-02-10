import os
import numpy as np
from PIL import Image
from pathlib import Path
import folder_paths
import time

class Vewd:
    """
    Send images to Vewd viewer for batch review.
    Toggle between preview (temp) and save (permanent) modes.
    """

    def __init__(self):
        self.counter = 0

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "folder": ("STRING", {"default": "C:/AI/ComfyUI/output/vewd"}),
                "mode": (["preview", "save"],),
            },
            "optional": {
                "filename_prefix": ("STRING", {"default": "vewd"}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("images",)
    FUNCTION = "process"
    CATEGORY = "image"
    OUTPUT_NODE = True

    def process(self, images, folder="", mode="preview", filename_prefix="vewd", prompt=None, extra_pnginfo=None):
        # Determine output folder
        if folder:
            save_dir = Path(folder)
        else:
            save_dir = Path(folder_paths.get_output_directory()) / "vewd"

        save_dir.mkdir(parents=True, exist_ok=True)

        results = []
        timestamp = int(time.time() * 1000)

        for i, image in enumerate(images):
            # Convert tensor to numpy array
            img_array = image.cpu().numpy()

            # Ensure correct format (H, W, C) and range (0-255)
            img_array = (img_array * 255).clip(0, 255).astype(np.uint8)

            # Handle different channel configurations
            if img_array.shape[-1] == 1:
                img_array = img_array.squeeze(-1)

            # Create PIL image
            pil_image = Image.fromarray(img_array)

            # Generate filename
            filename = f"{filename_prefix}_{timestamp}_{i:03d}.png"
            filepath = save_dir / filename

            # Save image
            pil_image.save(filepath, format='PNG')

            # For ComfyUI preview
            try:
                subfolder = str(save_dir.relative_to(folder_paths.get_output_directory()))
            except ValueError:
                subfolder = ""

            results.append({
                "filename": filename,
                "subfolder": subfolder,
                "type": "output" if mode == "save" else "temp"
            })

            self.counter += 1

        return {"ui": {"images": results}, "result": (images,)}


NODE_CLASS_MAPPINGS = {
    "Vewd": Vewd,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Vewd": "Vewd",
}
