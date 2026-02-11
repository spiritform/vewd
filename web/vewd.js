import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

console.log("[Vewd] Extension loaded");

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
    .vewd-item img, .vewd-item video { width: 100%; height: 100%; object-fit: contain; }
    .vewd-item .audio-icon {
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
        padding: 10px 12px;
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
    .vewd-bar .vewd-logo:hover { color: #4a9eff !important; }
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
    .vewd-bar .export-btn { background: #1a1a1a; color: #333; pointer-events: none; }
    .vewd-bar .export-btn.active { background: #252525; color: #777; pointer-events: auto; }
    .vewd-bar .export-btn.active:hover { background: #333; color: #aaa; }
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
        padding: 10px 20px;
        font-size: 12px;
    }
    .vewd-fullscreen .vewd-bar button {
        padding: 5px 14px;
        font-size: 12px;
    }
`;
document.head.appendChild(style);

// Widget factory
function createVewdWidget(node) {
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
            </div>
            <span class="count">0</span>
            <button class="filter-btn">❤</button>
            <span class="tagged-count">0</span>
            <button class="auto-export-btn">auto</button>
            <button class="clear-btn">clear</button>
            <button class="export-btn">export selects</button>
            <button class="save-btn">save</button>
            <span style="margin-left:auto;color:#444">spacebar ❤ | esc exit</span>
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
    const exportBtn = el.querySelector(".export-btn");
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

    function addMedia(src, filename, type = "image", sourceInfo = null) {
        const item = document.createElement("div");
        item.className = "vewd-item";

        if (type === "video") {
            item.innerHTML = `<video src="${src}" muted preload="metadata"></video><div class="media-icon">▶</div>`;
            // Seek to show thumbnail
            const vid = item.querySelector("video");
            vid.addEventListener("loadedmetadata", () => { vid.currentTime = 0.1; });
        } else if (type === "audio") {
            item.innerHTML = `<div class="audio-icon">♪</div><audio src="${src}"></audio>`;
        } else {
            item.innerHTML = `<img src="${src}">`;
        }

        item.ondblclick = (e) => { e.stopPropagation(); toggleFullscreen(); };

        grid.insertBefore(item, grid.firstChild);
        state.images.unshift({ src, filename, type, el: item, sourceInfo });

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

        state.selected.clear();
        state.selected.add(0);
        state.focusIndex = 0;

        update();
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

    function update() {
        state.images.forEach((img, i) => {
            img.el.classList.toggle("selected", state.selected.has(i));
            img.el.classList.toggle("tagged", state.tagged.has(i));
            const typeMatch = state.typeFilter === "all" || img.type === state.typeFilter;
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
                content = `<video src="${media.src}" controls muted loop></video>`;
            } else if (media.type === "audio") {
                content = `<div class="audio-preview"><span class="icon">♪</span><audio src="${media.src}" controls></audio></div>`;
            } else {
                content = `<img src="${media.src}">`;
            }
            return content + `<span class="pane-heart">❤</span>`;
        }

        function setupPane(pane, imgIndex, paneIdx) {
            pane.innerHTML = renderPreview(state.images[imgIndex]);
            pane.classList.toggle("pane-tagged", state.tagged.has(imgIndex));
            pane.onclick = (e) => { e.stopPropagation(); activePaneIndex = paneIdx; updatePaneHighlight(); };
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
        saveBtn.classList.toggle("active", saveCount > 0);
        saveBtn.textContent = saveCount > 0 ? `save (${saveCount})` : "save";

        const exportCount = state.selected.size > 0 ? state.selected.size : (state.filterOn ? state.tagged.size : 0);
        exportBtn.classList.toggle("active", exportCount > 0);
        exportBtn.textContent = exportCount > 0 ? `export selects (${exportCount})` : "export selects";

        autoExportBtn.classList.toggle("on", state.autoExport);
    }

    function updatePaneHighlight() {
        const panes = previewArea.querySelectorAll(".vewd-pane");
        panes[0].classList.toggle("active-pane", activePaneIndex === 0);
        panes[1].classList.toggle("active-pane", activePaneIndex === 1);
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

    function deleteSelected() {
        if (state.selected.size === 0 || state.images.length === 0) return;

        const toDelete = [...state.selected].sort((a, b) => b - a);
        toDelete.forEach(i => {
            state.images[i].el.remove();
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
            state.focusIndex = Math.min(state.focusIndex, state.images.length - 1);
            state.selected.add(state.focusIndex);
        } else {
            state.focusIndex = -1;
        }

        // Rebind click handlers with correct indices
        state.images.forEach((img, idx) => {
            img.el.onclick = (e) => handleClick(idx, e);
        });

        update();
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
                showToast(`Saved ${data.count} images`);
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
    };
    saveBtn.onclick = saveImages;
    exportBtn.onclick = exportSelects;
    autoExportBtn.onclick = () => { state.autoExport = !state.autoExport; update(); };
    fullscreenBtn.onclick = toggleFullscreen;
    logoBtn.onclick = () => window.open("https://x.com/spiritform", "_blank");

    folderInput.addEventListener("keydown", (e) => e.stopPropagation());
    prefixInput.addEventListener("keydown", (e) => e.stopPropagation());

    return { el, addImage, addMedia, state, autoExportTagged, folderInput, prefixInput };
}

// Global widget reference
let globalVewdWidget = null;
let seenImages = new Set();

// Register
app.registerExtension({
    name: "vewd",

    async setup() {
        let lastSeed = null;

        api.addEventListener("executed", ({ detail }) => {
            if (!globalVewdWidget) return;

            const output = detail?.output;

            // Capture seed: walk all graph nodes, match "seed" or "123: seed" (subgraph prefix)
            try {
                const nodes = app.graph._nodes || [];
                for (const n of nodes) {
                    const sw = n.widgets?.find(w => w.name === "seed" || w.name.endsWith(": seed"));
                    if (sw && sw.value != null) {
                        lastSeed = String(sw.value);
                        break;
                    }
                }
            } catch (e) {
                console.warn("[Vewd] seed search error:", e);
            }

            // Handle images
            if (output?.images) {
                output.images.forEach(img => {
                    const key = `${img.filename}_${img.subfolder || ""}`;
                    if (seenImages.has(key)) return;
                    seenImages.add(key);

                    const src = api.apiURL(`/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}&t=${Date.now()}`);
                    globalVewdWidget.addMedia(src, img.filename, "image", { subfolder: img.subfolder || "", type: img.type || "temp", seed: lastSeed });
                });
            }

            // Handle GIFs (VHS nodes)
            if (output?.gifs) {
                output.gifs.forEach(gif => {
                    const key = `${gif.filename}_${gif.subfolder || ""}`;
                    if (seenImages.has(key)) return;
                    seenImages.add(key);

                    const src = api.apiURL(`/view?filename=${encodeURIComponent(gif.filename)}&subfolder=${encodeURIComponent(gif.subfolder || "")}&type=${gif.type}&t=${Date.now()}`);
                    globalVewdWidget.addMedia(src, gif.filename, "video", { subfolder: gif.subfolder || "", type: gif.type || "temp" });
                });
            }

            // Handle videos
            if (output?.videos) {
                output.videos.forEach(vid => {
                    const key = `${vid.filename}_${vid.subfolder || ""}`;
                    if (seenImages.has(key)) return;
                    seenImages.add(key);

                    const src = api.apiURL(`/view?filename=${encodeURIComponent(vid.filename)}&subfolder=${encodeURIComponent(vid.subfolder || "")}&type=${vid.type}&t=${Date.now()}`);
                    globalVewdWidget.addMedia(src, vid.filename, "video", { subfolder: vid.subfolder || "", type: vid.type || "temp" });
                });
            }

            // Handle audio - try multiple keys that different nodes use
            const audioSources = output?.audio || output?.audios || output?.audio_file;
            if (audioSources) {
                const audioList = Array.isArray(audioSources) ? audioSources : [audioSources];
                audioList.forEach(aud => {
                    const key = `${aud.filename}_${aud.subfolder || ""}`;
                    if (seenImages.has(key)) return;
                    seenImages.add(key);

                    const src = api.apiURL(`/view?filename=${encodeURIComponent(aud.filename)}&subfolder=${encodeURIComponent(aud.subfolder || "")}&type=${aud.type || "output"}&t=${Date.now()}`);
                    globalVewdWidget.addMedia(src, aud.filename, "audio", { subfolder: aud.subfolder || "", type: aud.type || "output" });
                });
            }

            // Debug: log unknown output types to console
            const knownKeys = new Set(["images", "gifs", "videos", "audio", "audios", "audio_file", "vewd_images"]);
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

        node.setSize([500, 550]);
    }
});
