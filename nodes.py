import os
import shutil
import numpy as np
from PIL import Image
from pathlib import Path
import folder_paths
import time
from aiohttp import web
from server import PromptServer

class Vewd:
    """
    Send images to Vewd viewer for batch review.
    Shows preview in node and saves to specified folder.
    """

    def __init__(self):
        self.output_dir = folder_paths.get_temp_directory()
        self.type = "temp"
        self.prefix_append = "_vewd_"
        self.compress_level = 1

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE",),
            },
            "optional": {
                "folder": ("STRING", {"default": "C:/AI/comfy/ComfyUI/output/vewd"}),
                "filename_prefix": ("STRING", {"default": "vewd"}),
                "save_to_folder": ("BOOLEAN", {"default": True}),
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

    def process(self, images, folder="", filename_prefix="vewd", save_to_folder=True, prompt=None, extra_pnginfo=None):
        results = []
        timestamp = int(time.time() * 1000)

        # Save to temp for preview
        temp_dir = folder_paths.get_temp_directory()

        # Also save to custom folder if enabled
        if save_to_folder and folder:
            save_dir = Path(folder)
            save_dir.mkdir(parents=True, exist_ok=True)

        for i, image in enumerate(images):
            # Convert tensor to numpy array
            img_array = image.cpu().numpy()
            img_array = (img_array * 255).clip(0, 255).astype(np.uint8)

            if img_array.shape[-1] == 1:
                img_array = img_array.squeeze(-1)

            pil_image = Image.fromarray(img_array)

            # Filename
            filename = f"{filename_prefix}_{timestamp}_{i:03d}.png"

            # Save to temp for ComfyUI preview
            temp_path = os.path.join(temp_dir, filename)
            pil_image.save(temp_path, format='PNG', compress_level=self.compress_level)

            results.append({
                "filename": filename,
                "subfolder": "",
                "type": "temp"
            })

            # Also save to custom folder
            if save_to_folder and folder:
                custom_path = Path(folder) / filename
                pil_image.save(custom_path, format='PNG')

        return {"ui": {"vewd_images": results}, "result": (images,)}


# Export API route
@PromptServer.instance.routes.post("/vewd/export")
async def export_selects(request):
    try:
        data = await request.json()
        folder = data.get("folder", "")
        prefix = data.get("prefix", "select")
        images = data.get("images", [])

        if not folder or not images:
            return web.json_response({"success": False, "error": "Missing folder or images"})

        # Create selects subfolder
        selects_dir = Path(folder) / "selects"
        selects_dir.mkdir(parents=True, exist_ok=True)

        temp_dir = folder_paths.get_temp_directory()
        count = 0

        for i, filename in enumerate(images):
            # Try temp folder first, then the main folder
            src_path = Path(temp_dir) / filename
            if not src_path.exists():
                src_path = Path(folder) / filename

            if src_path.exists():
                # New name with user's prefix
                new_name = f"{prefix}_{i + 1:03d}.png"
                dst_path = selects_dir / new_name
                shutil.copy2(src_path, dst_path)
                count += 1

        return web.json_response({"success": True, "count": count, "folder": str(selects_dir)})

    except Exception as e:
        return web.json_response({"success": False, "error": str(e)})


NODE_CLASS_MAPPINGS = {
    "Vewd": Vewd,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Vewd": "Vewd",
}
