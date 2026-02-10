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
        images = []
        try:
            for f in sorted(watch_folder.iterdir()):
                if f.suffix.lower() in IMAGE_EXTENSIONS:
                    images.append({
                        'name': f.name,
                        'path': f'/img/{f.name}',
                        'mtime': f.stat().st_mtime
                    })
            # Sort by modification time, newest first
            images.sort(key=lambda x: x['mtime'], reverse=True)
        except Exception as e:
            print(f"Error reading folder: {e}")
        return images

    def serve_image(self):
        name = unquote(self.path[5:])  # Remove '/img/'
        filepath = watch_folder / name
        if filepath.exists() and filepath.suffix.lower() in IMAGE_EXTENSIONS:
            self.send_response(200)
            content_type = 'image/png' if filepath.suffix.lower() == '.png' else 'image/jpeg'
            self.send_header('Content-type', content_type)
            self.end_headers()
            with open(filepath, 'rb') as f:
                self.wfile.write(f.read())
        else:
            self.send_error(404)

    def handle_save_post(self):
        content_length = int(self.headers['Content-Length'])
        body = self.rfile.read(content_length)
        data = json.loads(body)

        saved = []
        for i, img in enumerate(data.get('images', [])):
            src_name = img['name']
            src_path = watch_folder / src_name
            if src_path.exists():
                # Create new name
                num = str(i + 1).zfill(2)
                stem = src_path.stem
                suffix = src_path.suffix
                new_name = f"{stem}_select{num}{suffix}"
                dst_path = watch_folder / new_name

                # Copy file
                import shutil
                shutil.copy2(src_path, dst_path)
                saved.append(new_name)

        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'saved': saved}).encode())

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
        #toolbar {
            padding: 10px 15px;
            background: #1a1a1a;
            border-bottom: 1px solid #333;
            display: flex;
            gap: 20px;
            align-items: center;
            font-size: 13px;
        }
        #toolbar span { color: #555; }
        #toolbar button {
            background: #2a2a2a;
            border: 1px solid #444;
            color: #888;
            padding: 4px 10px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
        }
        #toolbar button:hover { background: #333; color: #aaa; }
        #folder-path {
            color: #555;
            font-size: 11px;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        #status { margin-left: auto; color: #666; }
        #main { flex: 1; display: flex; overflow: hidden; }
        #grid-container {
            flex: 1;
            overflow-y: auto;
            padding: 15px;
        }
        #grid-container::-webkit-scrollbar { width: 8px; }
        #grid-container::-webkit-scrollbar-track { background: #111; }
        #grid-container::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        #grid-container::-webkit-scrollbar-thumb:hover { background: #444; }
        #grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
        }
        .thumb {
            aspect-ratio: 1;
            background: #1a1a1a;
            border: 2px solid transparent;
            border-radius: 4px;
            overflow: hidden;
            cursor: pointer;
            position: relative;
            transition: border-color 0.15s;
        }
        .thumb:hover { border-color: #444; }
        .thumb.focused { border-color: #666; }
        .thumb.selected { border-color: #4a9eff; }
        .thumb.focused.selected {
            border-color: #6bb3ff;
            box-shadow: 0 0 0 2px rgba(74, 158, 255, 0.3);
        }
        .thumb img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #0a0a0a;
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
        .thumb .tag {
            position: absolute;
            top: 5px;
            right: 5px;
            background: #4a9eff;
            color: #fff;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 12px;
        }
        .thumb.tagged .tag { display: flex; }
        .thumb.tagged { box-shadow: 0 0 0 1px #4a9eff inset; }
        .thumb.hidden { display: none; }
        #compare {
            width: 50%;
            background: #0a0a0a;
            border-left: 1px solid #333;
            display: none;
            flex-direction: column;
        }
        #compare.visible { display: flex; }
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
        .compare-pane + .compare-pane { border-left: 1px solid #333; }
        .compare-pane img { max-width: 100%; max-height: 100%; object-fit: contain; }
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
        #help {
            position: fixed;
            bottom: 10px;
            left: 15px;
            font-size: 11px;
            color: #333;
        }
    </style>
</head>
<body>
    <div id="toolbar">
        <button id="pick-folder">Folder</button>
        <span id="folder-path"></span>
        <span>Images: <span id="count">0</span></span>
        <span>Tagged: <span id="tagged-count">0</span></span>
        <span id="status"></span>
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
    <div id="help">
        Arrows: navigate • Space: tag • T: filter tagged • S: save tagged • Del: remove
    </div>

    <script>
        const grid = document.getElementById('grid');
        const compare = document.getElementById('compare');
        const pane1 = document.getElementById('pane1');
        const pane2 = document.getElementById('pane2');
        const countEl = document.getElementById('count');
        const taggedCountEl = document.getElementById('tagged-count');
        const statusEl = document.getElementById('status');

        let images = [];
        let focusIndex = -1;
        let selectedIndices = new Set();
        let showOnlyTagged = false;
        let knownImages = new Set();

        async function loadImages() {
            try {
                const res = await fetch('/api/images');
                const data = await res.json();

                for (const img of data) {
                    if (!knownImages.has(img.name)) {
                        knownImages.add(img.name);
                        addImage(img.path, img.name);
                    }
                }
            } catch (e) {
                console.error('Failed to load images:', e);
            }
        }

        function addImage(src, name) {
            const index = images.length;
            const thumb = document.createElement('div');
            thumb.className = 'thumb';
            thumb.dataset.index = index;

            const img = document.createElement('img');
            img.src = src;
            img.title = name;

            const indexLabel = document.createElement('div');
            indexLabel.className = 'index';
            indexLabel.textContent = index + 1;

            const tagIndicator = document.createElement('div');
            tagIndicator.className = 'tag';
            tagIndicator.textContent = '✓';

            thumb.appendChild(img);
            thumb.appendChild(indexLabel);
            thumb.appendChild(tagIndicator);
            grid.insertBefore(thumb, grid.firstChild);

            images.unshift({ src, name, element: thumb, tagged: false });

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
            if (focusIndex >= 0 && images[focusIndex]) {
                images[focusIndex].element.classList.remove('focused');
            }
            focusIndex = index;
            images[focusIndex].element.classList.add('focused');
            images[focusIndex].element.scrollIntoView({ block: 'nearest' });
        }

        function updateUI() {
            let taggedCount = 0;
            images.forEach((img, i) => {
                img.element.classList.toggle('selected', selectedIndices.has(i));
                if (img.tagged) taggedCount++;
                if (showOnlyTagged) {
                    img.element.classList.toggle('hidden', !img.tagged);
                } else {
                    img.element.classList.remove('hidden');
                }
            });
            countEl.textContent = images.length;
            taggedCountEl.textContent = taggedCount;
            updateCompare();
        }

        function updateCompare() {
            const selected = Array.from(selectedIndices).sort((a, b) => a - b);
            const compareImages = document.getElementById('compare-images');

            if (selected.length >= 2) {
                compare.classList.add('visible');
                compareImages.classList.remove('single-view');
                pane1.innerHTML = `<span class="label">${selected[0] + 1}</span><img src="${images[selected[0]].src}">`;
                pane2.innerHTML = `<span class="label">${selected[1] + 1}</span><img src="${images[selected[1]].src}">`;
            } else if (selected.length === 1) {
                compare.classList.add('visible');
                compareImages.classList.add('single-view');
                pane1.innerHTML = `<span class="label">${selected[0] + 1}</span><img src="${images[selected[0]].src}">`;
                pane2.innerHTML = '';
            } else {
                compare.classList.remove('visible');
            }
        }

        function toggleTag(index) {
            if (index < 0 || index >= images.length) return;
            images[index].tagged = !images[index].tagged;
            images[index].element.classList.toggle('tagged', images[index].tagged);
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

        async function saveTagged() {
            const tagged = images.filter(img => img.tagged);
            if (tagged.length === 0) {
                statusEl.textContent = 'No tagged images';
                setTimeout(() => statusEl.textContent = '', 2000);
                return;
            }

            statusEl.textContent = 'Saving...';
            try {
                const res = await fetch('/api/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ images: tagged.map(img => ({ name: img.name })) })
                });
                const data = await res.json();
                statusEl.textContent = `Saved ${data.saved.length} images`;
            } catch (e) {
                statusEl.textContent = 'Save failed';
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
                case ' ': e.preventDefault(); toggleTag(focusIndex); break;
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
                        saveTagged();
                    }
                    break;
                case 'Escape':
                    e.preventDefault();
                    selectedIndices.clear();
                    compare.classList.remove('visible');
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
