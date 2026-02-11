#!/usr/bin/env python3
"""
Simple image viewer for batch generations.
Usage: python viewer.py [folder_path]
Default folder: current directory
"""

import os
import sys
import json
import threading
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import unquote

# Config
PORT = 8000
IMAGE_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'}
VIDEO_EXTENSIONS = {'.mp4', '.webm', '.mov', '.avi', '.mkv'}
AUDIO_EXTENSIONS = {'.mp3', '.wav', '.ogg', '.flac', '.aac'}
ALL_EXTENSIONS = IMAGE_EXTENSIONS | VIDEO_EXTENSIONS | AUDIO_EXTENSIONS

# Watch folder (mutable)
watch_folder = Path(sys.argv[1]) if len(sys.argv) > 1 else Path.cwd()

class ViewerHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.send_response(200)
            self.send_header('Content-type', 'text/html')
            self.end_headers()
            self.wfile.write(HTML.encode())
        elif self.path == '/api/images':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            images = self.get_images()
            self.wfile.write(json.dumps(images).encode())
        elif self.path.startswith('/api/save'):
            self.handle_save()
        elif self.path == '/api/folder':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'folder': str(watch_folder)}).encode())
        elif self.path == '/api/pick-folder':
            self.pick_folder()
        elif self.path.startswith('/img/'):
            self.serve_image()
        else:
            self.send_error(404)

    def do_POST(self):
        if self.path == '/api/save':
            self.handle_save_post()
        else:
            self.send_error(404)

    def get_images(self):
        items = []
        try:
            for f in sorted(watch_folder.iterdir()):
                ext = f.suffix.lower()
                if ext in ALL_EXTENSIONS:
                    if ext in IMAGE_EXTENSIONS:
                        media_type = 'image'
                    elif ext in VIDEO_EXTENSIONS:
                        media_type = 'video'
                    else:
                        media_type = 'audio'
                    items.append({
                        'name': f.name,
                        'path': f'/img/{f.name}',
                        'mtime': f.stat().st_mtime,
                        'type': media_type
                    })
            items.sort(key=lambda x: x['mtime'], reverse=True)
        except Exception as e:
            print(f"Error reading folder: {e}")
        return items

    def serve_image(self):
        import mimetypes
        name = unquote(self.path[5:])  # Remove '/img/'
        filepath = watch_folder / name
        if filepath.exists() and filepath.suffix.lower() in ALL_EXTENSIONS:
            self.send_response(200)
            content_type = mimetypes.guess_type(filepath.name)[0] or 'application/octet-stream'
            self.send_header('Content-type', content_type)
            self.end_headers()
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404)

    def handle_save_post(self):
        import shutil
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length)
        data = json.loads(body)

        selects_dir = watch_folder / 'selects'
        selects_dir.mkdir(exist_ok=True)

        saved = []
        for img in data.get('images', []):
            src_path = watch_folder / img['name']
            if src_path.exists():
                dst_path = selects_dir / src_path.name
                shutil.copy2(src_path, dst_path)
                saved.append(src_path.name)

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'saved': saved, 'folder': str(selects_dir)}).encode())
        print(f"Exported {len(saved)} files to {selects_dir}")

    def pick_folder(self):
        global watch_folder
        try:
            import tkinter as tk
            from tkinter import filedialog
            root = tk.Tk()
            root.withdraw()
            root.attributes('-topmost', True)
            folder = filedialog.askdirectory(initialdir=str(watch_folder))
            root.destroy()
            if folder:
                watch_folder = Path(folder)
                print(f"Switched to: {watch_folder}")
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'folder': str(watch_folder), 'success': True}).encode())
            else:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': False}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode())

    def log_message(self, format, *args):
        pass  # Quiet

HTML = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Image Viewer</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            background: #111;
            color: #888;
            font-family: system-ui, sans-serif;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .vewd-header {
            display: flex;
            gap: 8px;
            padding: 8px 12px;
            background: #1a1a1a;
            border-bottom: 1px solid #222;
            align-items: center;
            font-size: 13px;
            color: #555;
        }
        .vewd-header button {
            background: #252525;
            border: none;
            color: #777;
            padding: 4px 8px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            font-family: inherit;
            line-height: 1.3;
        }
        .vewd-header button:hover { background: #333; color: #aaa; }
        #folder-path {
            color: #555;
            font-size: 12px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            min-width: 0;
        }
        #main { flex: 1; display: flex; overflow: hidden; }
        #grid-container {
            width: 35%;
            overflow-y: auto;
            padding: 6px;
            background: #151515;
        }
        #grid-container::-webkit-scrollbar { width: 5px; }
        #grid-container::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        #grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
        }
        .thumb {
            aspect-ratio: 1;
            background: #0a0a0a;
            border: 2px solid transparent;
            border-radius: 4px;
            overflow: hidden;
            cursor: pointer;
            position: relative;
            transition: border-color 0.2s ease;
        }
        .thumb:hover { border-color: #666; }
        .thumb.selected { border-color: #fff; }
        .thumb.tagged::after {
            content: "\2764";
            position: absolute;
            top: 3px;
            right: 4px;
            color: #ff4a6a;
            font-size: 14px;
            text-shadow: 0 0 2px rgba(0,0,0,0.8);
        }
        .thumb.hidden { display: none; }
        .thumb img, .thumb video {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .thumb .audio-icon {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: #444;
            background: #1a1a1a;
        }
        .thumb .media-icon {
            position: absolute;
            bottom: 4px;
            left: 4px;
            background: rgba(0,0,0,0.7);
            color: #fff;
            width: 18px;
            height: 18px;
            border-radius: 3px;
            font-size: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .thumb .index {
            position: absolute;
            bottom: 5px;
            right: 5px;
            background: rgba(0,0,0,0.7);
            color: #666;
            padding: 2px 6px;
            border-radius: 3px;
            font-size: 11px;
        }
        #compare {
            flex: 1;
            background: #0a0a0a;
            border-left: 1px solid #222;
            display: flex;
            flex-direction: column;
        }
        #compare-images { flex: 1; display: flex; overflow: hidden; }
        #compare-images.single-view { justify-content: center; }
        #compare-images.single-view .compare-pane:nth-child(2) { display: none; }
        .compare-pane {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 15px;
            position: relative;
        }
        .compare-pane + .compare-pane { border-left: 1px solid #222; }
        .compare-pane.active-pane { box-shadow: inset 0 0 0 2px #fff; }
        .compare-pane .pane-heart {
            position: absolute;
            top: 12px;
            right: 14px;
            color: #ff4a6a;
            font-size: 20px;
            text-shadow: 0 0 4px rgba(0,0,0,0.8);
            display: none;
        }
        .compare-pane.pane-tagged .pane-heart { display: block; }
        .compare-pane img, .compare-pane video { max-width: 100%; max-height: 100%; object-fit: contain; }
        .compare-pane .audio-preview {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            color: #666;
            width: 100%;
        }
        .compare-pane .audio-preview .icon { font-size: 64px; }
        .compare-pane .audio-preview audio { width: 80%; height: 40px; }
        .compare-pane .label {
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(0,0,0,0.7);
            color: #888;
            padding: 4px 10px;
            border-radius: 3px;
            font-size: 12px;
        }
        .vewd-filters {
            display: flex;
            gap: 6px;
        }
        .vewd-filters button {
            background: transparent;
            border: 1px solid #333;
            color: #555;
            padding: 4px 12px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        .vewd-filters button:hover { border-color: #555; color: #888; }
        .vewd-filters button.active { border-color: #fff; color: #fff; }
        .vewd-bar {
            display: flex;
            gap: 6px 8px;
            padding: 10px;
            background: #1a1a1a;
            font-size: 14px;
            color: #555;
            align-items: center;
            flex-wrap: wrap;
        }
        .vewd-bar button {
            background: #252525;
            border: none;
            color: #777;
            padding: 5px 14px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 13px;
            line-height: 1.3;
        }
        .vewd-bar button:hover { background: #333; color: #aaa; }
        .vewd-bar button.on { background: #ff4a6a; color: #fff; }
        .vewd-bar .save-btn { background: #1a1a1a; color: #333; pointer-events: none; }
        .vewd-bar .save-btn.active { background: #252525; color: #777; pointer-events: auto; }
        .vewd-bar .save-btn.active:hover { background: #333; color: #aaa; }
        .vewd-bar .vewd-logo {
            color: #fff !important;
            font-weight: 600;
            letter-spacing: 0.5px;
        }
        .vewd-bar .vewd-logo:hover { background: #fff !important; color: #111 !important; }
    </style>
</head>
<body>
    <div class="vewd-header">
        <button id="pick-folder">folder</button>
        <span id="folder-path"></span>
    </div>
    <div id="main">
        <div id="grid-container">
            <div id="grid"></div>
        </div>
        <div id="compare">
            <div id="compare-images">
                <div class="compare-pane" id="pane1"></div>
                <div class="compare-pane" id="pane2"></div>
            </div>
        </div>
    </div>
    <div class="vewd-bar">
        <div class="vewd-filters">
            <button class="type-filter active" data-type="all">all</button>
            <button class="type-filter" data-type="image">img</button>
            <button class="type-filter" data-type="video">vid</button>
            <button class="type-filter" data-type="audio">aud</button>
        </div>
        <span id="count">0</span>
        <button id="clear-btn">clear</button>
        <button id="filter-btn">&#10084;</button>
        <span id="tagged-count">0</span>
        <button class="save-btn" id="save-btn">export selects</button>
        <span id="status"></span>
        <span style="margin-left:auto;color:#444">spacebar &#10084;</span>
        <button class="vewd-logo" id="vewd-logo">vewd</button>
    </div>

    <script>
        const grid = document.getElementById('grid');
        const compare = document.getElementById('compare');
        const pane1 = document.getElementById('pane1');
        const pane2 = document.getElementById('pane2');
        const countEl = document.getElementById('count');
        const taggedCountEl = document.getElementById('tagged-count');
        const statusEl = document.getElementById('status');
        const filterBtn = document.getElementById('filter-btn');
        const clearBtn = document.getElementById('clear-btn');
        const saveBtn = document.getElementById('save-btn');
        const vewdLogo = document.getElementById('vewd-logo');

        let images = [];
        let focusIndex = -1;
        let selectedIndices = new Set();
        let showOnlyTagged = false;
        let knownImages = new Set();
        let activePaneIndex = -1;
        let typeFilter = 'all';

        async function loadImages() {
            try {
                const res = await fetch('/api/images');
                const data = await res.json();

                for (const item of data) {
                    if (!knownImages.has(item.name)) {
                        knownImages.add(item.name);
                        addMedia(item.path, item.name, item.type || 'image');
                    }
                }
            } catch (e) {
                console.error('Failed to load images:', e);
            }
        }

        function addMedia(src, name, type) {
            const index = images.length;
            const thumb = document.createElement('div');
            thumb.className = 'thumb';
            thumb.dataset.index = index;

            if (type === 'video') {
                thumb.innerHTML = '<video src="' + src + '" muted preload="metadata"></video><div class="media-icon">&#9654;</div>';
                const vid = thumb.querySelector('video');
                vid.addEventListener('loadedmetadata', () => { vid.currentTime = 0.1; });
            } else if (type === 'audio') {
                thumb.innerHTML = '<div class="audio-icon">&#9835;</div>';
            } else {
                const img = document.createElement('img');
                img.src = src;
                img.title = name;
                thumb.appendChild(img);
            }

            const indexLabel = document.createElement('div');
            indexLabel.className = 'index';
            indexLabel.textContent = index + 1;

            thumb.appendChild(indexLabel);
            grid.insertBefore(thumb, grid.firstChild);

            images.unshift({ src, name, type, element: thumb, tagged: false });

            // Reindex all
            images.forEach((img, i) => {
                img.element.dataset.index = i;
                img.element.querySelector('.index').textContent = i + 1;
            });

            thumb.addEventListener('click', (e) => {
                const idx = parseInt(thumb.dataset.index);
                handleClick(idx, e);
            });

            updateUI();
            if (focusIndex === -1 && images.length > 0) setFocus(0);
        }

        function handleClick(index, e) {
            if (e.ctrlKey || e.metaKey) {
                if (selectedIndices.has(index)) selectedIndices.delete(index);
                else selectedIndices.add(index);
            } else if (e.shiftKey && focusIndex !== -1) {
                const start = Math.min(focusIndex, index);
                const end = Math.max(focusIndex, index);
                if (!e.ctrlKey) selectedIndices.clear();
                for (let i = start; i <= end; i++) selectedIndices.add(i);
            } else {
                selectedIndices.clear();
                selectedIndices.add(index);
            }
            setFocus(index);
            updateUI();
        }

        function setFocus(index) {
            if (index < 0 || index >= images.length) return;
            focusIndex = index;
            images[focusIndex].element.scrollIntoView({ block: 'nearest' });
        }

        function updateUI() {
            let taggedCount = 0;
            images.forEach((img, i) => {
                img.element.classList.toggle('selected', selectedIndices.has(i));
                img.element.classList.toggle('tagged', img.tagged);
                if (img.tagged) taggedCount++;
                const typeMatch = typeFilter === 'all' || img.type === typeFilter;
                const tagMatch = !showOnlyTagged || img.tagged;
                img.element.classList.toggle('hidden', !typeMatch || !tagMatch);
            });

            document.querySelectorAll('.type-filter').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.type === typeFilter);
            });

            countEl.textContent = images.length;
            taggedCountEl.textContent = taggedCount;
            filterBtn.classList.toggle('on', showOnlyTagged);
            saveBtn.classList.toggle('active', taggedCount > 0);
            saveBtn.textContent = taggedCount > 0 ? 'export selects (' + taggedCount + ')' : 'export selects';
            updateCompare();
        }

        function updateCompare() {
            const selected = Array.from(selectedIndices).sort((a, b) => a - b);
            const compareImages = document.getElementById('compare-images');

            function renderPreview(media) {
                if (media.type === 'video') {
                    return '<video src="' + media.src + '" controls muted loop></video>';
                } else if (media.type === 'audio') {
                    return '<div class="audio-preview"><span class="icon">&#9835;</span><audio src="' + media.src + '" controls></audio></div>';
                }
                return '<img src="' + media.src + '">';
            }

            function setupPane(pane, imgIndex, paneIdx) {
                pane.innerHTML = '<span class="label">' + (imgIndex + 1) + '</span>' + renderPreview(images[imgIndex]) + '<span class="pane-heart">&#10084;</span>';
                pane.classList.toggle('pane-tagged', images[imgIndex].tagged);
                pane.onclick = () => { activePaneIndex = paneIdx; updatePaneHighlight(); };
            }

            if (selected.length >= 2) {
                compareImages.classList.remove('single-view');
                setupPane(pane1, selected[0], 0);
                setupPane(pane2, selected[1], 1);
            } else if (selected.length === 1) {
                compareImages.classList.add('single-view');
                setupPane(pane1, selected[0], 0);
                pane2.innerHTML = '';
                pane2.classList.remove('pane-tagged');
                activePaneIndex = -1;
            } else {
                compareImages.classList.add('single-view');
                pane1.innerHTML = '';
                pane2.innerHTML = '';
                pane1.classList.remove('pane-tagged');
                pane2.classList.remove('pane-tagged');
                activePaneIndex = -1;
            }
            updatePaneHighlight();
        }

        function updatePaneHighlight() {
            pane1.classList.toggle('active-pane', activePaneIndex === 0);
            pane2.classList.toggle('active-pane', activePaneIndex === 1);
        }

        function toggleTag(index) {
            if (index < 0 || index >= images.length) return;
            images[index].tagged = !images[index].tagged;
            updateUI();
        }

        function deleteSelected() {
            if (selectedIndices.size === 0) return;
            const toDelete = Array.from(selectedIndices).sort((a, b) => b - a);
            toDelete.forEach(i => {
                knownImages.delete(images[i].name);
                images[i].element.remove();
                images.splice(i, 1);
            });
            images.forEach((img, i) => {
                img.element.dataset.index = i;
                img.element.querySelector('.index').textContent = i + 1;
            });
            selectedIndices.clear();
            if (images.length > 0) {
                const newFocus = Math.min(focusIndex, images.length - 1);
                focusIndex = -1;
                setFocus(newFocus);
                selectedIndices.add(newFocus);
            } else {
                focusIndex = -1;
            }
            updateUI();
        }

        async function exportSelects() {
            const tagged = images.filter(img => img.tagged);
            if (tagged.length === 0) {
                statusEl.textContent = 'No tagged images';
                setTimeout(() => statusEl.textContent = '', 2000);
                return;
            }

            statusEl.textContent = 'Exporting...';
            try {
                const res = await fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ images: tagged.map(img => ({ name: img.name })) })
                });
                const data = await res.json();
                statusEl.textContent = `Exported ${data.saved.length} to selects/`;
            } catch (e) {
                statusEl.textContent = 'Export failed';
            }
            setTimeout(() => statusEl.textContent = '', 3000);
        }

        document.addEventListener('keydown', (e) => {
            if (images.length === 0) return;
            const cols = 3;

            switch (e.key) {
                case 'ArrowRight': e.preventDefault(); navigateTo(focusIndex + 1, e); break;
                case 'ArrowLeft': e.preventDefault(); navigateTo(focusIndex - 1, e); break;
                case 'ArrowDown': e.preventDefault(); navigateTo(focusIndex + cols, e); break;
                case 'ArrowUp': e.preventDefault(); navigateTo(focusIndex - cols, e); break;
                case ' ':
                    e.preventDefault();
                    if (activePaneIndex >= 0) {
                        const sel = Array.from(selectedIndices).sort((a, b) => a - b);
                        if (sel.length >= 2 && activePaneIndex < 2) {
                            toggleTag(sel[activePaneIndex]);
                        }
                    } else if (selectedIndices.size > 1) {
                        const anyTagged = [...selectedIndices].some(i => images[i].tagged);
                        selectedIndices.forEach(i => { images[i].tagged = !anyTagged; });
                        updateUI();
                    } else {
                        toggleTag(focusIndex);
                    }
                    break;
                case 'Delete':
                case 'Backspace': e.preventDefault(); deleteSelected(); break;
                case 't':
                    if (!e.ctrlKey) {
                        e.preventDefault();
                        showOnlyTagged = !showOnlyTagged;
                        updateUI();
                    }
                    break;
                case 's':
                    if (!e.ctrlKey) {
                        e.preventDefault();
                        exportSelects();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    selectedIndices.clear();
                    updateUI();
                    break;
            }
        });

        function navigateTo(index, e) {
            index = Math.max(0, Math.min(images.length - 1, index));
            if (e.shiftKey) {
                if (!selectedIndices.has(focusIndex)) selectedIndices.add(focusIndex);
                selectedIndices.add(index);
            } else if (!e.ctrlKey) {
                selectedIndices.clear();
                selectedIndices.add(index);
            }
            setFocus(index);
            updateUI();
        }

        // Folder picker
        const folderPathEl = document.getElementById('folder-path');

        async function loadFolderPath() {
            try {
                const res = await fetch('/api/folder');
                const data = await res.json();
                folderPathEl.textContent = data.folder;
                folderPathEl.title = data.folder;
            } catch (e) {}
        }

        document.getElementById('pick-folder').addEventListener('click', async () => {
            statusEl.textContent = 'Opening folder picker...';
            try {
                const res = await fetch('/api/pick-folder');
                const data = await res.json();
                if (data.success) {
                    // Clear and reload
                    grid.innerHTML = '';
                    images = [];
                    knownImages.clear();
                    focusIndex = -1;
                    selectedIndices.clear();
                    folderPathEl.textContent = data.folder;
                    folderPathEl.title = data.folder;
                    updateUI();
                    loadImages();
                    statusEl.textContent = '';
                } else {
                    statusEl.textContent = '';
                }
            } catch (e) {
                statusEl.textContent = 'Failed to pick folder';
                setTimeout(() => statusEl.textContent = '', 2000);
            }
        });

        // Type filter buttons
        document.querySelectorAll('.type-filter').forEach(btn => {
            btn.addEventListener('click', () => { typeFilter = btn.dataset.type; updateUI(); });
        });

        // Bottom bar buttons
        filterBtn.addEventListener('click', () => {
            showOnlyTagged = !showOnlyTagged;
            updateUI();
        });

        clearBtn.addEventListener('click', () => {
            grid.innerHTML = '';
            images = [];
            knownImages.clear();
            focusIndex = -1;
            selectedIndices.clear();
            updateUI();
        });

        saveBtn.addEventListener('click', () => exportSelects());

        vewdLogo.addEventListener('click', () => {
            window.open('https://x.com/spiritform', '_blank');
        });

        // Initial load + poll for new images
        loadFolderPath();
        loadImages();
        setInterval(loadImages, 2000);
    </script>
</body>
</html>
'''

if __name__ == '__main__':
    print(f"Watching: {watch_folder.absolute()}")
    print(f"Open: http://localhost:{PORT}")

    # Open browser
    threading.Timer(0.5, lambda: webbrowser.open(f'http://localhost:{PORT}')).start()

    server = HTTPServer(('', PORT), ViewerHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped")
