import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

console.log("[Vewd] Extension loaded");

// Load model-viewer web component for 3D preview
const mvScript = document.createElement("script");
mvScript.type = "module";
mvScript.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/4.0.0/model-viewer.min.js";
document.head.appendChild(mvScript);

// Styles
const style = document.createElement("style");
style.textContent = `
    .vewd-container {
        background: #111;
        border-radius: 6px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        height: 100%;
        outline: none;
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
    .vewd-header input {
        background: #252525;
        border: none;
        color: #777;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 12px;
        font-family: inherit;
        min-width: 0;
        line-height: 1.3;
    }
    .vewd-header .folder-input { width: 400px; }
    .vewd-header .prefix-input { width: 120px; }
    .vewd-header input:focus { color: #ccc; outline: none; }
    .vewd-header label { color: #555; font-size: 12px; white-space: nowrap; }

    .vewd-main {
        flex: 1;
        display: flex;
        overflow: hidden;
        min-height: 0;
    }

    .vewd-grid-area {
        width: 35%;
        overflow-y: auto;
        padding: 6px;
        background: #151515;
    }
    .vewd-grid-area::-webkit-scrollbar { width: 5px; }
    .vewd-grid-area::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

    .vewd-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
    }

    .vewd-item {
        aspect-ratio: 1;
        background: #0a0a0a;
        border: 2px solid transparent;
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
        position: relative;
        transition: border-color 0.15s ease;
    }
    .vewd-item:hover { border-color: #666; }
    .vewd-item.selected { border-color: #fff; }
    .vewd-item.tagged::after {
        content: "❤";
        position: absolute;
        top: 3px;
        right: 4px;
        color: #ff4a6a;
        font-size: 14px;
        text-shadow: 0 0 2px rgba(0,0,0,0.8);
    }
    .vewd-item.hidden { display: none; }
    .vewd-item img, .vewd-item video { width: 100%; height: 100%; object-fit: cover; }
    .vewd-item .audio-icon, .vewd-item .model-icon, .vewd-item .splat-icon {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        color: #444;
        background: #1a1a1a;
    }
    .vewd-item .media-icon {
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

    .vewd-preview-area {
        flex: 1;
        background: #0a0a0a;
        display: flex;
        min-width: 0;
    }
    .vewd-preview-area.single { justify-content: center; }
    .vewd-preview-area.single .vewd-pane:nth-child(2) { display: none; }

    .vewd-pane {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px;
    }
    .vewd-pane + .vewd-pane { border-left: 1px solid #222; }
    .vewd-pane { position: relative; overflow: hidden; }
    .vewd-pane.active-pane { box-shadow: inset 0 0 0 2px #fff; }
    .vewd-pane .pane-heart {
        position: absolute;
        top: 12px;
        right: 14px;
        color: #ff4a6a;
        font-size: 20px;
        text-shadow: 0 0 4px rgba(0,0,0,0.8);
        display: none;
    }
    .vewd-pane.pane-tagged .pane-heart { display: block; }
    .vewd-pane img, .vewd-pane video { max-width: 100%; max-height: 100%; object-fit: contain; }
    .vewd-pane .audio-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        color: #666;
        width: 100%;
    }
    .vewd-toast {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.8);
        color: #fff;
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        pointer-events: none;
        z-index: 10;
        opacity: 0;
        transition: opacity 0.3s;
    }
    .vewd-toast.show { opacity: 1; }

    .vewd-pane .audio-preview .icon { font-size: 64px; }
    .vewd-pane .audio-preview audio { width: 80%; height: 40px; }

    .vewd-pane model-viewer {
        width: 100%;
        height: 100%;
        --poster-color: #444;
    }

    .vewd-pane iframe.splat-viewer {
        width: 100%;
        height: 100%;
        border: none;
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
    .vewd-bar .vewd-logo {
        color: #fff !important;
        font-weight: 600;
        letter-spacing: 0.5px;
    }
    .vewd-bar .vewd-logo:hover { background: #fff !important; color: #111 !important; }
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
    .vewd-bar .save-btn { background: #333; color: #aaa; }
    .vewd-bar .save-btn:hover { background: #444; color: #ccc; }
    .vewd-bar .flash { background: #fff !important; color: #111 !important; transition: none; }
    .vewd-bar .flash-fade { transition: background 0.6s, color 0.6s; }

    /* Fullscreen overlay */
    .vewd-fullscreen {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: #0a0a0a;
        z-index: 99999;
        display: flex;
        flex-direction: column;
    }
    .vewd-fullscreen .vewd-main {
        flex: 1;
    }
    .vewd-fullscreen .vewd-grid-area {
        width: 25%;
        padding: 12px;
    }
    .vewd-fullscreen .vewd-grid {
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
    }
    .vewd-fullscreen .vewd-preview-area {
        padding: 20px;
    }
    .vewd-fullscreen .vewd-bar {
        padding: 10px;
        font-size: 14px;
    }
    .vewd-fullscreen .vewd-bar button {
        padding: 5px 14px;
        font-size: 13px;
    }

    .vewd-container.drop-hover {
        outline: 2px dashed #777;
        outline-offset: -4px;
    }
`;
document.head.appendChild(style);

// Widget factory
function createVewdWidget(node) {
    // Use getter — node.id may not be final at creation time
    const getNodeId = () => node.id;
    const seenImages = new Set();
    const state = {
        images: [],
        focusIndex: -1,
        selected: new Set(),
        tagged: new Set(),
        filterOn: false,
        typeFilter: "all",
        autoExport: false
    };

    const el = document.createElement("div");
    el.className = "vewd-container";
    el.tabIndex = 0;
    el.innerHTML = `
        <div class="vewd-header">
            <label>folder</label><input class="folder-input" type="text" spellcheck="false">
            <label>prefix</label><input class="prefix-input" type="text" spellcheck="false">
        </div>
        <div class="vewd-main">
            <div class="vewd-grid-area"><div class="vewd-grid"></div></div>
            <div class="vewd-preview-area single" style="position:relative">
                <div class="vewd-pane"></div>
                <div class="vewd-pane"></div>
                <div class="vewd-toast"></div>
            </div>
        </div>
        <div class="vewd-bar">
            <button class="fullscreen-btn">⛶</button>
            <div class="vewd-filters">
                <button class="type-filter active" data-type="all">all</button>
                <button class="type-filter" data-type="image">img</button>
                <button class="type-filter" data-type="video">vid</button>
                <button class="type-filter" data-type="audio">aud</button>
                <button class="type-filter" data-type="model">3d</button>
            </div>
            <span class="count">0</span>
            <button class="import-btn">import</button>
            <input type="file" class="import-input" multiple accept="image/*,video/*" style="display:none">
            <button class="clear-btn">clear</button>
            <button class="filter-btn">❤</button>
            <span class="tagged-count">0</span>
            <button class="auto-export-btn">auto</button>
            <button class="save-btn">save</button>
            <span style="margin-left:auto;color:#444">spacebar ❤ | s save | esc exit</span>
            <button class="vewd-logo">vewd</button>
        </div>
    `;

    const grid = el.querySelector(".vewd-grid");
    const previewArea = el.querySelector(".vewd-preview-area");
    const countEl = el.querySelector(".count");
    const taggedCountEl = el.querySelector(".tagged-count");
    const filterBtn = el.querySelector(".filter-btn");
    const clearBtn = el.querySelector(".clear-btn");
    const saveBtn = el.querySelector(".save-btn");
    const autoExportBtn = el.querySelector(".auto-export-btn");
    const fullscreenBtn = el.querySelector(".fullscreen-btn");
    const logoBtn = el.querySelector(".vewd-logo");
    const folderInput = el.querySelector(".folder-input");
    const prefixInput = el.querySelector(".prefix-input");
    const toastEl = el.querySelector(".vewd-toast");
    let toastTimer = null;

    function showToast(msg, duration = 2000) {
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove("show"), duration);
    }

    function flashBtn(btn) {
        btn.classList.add("flash");
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                btn.classList.remove("flash");
                btn.classList.add("flash-fade");
                setTimeout(() => btn.classList.remove("flash-fade"), 600);
            });
        });
    }
    let isFullscreen = false;
    let originalParent = null;
    let activePaneIndex = -1; // -1 = no pane active, 0 = left, 1 = right

    function addMedia(src, filename, type = "image", sourceInfo = null, thumbnail = null) {
        const item = document.createElement("div");
        item.className = "vewd-item";

        if (type === "video") {
            item.innerHTML = `<video src="${src}" muted playsinline preload="auto"></video><div class="media-icon">▶</div>`;
            const vid = item.querySelector("video");
            vid.addEventListener("loadeddata", () => { vid.currentTime = 0.1; });
        } else if (type === "audio") {
            item.innerHTML = `<div class="audio-icon">♪</div><audio src="${src}"></audio>`;
        } else if (type === "model") {
            if (thumbnail) {
                item.innerHTML = `<img src="${thumbnail}"><div class="media-icon">🧊</div>`;
            } else {
                item.innerHTML = `<div class="model-icon">🧊</div>`;
            }
        } else if (type === "splat") {
            if (thumbnail) {
                item.innerHTML = `<img src="${thumbnail}"><div class="media-icon">💠</div>`;
            } else {
                item.innerHTML = `<div class="splat-icon">💠</div>`;
            }
        } else {
            item.innerHTML = `<img src="${src}">`;
        }

        item.ondblclick = (e) => { e.stopPropagation(); toggleFullscreen(); };

        grid.insertBefore(item, grid.firstChild);
        state.images.unshift({ src, filename, type, el: item, sourceInfo, thumbnail });

        state.images.forEach((img, idx) => {
            img.el.onclick = (e) => handleClick(idx, e);
        });

        const newTagged = new Set();
        state.tagged.forEach(i => newTagged.add(i + 1));
        state.tagged = newTagged;

        const newSelected = new Set();
        state.selected.forEach(i => newSelected.add(i + 1));
        state.selected = newSelected;

        if (state.focusIndex >= 0) state.focusIndex++;

        // Auto-select only if nothing is currently selected
        if (state.focusIndex < 0) {
            state.selected.clear();
            state.selected.add(0);
            state.focusIndex = 0;
        }

        update();
        persistState();
    }

    function addImage(src, filename) {
        addMedia(src, filename, "image");
    }

    function handleClick(i, e) {
        if (e.ctrlKey) {
            state.selected.has(i) ? state.selected.delete(i) : state.selected.add(i);
        } else if (e.shiftKey && state.focusIndex >= 0) {
            const [a, b] = [Math.min(state.focusIndex, i), Math.max(state.focusIndex, i)];
            state.selected.clear();
            for (let x = a; x <= b; x++) state.selected.add(x);
        } else {
            state.selected.clear();
            state.selected.add(i);
        }
        state.focusIndex = i;
        update();
    }

    function sendVideoInfo(media) {
        const info = {
            node_id: String(getNodeId()),
            filename: media.filename,
            subfolder: media.sourceInfo?.subfolder || "",
            type: media.sourceInfo?.type || "temp",
        };
        api.fetchApi("/vewd/set_video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(info)
        }).catch(e => console.warn("[Vewd] Video info send failed:", e));
    }

    function clearVideoInfo() {
        api.fetchApi("/vewd/set_video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ node_id: String(getNodeId()), filename: "" })
        }).catch(e => console.warn("[Vewd] Video info clear failed:", e));
    }

    function sendImageInfo(media) {
        api.fetchApi("/vewd/set_image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                node_id: String(getNodeId()),
                filename: media.filename,
                subfolder: media.sourceInfo?.subfolder || "",
                type: media.sourceInfo?.type || "temp",
            })
        }).catch(e => console.warn("[Vewd] Image info send failed:", e));
    }

    function clearImageInfo() {
        api.fetchApi("/vewd/set_image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ node_id: String(getNodeId()), filename: "" })
        }).catch(e => console.warn("[Vewd] Image info clear failed:", e));
    }

    function update() {
        state.images.forEach((img, i) => {
            img.el.classList.toggle("selected", state.selected.has(i));
            img.el.classList.toggle("tagged", state.tagged.has(i));
            const typeMatch = state.typeFilter === "all" || img.type === state.typeFilter || (state.typeFilter === "model" && img.type === "splat");
            const tagMatch = !state.filterOn || state.tagged.has(i);
            img.el.classList.toggle("hidden", !typeMatch || !tagMatch);
        });

        // Update type filter buttons
        el.querySelectorAll(".type-filter").forEach(btn => {
            btn.classList.toggle("active", btn.dataset.type === state.typeFilter);
        });

        const sel = [...state.selected].sort((a, b) => a - b);
        const panes = previewArea.querySelectorAll(".vewd-pane");

        function renderPreview(media) {
            let content = "";
            if (media.type === "video") {
                content = `<video src="${media.src}" controls muted loop playsinline preload="auto"></video>`;
            } else if (media.type === "audio") {
                content = `<div class="audio-preview"><span class="icon">♪</span><audio src="${media.src}" controls></audio></div>`;
            } else if (media.type === "model") {
                content = `<model-viewer src="${media.src}" camera-controls auto-rotate shadow-intensity="1" style="background-color:#444;width:100%;height:100%"></model-viewer>`;
            } else if (media.type === "splat") {
                content = `<iframe class="splat-viewer" src="/extensions/vewd/splat-viewer.html"></iframe>`;
            } else {
                content = `<img src="${media.src}">`;
            }
            return content + `<span class="pane-heart">❤</span>`;
        }

        // Upload the currently viewed preview as IMAGE output for downstream nodes
        function uploadPreviewAsOutput(pane, media) {
            if (media.type === "splat") return; // handled via postMessage
            // Fetch the source image/video-frame as blob to avoid canvas taint issues
            fetch(media.src)
                .then(r => r.blob())
                .then(blob => {
                    const reader = new FileReader();
                    reader.onload = () => sendScreenshot(reader.result);
                    reader.readAsDataURL(blob);
                })
                .catch(e => console.warn("[Vewd] Preview upload failed:", e));
        }

        function sendScreenshot(dataUrl) {
            api.fetchApi("/vewd/screenshot", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ image: dataUrl, node_id: String(getNodeId()) })
            }).catch(e => console.warn("[Vewd] Screenshot upload failed:", e));
        }

        // Listen for screenshot messages from splat viewer iframe
        window.addEventListener("message", (event) => {
            if (event.data?.type === "SCREENSHOT" && event.data.image) {
                sendScreenshot(event.data.image);
                // Save camera state on the current splat item
                if (event.data.cameraState && state.focusIndex >= 0) {
                    const media = state.images[state.focusIndex];
                    if (media && media.type === "splat") {
                        if (!media.sourceInfo) media.sourceInfo = {};
                        media.sourceInfo.cameraState = event.data.cameraState;
                    }
                }
            }
        });

        function setupPane(pane, imgIndex, paneIdx) {
            pane.innerHTML = renderPreview(state.images[imgIndex]);
            pane.classList.toggle("pane-tagged", state.tagged.has(imgIndex));
            pane.onclick = (e) => { e.stopPropagation(); activePaneIndex = paneIdx; updatePaneHighlight(); };
            pane.ondblclick = (e) => { e.stopPropagation(); toggleFullscreen(); };

            const media = state.images[imgIndex];

            // For splat type, fetch PLY data and send to iframe
            if (media.type === "splat") {
                const iframe = pane.querySelector("iframe.splat-viewer");
                if (iframe) {
                    iframe.addEventListener("load", () => {
                        fetch(media.src)
                            .then(r => r.arrayBuffer())
                            .then(buffer => {
                                iframe.contentWindow.postMessage({
                                    type: "LOAD_MESH_DATA",
                                    data: buffer,
                                    filename: media.filename,
                                    extrinsics: media.sourceInfo?.extrinsics || null,
                                    intrinsics: media.sourceInfo?.intrinsics || null
                                }, "*");
                                // Restore saved camera angle, or auto-screenshot
                                const savedCam = media.sourceInfo?.cameraState;
                                setTimeout(() => {
                                    if (savedCam) {
                                        iframe.contentWindow.postMessage({ type: "RESTORE_CAMERA", cameraState: savedCam }, "*");
                                        setTimeout(() => iframe.contentWindow.postMessage({ type: "REQUEST_SCREENSHOT" }, "*"), 500);
                                    } else {
                                        iframe.contentWindow.postMessage({ type: "REQUEST_SCREENSHOT" }, "*");
                                    }
                                }, 1500);
                            })
                            .catch(err => console.error("[Vewd] Failed to load splat data:", err));
                    }, { once: true });
                }
            } else if (media.type === "video") {
                // For video, send file info for full-frame extraction + screenshot fallback
                const el = pane.querySelector("video");
                if (el) {
                    el.addEventListener("loadeddata", () => {
                        sendVideoInfo(media);
                        uploadPreviewAsOutput(pane, media);
                    }, { once: true });
                }
            } else if (media.type === "image") {
                // For images, send file info for direct-from-disk loading
                clearVideoInfo();
                sendImageInfo(media);
            } else {
                // For audio/other, just clear video and image info
                clearVideoInfo();
                clearImageInfo();
            }
        }

        if (sel.length >= 2) {
            previewArea.classList.remove("single");
            setupPane(panes[0], sel[0], 0);
            setupPane(panes[1], sel[1], 1);
        } else if (sel.length === 1) {
            previewArea.classList.add("single");
            setupPane(panes[0], sel[0], 0);
            panes[1].innerHTML = "";
            panes[1].classList.remove("pane-tagged");
            activePaneIndex = -1;
        } else {
            previewArea.classList.add("single");
            panes[0].innerHTML = "";
            panes[1].innerHTML = "";
            panes[0].classList.remove("pane-tagged");
            panes[1].classList.remove("pane-tagged");
            activePaneIndex = -1;
        }
        updatePaneHighlight();

        countEl.textContent = state.images.length;
        taggedCountEl.textContent = state.tagged.size;
        filterBtn.classList.toggle("on", state.filterOn);

        const saveCount = state.selected.size;
        saveBtn.textContent = saveCount > 0 ? `save (${saveCount})` : "save";

        autoExportBtn.classList.toggle("on", state.autoExport);
    }

    function updatePaneHighlight() {
        const panes = previewArea.querySelectorAll(".vewd-pane");
        const comparing = state.selected.size >= 2;
        panes[0].classList.toggle("active-pane", comparing && activePaneIndex === 0);
        panes[1].classList.toggle("active-pane", comparing && activePaneIndex === 1);
    }

    function navigate(d) {
        if (!state.images.length) return;
        let i = Math.max(0, Math.min(state.images.length - 1, state.focusIndex + d));
        state.selected.clear();
        state.selected.add(i);
        state.focusIndex = i;
        state.images[i].el.scrollIntoView({ block: "nearest" });
        update();
    }

    function isVisible(i) {
        const img = state.images[i];
        const typeMatch = state.typeFilter === "all" || img.type === state.typeFilter || (state.typeFilter === "model" && img.type === "splat");
        const tagMatch = !state.filterOn || state.tagged.has(i);
        return typeMatch && tagMatch;
    }

    function deleteSelected() {
        if (state.selected.size === 0 || state.images.length === 0) return;

        const toDelete = [...state.selected].sort((a, b) => b - a);
        toDelete.forEach(i => {
            const img = state.images[i];
            const seenKey = `${img.filename}_${img.sourceInfo?.subfolder || ""}`;
            seenImages.delete(seenKey);
            img.el.remove();
            state.images.splice(i, 1);
            state.tagged.delete(i);
        });

        const newTagged = new Set();
        state.tagged.forEach(t => {
            let offset = 0;
            toDelete.forEach(d => { if (d < t) offset++; });
            newTagged.add(t - offset);
        });
        state.tagged = newTagged;

        state.selected.clear();
        if (state.images.length > 0) {
            // Find next visible item respecting current filters
            let candidate = Math.min(state.focusIndex, state.images.length - 1);
            let found = -1;
            // Search forward from candidate
            for (let j = candidate; j < state.images.length; j++) {
                if (isVisible(j)) { found = j; break; }
            }
            // If nothing forward, search backward
            if (found < 0) {
                for (let j = candidate - 1; j >= 0; j--) {
                    if (isVisible(j)) { found = j; break; }
                }
            }
            if (found >= 0) {
                state.focusIndex = found;
                state.selected.add(found);
            } else {
                state.focusIndex = -1;
                // All visible items deleted but hidden items remain
                if (state.images.length > 0) {
                    const hidden = state.images.length;
                    showToast(`${hidden} hidden item${hidden > 1 ? "s" : ""} remain — use clear to remove all`);
                }
            }
        } else {
            state.focusIndex = -1;
        }

        // Rebind click handlers with correct indices
        state.images.forEach((img, idx) => {
            img.el.onclick = (e) => handleClick(idx, e);
        });

        update();
        persistState();
    }

    async function exportSelects() {
        const toExport = state.selected.size > 0
            ? state.images.filter((_, i) => state.selected.has(i))
            : state.filterOn
                ? state.images.filter((_, i) => state.tagged.has(i))
                : [];

        if (toExport.length === 0) {
            showToast("No images to export");
            return;
        }

        const folder = folderInput.value || "";
        const prefix = prefixInput.value || "vewd";

        try {
            const res = await api.fetchApi("/vewd/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    folder: folder,
                    prefix: prefix,
                    images: toExport.map(img => ({
                        filename: img.filename,
                        subfolder: img.sourceInfo?.subfolder || "",
                        type: img.sourceInfo?.type || "temp",
                        seed: img.sourceInfo?.seed || null
                    }))
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast(`Exported ${data.count} images`);
                flashBtn(exportBtn);
            } else {
                showToast("Export failed");
            }
        } catch (e) {
            showToast("Export failed");
        }
    }

    async function saveImages() {
        const toSave = state.selected.size > 0
            ? state.images.filter((_, i) => state.selected.has(i))
            : [];

        if (toSave.length === 0) {
            showToast("No images selected");
            return;
        }

        const folder = folderInput.value || "";
        const prefix = prefixInput.value || "vewd";

        try {
            const res = await api.fetchApi("/vewd/save", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    folder: folder,
                    prefix: prefix,
                    images: toSave.map(img => ({
                        filename: img.filename,
                        subfolder: img.sourceInfo?.subfolder || "",
                        type: img.sourceInfo?.type || "temp",
                        seed: img.sourceInfo?.seed || null
                    }))
                })
            });
            const data = await res.json();
            if (data.success) {
                showToast("SAVED!");
                flashBtn(saveBtn);
            } else {
                showToast("Save failed");
            }
        } catch (e) {
            showToast("Save failed");
        }
    }

    async function autoExportTagged() {
        if (!state.autoExport || state.tagged.size === 0) return;

        const toExport = state.images.filter((_, i) => state.tagged.has(i));
        const folder = folderInput.value || "";
        const prefix = prefixInput.value || "vewd";

        try {
            await api.fetchApi("/vewd/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    folder: folder,
                    prefix: prefix,
                    images: toExport.map(img => ({
                        filename: img.filename,
                        subfolder: img.sourceInfo?.subfolder || "",
                        type: img.sourceInfo?.type || "temp",
                        seed: img.sourceInfo?.seed || null
                    }))
                })
            });
        } catch (e) {
            console.error("[Vewd] Auto-export failed:", e);
        }
    }

    function toggleFullscreen() {
        isFullscreen = !isFullscreen;
        if (isFullscreen) {
            originalParent = el.parentElement;
            document.body.appendChild(el);
            el.classList.add("vewd-fullscreen");
            fullscreenBtn.textContent = "✕";
        } else {
            el.classList.remove("vewd-fullscreen");
            fullscreenBtn.textContent = "⛶";
            if (originalParent) {
                originalParent.appendChild(el);
            }
        }
        el.focus();
    }

    el.onkeydown = (e) => {
        const cols = isFullscreen ? 4 : 3;
        switch (e.key) {
            case "ArrowRight": e.preventDefault(); e.stopPropagation(); navigate(1); break;
            case "ArrowLeft": e.preventDefault(); e.stopPropagation(); navigate(-1); break;
            case "ArrowDown": e.preventDefault(); e.stopPropagation(); navigate(cols); break;
            case "ArrowUp": e.preventDefault(); e.stopPropagation(); navigate(-cols); break;
            case " ":
                e.preventDefault();
                e.stopPropagation();
                {
                    // If a compare pane is active, heart that image
                    if (activePaneIndex >= 0) {
                        const sel = [...state.selected].sort((a, b) => a - b);
                        if (sel.length >= 2 && activePaneIndex < 2) {
                            const tagIdx = sel[activePaneIndex];
                            state.tagged.has(tagIdx) ? state.tagged.delete(tagIdx) : state.tagged.add(tagIdx);
                        }
                    } else if (state.selected.size > 1) {
                        // Multi-select: if any are hearted, unheart all; otherwise heart all
                        const anyTagged = [...state.selected].some(i => state.tagged.has(i));
                        state.selected.forEach(i => {
                            anyTagged ? state.tagged.delete(i) : state.tagged.add(i);
                        });
                    } else if (state.focusIndex >= 0) {
                        state.tagged.has(state.focusIndex)
                            ? state.tagged.delete(state.focusIndex)
                            : state.tagged.add(state.focusIndex);
                    }
                    update();
                    persistState();
                    if (state.autoExport && state.tagged.size > 0) {
                        autoExportTagged();
                    }
                }
                break;
            case "Delete":
            case "Backspace":
                e.preventDefault();
                e.stopPropagation();
                deleteSelected();
                break;
            case "s":
            case "S":
                e.preventDefault();
                e.stopPropagation();
                saveImages();
                break;
            case "Escape":
                if (isFullscreen) {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleFullscreen();
                }
                break;
        }
    };

    el.onclick = (e) => e.stopPropagation();
    el.onmousedown = (e) => e.stopPropagation();

    filterBtn.onclick = () => { state.filterOn = !state.filterOn; update(); };
    el.querySelectorAll(".type-filter").forEach(btn => {
        btn.onclick = () => { state.typeFilter = btn.dataset.type; update(); };
    });
    clearBtn.onclick = () => {
        state.images.forEach(img => img.el.remove());
        state.images = [];
        state.focusIndex = -1;
        state.selected.clear();
        state.tagged.clear();
        seenImages.clear();
        update();
        persistState();
    };
    saveBtn.onclick = saveImages;
    autoExportBtn.onclick = () => { state.autoExport = !state.autoExport; update(); };
    fullscreenBtn.onclick = toggleFullscreen;
    logoBtn.onclick = () => window.open("https://x.com/spiritform", "_blank");

    folderInput.addEventListener("keydown", (e) => e.stopPropagation());
    prefixInput.addEventListener("keydown", (e) => e.stopPropagation());

    function persistState() {
        try {
            const data = {
                images: state.images.map(img => ({
                    src: img.src,
                    filename: img.filename,
                    type: img.type,
                    sourceInfo: img.sourceInfo || null,
                    thumbnail: img.thumbnail || null
                })),
                tagged: [...state.tagged],
                seen: state.images.map(img => {
                    const subfolder = img.sourceInfo?.subfolder || "";
                    return `${img.filename}_${subfolder}`;
                })
            };
            localStorage.setItem(`vewd_state_${getNodeId()}`, JSON.stringify(data));
        } catch (e) {
            console.warn("[Vewd] Failed to persist state:", e);
        }
    }

    function restoreState() {
        try {
            const raw = localStorage.getItem(`vewd_state_${getNodeId()}`);
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!data?.images?.length) return;

            data.images.forEach(saved => {
                const item = document.createElement("div");
                item.className = "vewd-item";

                // Rebuild URL fresh from sourceInfo (stale cache-buster or moved files)
                const si = saved.sourceInfo || {};
                const freshSrc = api.apiURL(`/view?filename=${encodeURIComponent(saved.filename)}&subfolder=${encodeURIComponent(si.subfolder || "")}&type=${si.type || "temp"}&t=${Date.now()}`);
                const src = freshSrc;

                // For images/videos, try fallback location if primary fails
                function tryFallback(el, tag) {
                    const altType = si.type === "temp" ? "output" : "temp";
                    const fallbackSrc = api.apiURL(`/view?filename=${encodeURIComponent(saved.filename)}&subfolder=${encodeURIComponent(si.subfolder || "")}&type=${altType}&t=${Date.now()}`);
                    el[tag === "img" ? "src" : "src"] = fallbackSrc;
                    // If fallback also fails, remove the item
                    el.addEventListener("error", () => {
                        const idx = state.images.findIndex(img => img.el === item);
                        if (idx < 0) return;
                        item.remove();
                        state.images.splice(idx, 1);
                        const newTagged = new Set();
                        state.tagged.forEach(i => { if (i < idx) newTagged.add(i); else if (i > idx) newTagged.add(i - 1); });
                        state.tagged = newTagged;
                        state.images.forEach((img, i) => { img.el.onclick = (e) => handleClick(i, e); });
                        if (state.focusIndex >= state.images.length) state.focusIndex = state.images.length - 1;
                        state.selected.clear();
                        if (state.focusIndex >= 0) state.selected.add(state.focusIndex);
                        update();
                        persistState();
                    }, { once: true });
                }

                if (saved.type === "video") {
                    item.innerHTML = `<video src="${src}" muted playsinline preload="auto"></video><div class="media-icon">▶</div>`;
                    const vid = item.querySelector("video");
                    vid.addEventListener("loadeddata", () => { vid.currentTime = 0.1; });
                    vid.addEventListener("error", () => tryFallback(vid, "video"), { once: true });
                } else if (saved.type === "audio") {
                    item.innerHTML = `<div class="audio-icon">♪</div><audio src="${src}"></audio>`;
                } else if (saved.type === "model") {
                    if (saved.thumbnail) {
                        item.innerHTML = `<img src="${saved.thumbnail}"><div class="media-icon">🧊</div>`;
                    } else {
                        item.innerHTML = `<div class="model-icon">🧊</div>`;
                    }
                } else if (saved.type === "splat") {
                    if (saved.thumbnail) {
                        item.innerHTML = `<img src="${saved.thumbnail}"><div class="media-icon">💠</div>`;
                    } else {
                        item.innerHTML = `<div class="splat-icon">💠</div>`;
                    }
                } else {
                    item.innerHTML = `<img src="${src}">`;
                    const img = item.querySelector("img");
                    if (img) img.addEventListener("error", () => tryFallback(img, "img"), { once: true });
                }

                item.ondblclick = (e) => { e.stopPropagation(); toggleFullscreen(); };
                grid.appendChild(item);
                state.images.push({ src, filename: saved.filename, type: saved.type, el: item, sourceInfo: saved.sourceInfo, thumbnail: saved.thumbnail || null });
            });

            // Bind click handlers
            state.images.forEach((img, idx) => {
                img.el.onclick = (e) => handleClick(idx, e);
            });

            // Restore tagged set
            state.tagged = new Set(data.tagged || []);

            // Repopulate seenImages
            if (data.seen) {
                data.seen.forEach(k => seenImages.add(k));
            }

            // Select first image
            if (state.images.length > 0) {
                state.selected.add(0);
                state.focusIndex = 0;
            }

            update();
            console.log(`[Vewd] Restored ${state.images.length} images, ${state.tagged.size} tagged`);
        } catch (e) {
            console.warn("[Vewd] Failed to restore state:", e);
        }
    }

    // --- Import & Drag-Drop ---
    const importInput = el.querySelector(".import-input");
    const importBtn = el.querySelector(".import-btn");

    const videoExts = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
    const audioExts = [".mp3", ".wav", ".ogg", ".flac", ".aac"];
    const modelExts = [".glb", ".gltf", ".obj", ".stl"];
    const splatExts = [".ply", ".splat"];
    const imageExts = [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp", ".tiff", ".svg"];
    const allExts = [...imageExts, ...videoExts, ...audioExts, ...modelExts, ...splatExts];

    function detectType(filename) {
        const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
        if (videoExts.includes(ext)) return "video";
        if (audioExts.includes(ext)) return "audio";
        if (splatExts.includes(ext)) return "splat";
        if (modelExts.includes(ext)) return "model";
        return "image";
    }

    async function importFiles(files) {
        for (const file of files) {
            const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
            if (!allExts.includes(ext)) continue;
            try {
                const form = new FormData();
                form.append("image", file);
                form.append("type", "input");
                const res = await fetch("/upload/image", { method: "POST", body: form });
                const data = await res.json();
                const filename = data.name;
                const subfolder = data.subfolder || "";
                const src = api.apiURL(`/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=input&t=${Date.now()}`);
                const type = detectType(filename);
                addMedia(src, filename, type, { subfolder, type: "input", seed: null });
            } catch (e) {
                console.warn("[Vewd] Import failed for", file.name, e);
            }
        }
    }

    async function importFromUrl(url) {
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            let filename = "imported_" + Date.now() + ".png";
            try {
                const path = new URL(url).pathname;
                const name = path.split("/").pop();
                if (name && name.includes(".")) filename = name;
            } catch (e) {}
            const file = new File([blob], filename, { type: blob.type });
            await importFiles([file]);
        } catch (e) {
            console.warn("[Vewd] URL import failed:", url, e);
            showToast("Import failed");
        }
    }

    importBtn.onclick = () => importInput.click();
    importInput.onchange = () => {
        if (importInput.files.length) importFiles([...importInput.files]);
        importInput.value = "";
    };

    // Drag-drop on the whole container (works even when iframe/video/model-viewer captures events)
    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        el.classList.remove("drop-hover");
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            importFiles([...e.dataTransfer.files]);
        } else {
            const url = e.dataTransfer.getData("text/uri-list") || "";
            const htmlData = e.dataTransfer.getData("text/html") || "";
            let imgUrl = url.split("\n").find(u => u && !u.startsWith("#"));
            if (!imgUrl && htmlData) {
                const match = htmlData.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (match) imgUrl = match[1];
            }
            if (imgUrl) importFromUrl(imgUrl);
        }
    }
    el.addEventListener("dragover", (e) => { e.preventDefault(); el.classList.add("drop-hover"); });
    el.addEventListener("dragenter", (e) => { e.preventDefault(); el.classList.add("drop-hover"); });
    el.addEventListener("dragleave", (e) => {
        // Only remove hover when leaving the container entirely
        if (!el.contains(e.relatedTarget)) el.classList.remove("drop-hover");
    });
    el.addEventListener("drop", handleDrop);

    // Sync current selection to backend stores (called before workflow queue)
    // Uses synchronous XHR to ensure data arrives before process() runs
    function syncToBackend() {
        if (state.focusIndex < 0 || !state.images.length) return;
        const media = state.images[state.focusIndex];
        if (!media) return;
        let endpoint, payload;
        if (media.type === "video") {
            endpoint = "/vewd/set_video";
            payload = { node_id: String(getNodeId()), filename: media.filename, subfolder: media.sourceInfo?.subfolder || "", type: media.sourceInfo?.type || "temp" };
        } else if (media.type === "image") {
            endpoint = "/vewd/set_image";
            payload = { node_id: String(getNodeId()), filename: media.filename, subfolder: media.sourceInfo?.subfolder || "", type: media.sourceInfo?.type || "temp" };
        } else {
            return;
        }
        try {
            const xhr = new XMLHttpRequest();
            xhr.open("POST", endpoint, false); // synchronous
            xhr.setRequestHeader("Content-Type", "application/json");
            xhr.send(JSON.stringify(payload));
        } catch (e) {
            console.warn("[Vewd] syncToBackend failed:", e);
        }
    }

    return { el, addImage, addMedia, state, autoExportTagged, folderInput, prefixInput, seenImages, restoreState, persistState, syncToBackend };
}

// Global widget reference
let globalVewdWidget = null;

// Register
app.registerExtension({
    name: "vewd",

    async setup() {
        let lastSeed = null;
        let lastPromptData = null;

        // Capture full prompt data at queue time for seed tracing
        const origFetchApi = api.fetchApi.bind(api);
        api.fetchApi = function(url, options, ...rest) {
            if (typeof url === 'string' && url.endsWith('/prompt') && options?.method === 'POST') {
                try {
                    const body = JSON.parse(options.body);
                    if (body.prompt) lastPromptData = body.prompt;
                } catch (e) {}
                // Sync current image/video info to backend before workflow runs
                if (globalVewdWidget) globalVewdWidget.syncToBackend();
            }
            return origFetchApi(url, options, ...rest);
        };

        // Walk backwards from a node through prompt dependency graph to find its seed
        function findSeedForNode(prompt, nodeId) {
            const visited = new Set();
            const queue = [String(nodeId)];
            while (queue.length) {
                const id = queue.shift();
                if (visited.has(id)) continue;
                visited.add(id);
                const node = prompt[id];
                if (!node) continue;
                for (const [key, val] of Object.entries(node.inputs || {})) {
                    if (/(?:^|_)seed$/.test(key) && typeof val === 'number') {
                        return String(val);
                    }
                    // Follow links: [nodeId, outputIndex]
                    if (Array.isArray(val) && val.length === 2) {
                        queue.push(String(val[0]));
                    }
                }
            }
            return null;
        }

        // Walk backwards from a node to find a source image filename (e.g. LoadImage node)
        function findImageForNode(prompt, nodeId) {
            const visited = new Set();
            const queue = [String(nodeId)];
            while (queue.length) {
                const id = queue.shift();
                if (visited.has(id)) continue;
                visited.add(id);
                const node = prompt[id];
                if (!node) continue;
                // LoadImage nodes have a string "image" input (the filename)
                if (node.inputs?.image && typeof node.inputs.image === "string" && !Array.isArray(node.inputs.image)) {
                    return api.apiURL(`/view?filename=${encodeURIComponent(node.inputs.image)}&type=input&t=${Date.now()}`);
                }
                for (const val of Object.values(node.inputs || {})) {
                    if (Array.isArray(val) && val.length === 2) {
                        queue.push(String(val[0]));
                    }
                }
            }
            return null;
        }

        api.addEventListener("executed", ({ detail }) => {
            if (!globalVewdWidget) return;

            const output = detail?.output;

            // Resolve seed from the dependency chain of the node that produced output
            try {
                if (lastPromptData && detail?.node) {
                    const seed = findSeedForNode(lastPromptData, detail.node);
                    if (seed) lastSeed = seed;
                }
            } catch (e) {
                console.warn("[Vewd] Seed lookup failed:", e);
            }

            // Detect media type from filename extension
            const videoExts = [".mp4", ".webm", ".mov", ".avi", ".mkv"];
            const audioExts = [".mp3", ".wav", ".ogg", ".flac", ".aac"];
            const modelExts = [".glb", ".gltf", ".obj", ".stl"];
            const splatExts = [".ply", ".splat"];
            function detectType(filename) {
                const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
                if (videoExts.includes(ext)) return "video";
                if (audioExts.includes(ext)) return "audio";
                if (splatExts.includes(ext)) return "splat";
                if (modelExts.includes(ext)) return "model";
                return "image";
            }

            function addOutput(item, fallbackType, thumbnail = null, extraData = null) {
                const key = `${item.filename}_${item.subfolder || ""}`;
                if (globalVewdWidget.seenImages.has(key)) return;
                globalVewdWidget.seenImages.add(key);
                const mediaType = detectType(item.filename) !== "image" ? detectType(item.filename) : fallbackType;
                const src = api.apiURL(`/view?filename=${encodeURIComponent(item.filename)}&subfolder=${encodeURIComponent(item.subfolder || "")}&type=${item.type || "temp"}&t=${Date.now()}`);
                // For 3D models/splats, find source image from prompt graph if no thumbnail provided
                try {
                    if ((mediaType === "model" || mediaType === "splat") && !thumbnail && lastPromptData && detail?.node) {
                        thumbnail = findImageForNode(lastPromptData, detail.node);
                    }
                } catch (e) {
                    console.warn("[Vewd] Thumbnail lookup failed:", e);
                }
                const sourceInfo = { subfolder: item.subfolder || "", type: item.type || "temp", seed: lastSeed };
                if (extraData) Object.assign(sourceInfo, extraData);
                globalVewdWidget.addMedia(src, item.filename, mediaType, sourceInfo, thumbnail);
            }

            // Handle images (detect videos by extension)
            if (output?.images) {
                output.images.forEach(img => addOutput(img, "image"));
            }

            // Handle GIFs (VHS nodes)
            if (output?.gifs) {
                output.gifs.forEach(gif => addOutput(gif, "video"));
            }

            // Handle videos (plural and singular)
            if (output?.videos) {
                output.videos.forEach(vid => addOutput(vid, "video"));
            }
            if (output?.video) {
                const vids = Array.isArray(output.video) ? output.video : [output.video];
                vids.forEach(vid => addOutput(vid, "video"));
            }

            // Handle audio - try multiple keys that different nodes use
            const audioSources = output?.audio || output?.audios || output?.audio_file;
            if (audioSources) {
                const audioList = Array.isArray(audioSources) ? audioSources : [audioSources];
                audioList.forEach(aud => addOutput(aud, "audio"));
            }

            // Handle 3D models / meshes
            const meshSources = output?.mesh || output?.model_file;
            if (meshSources) {
                const meshList = Array.isArray(meshSources) ? meshSources : [meshSources];
                meshList.forEach(m => addOutput(m, "model"));
            }

            // Handle "result" key (Preview 3D & Animation node sends ["filename.glb", camera_info, bg_image])
            const allMeshExts = [...modelExts, ...splatExts];
            if (output?.result) {
                const results = Array.isArray(output.result) ? output.result : [output.result];
                results.forEach(item => {
                    if (typeof item === "string" && allMeshExts.some(ext => item.toLowerCase().endsWith(ext))) {
                        const fallback = splatExts.some(ext => item.toLowerCase().endsWith(ext)) ? "splat" : "model";
                        addOutput({ filename: item, subfolder: "", type: "output" }, fallback);
                    } else if (item && typeof item === "object" && item.filename) {
                        const fn = item.filename.toLowerCase();
                        if (allMeshExts.some(ext => fn.endsWith(ext))) {
                            const fallback = splatExts.some(ext => fn.endsWith(ext)) ? "splat" : "model";
                            addOutput(item, fallback);
                        }
                    }
                });
            }

            // Handle PLY files from PlyPreview / Gaussian splat nodes (ply_file key)
            if (output?.ply_file) {
                // Capture extrinsics/intrinsics from the same output (PlyPreview sends these)
                const extrinsics = output.extrinsics?.[0] || null;
                const intrinsics = output.intrinsics?.[0] || null;
                const extraData = {};
                if (extrinsics) extraData.extrinsics = extrinsics;
                if (intrinsics) extraData.intrinsics = intrinsics;

                const plyFiles = Array.isArray(output.ply_file) ? output.ply_file : [output.ply_file];
                plyFiles.forEach(p => {
                    if (typeof p === "string" && p.length > 0) {
                        const filename = p.includes("/") ? p.split("/").pop() : p.includes("\\") ? p.split("\\").pop() : p;
                        const subfolder = p.includes("/") ? p.slice(0, p.lastIndexOf("/")) : "";
                        addOutput({ filename, subfolder, type: "output" }, "splat", null, Object.keys(extraData).length ? extraData : null);
                    }
                });
            }

            // Debug: log unknown output types to console
            const knownKeys = new Set(["images", "gifs", "videos", "video", "audio", "audios", "audio_file", "mesh", "model_file", "result", "vewd_images", "ply_file", "filename", "file_size_mb", "extrinsics", "intrinsics"]);
            Object.keys(output || {}).forEach(key => {
                if (!knownKeys.has(key)) {
                    console.log("[Vewd] Unknown output key:", key, output[key]);
                }
            });

            // Auto-export hearted images after each generation
            globalVewdWidget.autoExportTagged();
        });
    },

    async nodeCreated(node) {
        if (node.comfyClass !== "Vewd") return;

        const widget = createVewdWidget(node);
        node.vewdWidget = widget;
        globalVewdWidget = widget;

        node.addDOMWidget("vewd_ui", "custom", widget.el, {
            serialize: false,
            hideOnZoom: false,
        });

        // Hide default widgets — folder path stretches the node too wide
        // Store refs then remove from widgets array so LiteGraph won't render them
        const hiddenWidgets = {};
        if (node.widgets) {
            for (let i = node.widgets.length - 1; i >= 0; i--) {
                const w = node.widgets[i];
                if (w.name === "folder" || w.name === "filename_prefix") {
                    hiddenWidgets[w.name] = w;
                    node.widgets.splice(i, 1);
                }
            }
        }
        // Persist folder/prefix via localStorage (keyed per node ID)
        const storageKey = `vewd_${node.id}`;
        const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");

        // Restore saved values (or fall back to hidden widget defaults)
        widget.folderInput.value = saved.folder ?? hiddenWidgets["folder"]?.value ?? "";
        widget.prefixInput.value = saved.prefix ?? hiddenWidgets["filename_prefix"]?.value ?? "";

        function persist() {
            localStorage.setItem(storageKey, JSON.stringify({
                folder: widget.folderInput.value,
                prefix: widget.prefixInput.value
            }));
            // Also sync to hidden widgets for the backend
            if (hiddenWidgets["folder"]) hiddenWidgets["folder"].value = widget.folderInput.value;
            if (hiddenWidgets["filename_prefix"]) hiddenWidgets["filename_prefix"].value = widget.prefixInput.value;
        }
        widget.folderInput.addEventListener("input", persist);
        widget.prefixInput.addEventListener("input", persist);

        widget.restoreState();

        node.setSize([1100, 600]);
    }
});
