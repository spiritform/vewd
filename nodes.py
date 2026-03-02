import shutil
import base64
import io
import struct
import numpy as np
import torch
from pathlib import Path
from PIL import Image, ImageDraw, PngImagePlugin
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
MEDIA_EXTS = {'.mp4', '.webm', '.mov', '.avi', '.mkv', '.mp3', '.wav', '.ogg', '.flac', '.aac'}
AUDIO_CONVERT_TO_MP3 = {'.flac', '.wav', '.ogg', '.aac'}  # Convert these to MP3 on save


def copy_with_metadata(src_path, dst_path, seed=None):
    """Copy file, embedding seed as PNG metadata if applicable.
    For audio files in AUDIO_CONVERT_TO_MP3, converts to MP3 via ffmpeg.
    For 3D model files and other non-PNG files, does a plain file copy."""
    ext = Path(src_path).suffix.lower()
    if ext in BINARY_EXTS:
        shutil.copy2(src_path, dst_path)
        return
    # Convert audio to MP3
    if ext in AUDIO_CONVERT_TO_MP3:
        try:
            import subprocess
            result = subprocess.run(
                ["ffmpeg", "-y", "-i", str(src_path), "-codec:a", "libmp3lame", "-q:a", "2", str(dst_path)],
                capture_output=True, timeout=30
            )
            if result.returncode == 0:
                return
            print(f"[Vewd] ffmpeg conversion failed: {result.stderr.decode()[:200]}")
        except Exception as e:
            print(f"[Vewd] ffmpeg not available, copying as-is: {e}")
        # Fallback: copy original if ffmpeg fails
        shutil.copy2(src_path, Path(str(dst_path).rsplit('.', 1)[0] + ext))
        return
    if ext in MEDIA_EXTS:
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
                if orig_ext in BINARY_EXTS:
                    save_ext = orig_ext
                elif orig_ext in AUDIO_CONVERT_TO_MP3:
                    save_ext = ".mp3"
                elif orig_ext in MEDIA_EXTS:
                    save_ext = orig_ext
                else:
                    save_ext = ".png"
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
                orig_ext = Path(filename).suffix.lower()
                if orig_ext in BINARY_EXTS:
                    save_ext = orig_ext
                elif orig_ext in AUDIO_CONVERT_TO_MP3:
                    save_ext = ".mp3"
                elif orig_ext in MEDIA_EXTS:
                    save_ext = orig_ext
                else:
                    save_ext = ".png"
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


WAVEFORM_COLORS = [
    (100, 180, 255),  # blue
    (255, 100, 130),  # pink
    (100, 255, 160),  # green
    (255, 200, 80),   # gold
    (180, 120, 255),  # purple
    (255, 140, 60),   # orange
    (80, 220, 220),   # cyan
    (255, 80, 80),    # red
]


def generate_waveform(audio_path, width=256, height=256):
    """Generate a waveform thumbnail image from an audio file.
    Uses ffmpeg to decode to raw PCM, then draws the waveform.
    Color is deterministic per filename for consistency."""
    try:
        import subprocess
        # Decode audio to raw 16-bit mono PCM via ffmpeg
        result = subprocess.run(
            ["ffmpeg", "-i", str(audio_path), "-f", "s16le", "-ac", "1", "-ar", "22050", "-"],
            capture_output=True, timeout=15
        )
        if result.returncode != 0:
            return None
        raw = result.stdout
        if len(raw) < 4:
            return None
        # Parse PCM samples
        n_samples = len(raw) // 2
        samples = np.array(struct.unpack(f"<{n_samples}h", raw[:n_samples * 2]), dtype=np.float32)
        # Normalize
        peak = np.max(np.abs(samples)) or 1.0
        samples = samples / peak
        # Downsample to width bins
        bin_size = max(1, len(samples) // width)
        bins = len(samples) // bin_size
        trimmed = samples[:bins * bin_size].reshape(bins, bin_size)
        maxes = np.max(trimmed, axis=1)
        mins = np.min(trimmed, axis=1)
        # Pick color based on filename hash
        color = WAVEFORM_COLORS[hash(audio_path.name) % len(WAVEFORM_COLORS)]
        # Draw
        img = Image.new("RGB", (width, height), (17, 17, 17))
        draw = ImageDraw.Draw(img)
        mid = height // 2
        for x in range(min(bins, width)):
            y_top = int(mid - maxes[x] * mid * 0.9)
            y_bot = int(mid - mins[x] * mid * 0.9)
            draw.line([(x, y_top), (x, y_bot)], fill=color)
        # Center line
        draw.line([(0, mid), (width - 1, mid)], fill=(60, 60, 60))
        return img
    except Exception as e:
        print(f"[Vewd] Waveform generation failed: {e}")
        return None


@PromptServer.instance.routes.get("/vewd/waveform")
async def get_waveform(request):
    """Generate and return a waveform thumbnail for an audio file."""
    try:
        filename = request.query.get("filename", "")
        subfolder = request.query.get("subfolder", "")
        source_type = request.query.get("type", "temp")

        if not filename:
            return web.json_response({"error": "Missing filename"}, status=400)

        type_dirs = {
            "temp": folder_paths.get_temp_directory(),
            "output": folder_paths.get_output_directory(),
            "input": folder_paths.get_input_directory(),
        }
        base_dir = type_dirs.get(source_type, folder_paths.get_temp_directory())
        audio_path = Path(base_dir) / subfolder / filename if subfolder else Path(base_dir) / filename

        if not audio_path.exists():
            return web.json_response({"error": "File not found"}, status=404)

        img = generate_waveform(audio_path)
        if img is None:
            return web.json_response({"error": "Waveform generation failed"}, status=500)

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        buf.seek(0)
        return web.Response(body=buf.read(), content_type="image/png")
    except Exception as e:
        return web.json_response({"error": str(e)}, status=500)


NODE_CLASS_MAPPINGS = {
    "Vewd": Vewd,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Vewd": "Vewd",
}
