import shutil
from pathlib import Path
from PIL import Image, PngImagePlugin
import folder_paths
from aiohttp import web
from server import PromptServer


def copy_with_metadata(src_path, dst_path, seed=None):
    """Copy image, embedding seed as PNG metadata if provided."""
    if seed and str(src_path).lower().endswith('.png'):
        try:
            img = Image.open(src_path)
            meta = PngImagePlugin.PngInfo()
            # Preserve existing metadata
            if hasattr(img, 'text'):
                for k, v in img.text.items():
                    meta.add_text(k, v)
            meta.add_text("seed", str(seed))
            img.save(dst_path, pnginfo=meta)
            return
        except Exception:
            pass
    shutil.copy2(src_path, dst_path)

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
        folder = folder.strip('"')
        # Node just exists for the UI widget - capture mode handles image collection
        return {"ui": {"vewd_images": []}}


# Export API route
@PromptServer.instance.routes.post("/vewd/export")
async def export_selects(request):
    try:
        data = await request.json()
        folder = data.get("folder", "").strip('"')
        prefix = data.get("prefix", "select")
        images = data.get("images", [])

        if not folder or not images:
            return web.json_response({"success": False, "error": "Missing folder or images"})

        # Create selects subfolder
        selects_dir = Path(folder) / "selects"
        selects_dir.mkdir(parents=True, exist_ok=True)

        temp_dir = folder_paths.get_temp_directory()
        output_dir = folder_paths.get_output_directory()
        input_dir = folder_paths.get_input_directory()
        count = 0
        debug = []

        for i, img_info in enumerate(images):
            # Support both old format (string) and new format (object with source info)
            if isinstance(img_info, str):
                filename = img_info
                subfolder = ""
                source_type = "temp"
            else:
                filename = img_info.get("filename", "")
                subfolder = img_info.get("subfolder", "")
                source_type = img_info.get("type", "temp")
                seed = img_info.get("seed")

            # Resolve source path based on type
            type_dirs = {"temp": temp_dir, "output": output_dir, "input": input_dir}
            base_dir = type_dirs.get(source_type, temp_dir)
            src_path = Path(base_dir) / subfolder / filename if subfolder else Path(base_dir) / filename
            tried = [str(src_path)]
            if not src_path.exists():
                src_path = Path(folder) / filename
                tried.append(str(src_path))

            if src_path.exists():
                # New name with user's prefix
                seed_part = f"_{seed}" if seed else ""
                new_name = f"{prefix}_select{i + 1:02d}{seed_part}.png"
                dst_path = selects_dir / new_name
                copy_with_metadata(src_path, dst_path, seed)
                count += 1
            else:
                debug.append({"filename": filename, "type": source_type, "subfolder": subfolder, "tried": tried})

        return web.json_response({"success": True, "count": count, "folder": str(selects_dir), "debug": debug})

    except Exception as e:
        return web.json_response({"success": False, "error": str(e)})


# Save API route (saves to folder directly, not /selects)
@PromptServer.instance.routes.post("/vewd/save")
async def save_images(request):
    try:
        data = await request.json()
        folder = data.get("folder", "").strip('"')
        prefix = data.get("prefix", "vewd")
        images = data.get("images", [])

        if not folder or not images:
            return web.json_response({"success": False, "error": "Missing folder or images"})

        save_dir = Path(folder)
        save_dir.mkdir(parents=True, exist_ok=True)

        temp_dir = folder_paths.get_temp_directory()
        output_dir = folder_paths.get_output_directory()
        input_dir = folder_paths.get_input_directory()
        count = 0

        # Find next available number
        existing = list(save_dir.glob(f"{prefix}_*.png"))
        start_num = len(existing) + 1

        for i, img_info in enumerate(images):
            if isinstance(img_info, str):
                filename = img_info
                subfolder = ""
                source_type = "temp"
            else:
                filename = img_info.get("filename", "")
                subfolder = img_info.get("subfolder", "")
                source_type = img_info.get("type", "temp")
                seed = img_info.get("seed")

            type_dirs = {"temp": temp_dir, "output": output_dir, "input": input_dir}
            base_dir = type_dirs.get(source_type, temp_dir)
            src_path = Path(base_dir) / subfolder / filename if subfolder else Path(base_dir) / filename
            if not src_path.exists():
                src_path = Path(folder) / filename

            if src_path.exists():
                seed_part = f"_{seed}" if seed else ""
                new_name = f"{prefix}_{start_num + i:03d}{seed_part}.png"
                dst_path = save_dir / new_name
                copy_with_metadata(src_path, dst_path, seed)
                count += 1

        return web.json_response({"success": True, "count": count, "folder": str(save_dir)})

    except Exception as e:
        return web.json_response({"success": False, "error": str(e)})


NODE_CLASS_MAPPINGS = {
    "Vewd": Vewd,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Vewd": "Vewd",
}
