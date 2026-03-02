import shutil
import base64
import io
import numpy as np
import torch
from pathlib import Path
from PIL import Image, PngImagePlugin
import folder_paths
from aiohttp import web
from server import PromptServer

try:
    import cv2
    HAS_CV2 = True
except ImportError:
    HAS_CV2 = False
    print("[Vewd] cv2 not available — video frame extraction disabled, will use screenshot fallback")

# Store latest screenshot per node for IMAGE output (splat fallback)
_screenshot_store = {}

# Store active video file info per node for full-frame extraction
_video_store = {}

# Store active image file info per node for direct-from-disk loading
_image_store = {}


def extract_video_frames(video_path, max_frames=0):
    """Read all frames from a video file and return as (N, H, W, 3) float32 tensor."""
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        # BGR -> RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frames.append(frame_rgb)
        if max_frames > 0 and len(frames) >= max_frames:
            break
    cap.release()

    if not frames:
        raise RuntimeError(f"No frames read from video: {video_path}")

    # Stack to (N, H, W, 3) float32 normalized
    stacked = np.stack(frames, axis=0).astype(np.float32) / 255.0
    return torch.from_numpy(stacked)


BINARY_EXTS = {'.glb', '.gltf', '.obj', '.ply', '.splat', '.stl'}


def copy_with_metadata(src_path, dst_path, seed=None):
    """Copy file, embedding seed as PNG metadata if applicable.
    For 3D model files and non-PNG files, does a plain file copy."""
    ext = Path(src_path).suffix.lower()
    if ext in BINARY_EXTS:
        shutil.copy2(src_path, dst_path)
        return
    if seed and ext == '.png':
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
                "input": ("IMAGE",),
                "folder": ("STRING", {"default": "C:/AI/comfy/ComfyUI/output/vewd"}),
                "filename_prefix": ("STRING", {"default": "vewd"}),
                "max_frames": ("INT", {"default": 0, "min": 0, "max": 9999, "step": 1, "tooltip": "Max video frames to extract (0 = all)"}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
                "unique_id": "UNIQUE_ID",
            },
        }

    RETURN_TYPES = ("IMAGE",)
    RETURN_NAMES = ("output",)
    FUNCTION = "process"
    CATEGORY = "image"

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float("NaN")

    def process(self, input=None, folder="", filename_prefix="vewd", max_frames=0, prompt=None, extra_pnginfo=None, unique_id=None):
        folder = folder.strip('"')
        result = {"ui": {"vewd_images": []}}
        img_tensor = None
        node_key = str(unique_id) if unique_id else None

        # Priority: wired input > video store > image store > screenshot store > black fallback
        if input is not None:
            img_tensor = input
        elif node_key and node_key in _video_store and HAS_CV2:
            video_info = _video_store[node_key]
            try:
                # Resolve video file path
                type_dirs = {
                    "temp": folder_paths.get_temp_directory(),
                    "output": folder_paths.get_output_directory(),
                    "input": folder_paths.get_input_directory(),
                }
                base_dir = type_dirs.get(video_info.get("type", "temp"), folder_paths.get_temp_directory())
                subfolder = video_info.get("subfolder", "")
                filename = video_info["filename"]
                video_path = Path(base_dir) / subfolder / filename if subfolder else Path(base_dir) / filename

                if video_path.exists():
                    img_tensor = extract_video_frames(video_path, max_frames)
                    print(f"[Vewd] Extracted {img_tensor.shape[0]} frames from {video_path.name}")
                else:
                    print(f"[Vewd] Video file not found: {video_path}")
            except Exception as e:
                print(f"[Vewd] Video extraction failed: {e}")

        if img_tensor is None and node_key and node_key in _image_store:
            image_info = _image_store[node_key]
            try:
                type_dirs = {
                    "temp": folder_paths.get_temp_directory(),
                    "output": folder_paths.get_output_directory(),
                    "input": folder_paths.get_input_directory(),
                }
                base_dir = type_dirs.get(image_info.get("type", "temp"), folder_paths.get_temp_directory())
                subfolder = image_info.get("subfolder", "")
                filename = image_info["filename"]
                img_path = Path(base_dir) / subfolder / filename if subfolder else Path(base_dir) / filename

                if img_path.exists():
                    img = Image.open(img_path).convert("RGB")
                    img_array = np.array(img).astype(np.float32) / 255.0
                    img_tensor = torch.from_numpy(img_array).unsqueeze(0)
                    print(f"[Vewd] Loaded image from disk: {img_path.name} ({img.size[0]}x{img.size[1]})")
                else:
                    print(f"[Vewd] Image file not found: {img_path}")
            except Exception as e:
                print(f"[Vewd] Image load failed: {e}")

        if img_tensor is None and node_key and node_key in _screenshot_store:
            img_data = _screenshot_store[node_key]
            try:
                img = Image.open(io.BytesIO(img_data)).convert("RGB")
                img_array = np.array(img).astype(np.float32) / 255.0
                img_tensor = torch.from_numpy(img_array).unsqueeze(0)
            except Exception as e:
                print(f"[Vewd] Failed to load screenshot: {e}")

        # Legacy fallback: try any screenshot if node-specific not found
        if img_tensor is None and _screenshot_store:
            latest_key = max(_screenshot_store.keys())
            img_data = _screenshot_store[latest_key]
            try:
                img = Image.open(io.BytesIO(img_data)).convert("RGB")
                img_array = np.array(img).astype(np.float32) / 255.0
                img_tensor = torch.from_numpy(img_array).unsqueeze(0)
            except Exception as e:
                print(f"[Vewd] Failed to load screenshot: {e}")

        # Always return an image tensor (black 512x512 fallback)
        if img_tensor is None:
            img_tensor = torch.zeros(1, 512, 512, 3)

        result["result"] = (img_tensor,)
        return result


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
                orig_ext = Path(filename).suffix.lower()
                save_ext = orig_ext if orig_ext in BINARY_EXTS else ".png"
                if seed:
                    new_name = f"{prefix}_{seed}_{i + 1:03d}{save_ext}"
                else:
                    orig_stem = Path(filename).stem
                    new_name = f"{prefix}_{orig_stem}{save_ext}"
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

        # Find next available number per seed
        seed_counters = {}

        for i, img_info in enumerate(images):
            if isinstance(img_info, str):
                filename = img_info
                subfolder = ""
                source_type = "temp"
                seed = None
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
                # Preserve original extension for non-image files (3D, video, audio)
                orig_ext = Path(filename).suffix.lower()
                save_ext = orig_ext if orig_ext in BINARY_EXTS else ".png"
                if seed:
                    # With seed: prefix_seed_001.ext
                    seed_key = seed
                    if seed_key not in seed_counters:
                        seed_counters[seed_key] = len(list(save_dir.glob(f"{prefix}_{seed}_*{save_ext}")))
                    seed_counters[seed_key] += 1
                    new_name = f"{prefix}_{seed}_{seed_counters[seed_key]:03d}{save_ext}"
                else:
                    # No seed: use original ComfyUI filename
                    orig_stem = Path(filename).stem
                    new_name = f"{prefix}_{orig_stem}{save_ext}"
                dst_path = save_dir / new_name
                copy_with_metadata(src_path, dst_path, seed)
                count += 1

        return web.json_response({"success": True, "count": count, "folder": str(save_dir)})

    except Exception as e:
        return web.json_response({"success": False, "error": str(e)})


# Screenshot upload endpoint — stores base64 PNG for IMAGE output
@PromptServer.instance.routes.post("/vewd/screenshot")
async def upload_screenshot(request):
    try:
        data = await request.json()
        image_data = data.get("image", "")
        node_id = data.get("node_id", "default")

        # Strip data URL prefix
        if "," in image_data:
            image_data = image_data.split(",", 1)[1]

        img_bytes = base64.b64decode(image_data)
        _screenshot_store[node_id] = img_bytes

        # Non-video content is now active — clear video store for this node
        _video_store.pop(node_id, None)

        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"success": False, "error": str(e)})


# Video file info endpoint — stores which video file is active for frame extraction
@PromptServer.instance.routes.post("/vewd/set_video")
async def set_video(request):
    try:
        data = await request.json()
        node_id = str(data.get("node_id", ""))
        filename = data.get("filename", "")

        if not node_id:
            return web.json_response({"success": False, "error": "Missing node_id"})

        if not filename:
            # Clear video info for this node
            _video_store.pop(node_id, None)
            return web.json_response({"success": True, "cleared": True})

        _video_store[node_id] = {
            "filename": filename,
            "subfolder": data.get("subfolder", ""),
            "type": data.get("type", "temp"),
        }

        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"success": False, "error": str(e)})


# Image file info endpoint — stores which image is selected for direct loading
@PromptServer.instance.routes.post("/vewd/set_image")
async def set_image(request):
    try:
        data = await request.json()
        node_id = str(data.get("node_id", ""))
        filename = data.get("filename", "")

        if not node_id:
            return web.json_response({"success": False, "error": "Missing node_id"})

        if not filename:
            _image_store.pop(node_id, None)
            return web.json_response({"success": True, "cleared": True})

        _image_store[node_id] = {
            "filename": filename,
            "subfolder": data.get("subfolder", ""),
            "type": data.get("type", "temp"),
        }

        # Image selected — clear video store for this node
        _video_store.pop(node_id, None)

        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"success": False, "error": str(e)})


NODE_CLASS_MAPPINGS = {
    "Vewd": Vewd,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Vewd": "Vewd",
}
