import os
import json
import numpy as np
from PIL import Image
from pathlib import Path
import folder_paths
import time

class VewdPreview:
    """
    Send images to Vewd viewer for batch review.
    Images are saved to a folder that Vewd watches.
    """

    def __init__(self):
        self.output_dir = folder_paths.get_temp_dir()
        self.type = "temp"
        self.prefix_append = "_vewd_"
        self.counter = 0

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "folder": ("STRING", {"default": "C:/AI/ComfyUI/output/vewd"}),
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
    FUNCTION = "send_to_vewd"
    CATEGORY = "image"
    OUTPUT_NODE = True

    def send_to_vewd(self, images, folder="", filename_prefix="vewd", prompt=None, extra_pnginfo=None):
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

            results.append({
                "filename": filename,
                "subfolder": str(save_dir.relative_to(folder_paths.get_output_directory())) if save_dir.is_relative_to(folder_paths.get_output_directory()) else "",
                "type": "output"
            })

            self.counter += 1

        # Return passthrough + UI update
        return {"ui": {"images": results}, "result": (images,)}


class VewdSave:
    """
    Save selected images from Vewd to a permanent location.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
                "filename_prefix": ("STRING", {"default": "selected"}),
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "save_images"
    CATEGORY = "image"
    OUTPUT_NODE = True

    def save_images(self, images, filename_prefix="selected"):
        save_dir = Path(folder_paths.get_output_directory()) / "vewd_selected"
        save_dir.mkdir(exist_ok=True)

        timestamp = int(time.time() * 1000)
        results = []

        for i, image in enumerate(images):
            img_array = image.cpu().numpy()
            img_array = (img_array * 255).clip(0, 255).astype(np.uint8)

            if img_array.shape[-1] == 1:
                img_array = img_array.squeeze(-1)

            pil_image = Image.fromarray(img_array)
            filename = f"{filename_prefix}_{timestamp}_{i:03d}.png"
            filepath = save_dir / filename
            pil_image.save(filepath, format='PNG')

            results.append({
                "filename": filename,
                "subfolder": "vewd_selected",
                "type": "output"
            })

        return {"ui": {"images": results}}


NODE_CLASS_MAPPINGS = {
    "VewdPreview": VewdPreview,
    "VewdSave": VewdSave,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "VewdPreview": "Vewd Preview",
    "VewdSave": "Vewd Save",
}
