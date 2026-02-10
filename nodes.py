import shutil
from pathlib import Path
import folder_paths
from aiohttp import web
from server import PromptServer

class Vewd:
    """
    Image viewer node with capture mode.
    Captures all images from the workflow automatically.
    """

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "folder": ("STRING", {"default": "C:/AI/comfy/ComfyUI/output/vewd"}),
                "filename_prefix": ("STRING", {"default": "vewd"}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "process"
    CATEGORY = "image"
    OUTPUT_NODE = True

    def process(self, folder="", filename_prefix="vewd", prompt=None, extra_pnginfo=None):
        # Node just exists for the UI widget - capture mode handles image collection
        return {"ui": {"vewd_images": []}}


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
