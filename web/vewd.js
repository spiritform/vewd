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
        gap: 4px;
    }

    .vewd-item {
        aspect-ratio: 1;
        background: #0a0a0a;
        border: 1px solid transparent;
        border-radius: 3px;
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
    .vewd-pane img, .vewd-pane video { max-width: 100%; max-height: 100%; object-fit: contain; }
    .vewd-pane .audio-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 20px;
        color: #666;
        width: 100%;
    }
    .vewd-pane .audio-preview .icon { font-size: 64px; }
    .vewd-pane .audio-preview audio { width: 80%; height: 40px; }

    .vewd-filters {
        display: flex;
        gap: 4px;
        margin-left: 8px;
    }
    .vewd-filters button {
        background: transparent;
        border: 1px solid #333;
        color: #555;
        padding: 2px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 9px;
    }
    .vewd-filters button:hover { border-color: #555; color: #888; }
    .vewd-filters button.active { border-color: #4a9eff; color: #4a9eff; }

    .vewd-bar {
        display: flex;
        gap: 8px;
        padding: 5px 8px;
        background: #1a1a1a;
        font-size: 10px;
        color: #555;
        align-items: center;
    }
    .vewd-bar button {
        background: #252525;
        border: none;
        color: #777;
        padding: 3px 10px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
    }
    .vewd-bar button:hover { background: #333; color: #aaa; }
    .vewd-bar button.on { background: #ff4a6a; color: #fff; }
    .vewd-bar .export-btn { background: #1a1a1a; color: #333; pointer-events: none; }
    .vewd-bar .export-btn.active { background: #eee; color: #222; pointer-events: auto; }
    .vewd-bar .export-btn.active:hover { background: #fff; }

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
        typeFilter: "all"
    };

    const el = document.createElement("div");
    el.className = "vewd-container";
    el.tabIndex = 0;
    el.innerHTML = `
        <div class="vewd-main">
            <div class="vewd-grid-area"><div class="vewd-grid"></div></div>
            <div class="vewd-preview-area single">
                <div class="vewd-pane"></div>
                <div class="vewd-pane"></div>
            </div>
        </div>
        <div class="vewd-bar">
            <button class="fullscreen-btn">⛶</button>
            <span class="count">0</span>
            <span class="tagged-count">0 tagged</span>
            <div class="vewd-filters">
                <button class="type-filter active" data-type="all">All</button>
                <button class="type-filter" data-type="image">Img</button>
                <button class="type-filter" data-type="video">Vid</button>
                <button class="type-filter" data-type="audio">Aud</button>
            </div>
            <button class="filter-btn">❤</button>
            <button class="clear-btn">Clear</button>
            <button class="export-btn">Export Selects</button>
            <span style="margin-left:auto;color:#444">Space: ❤ | Esc: exit</span>
        </div>
    `;

    const grid = el.querySelector(".vewd-grid");
    const previewArea = el.querySelector(".vewd-preview-area");
    const countEl = el.querySelector(".count");
    const taggedCountEl = el.querySelector(".tagged-count");
    const filterBtn = el.querySelector(".filter-btn");
    const clearBtn = el.querySelector(".clear-btn");
    const exportBtn = el.querySelector(".export-btn");
    const fullscreenBtn = el.querySelector(".fullscreen-btn");
    let isFullscreen = false;
    let originalParent = null;

    function addMedia(src, filename, type = "image") {
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
        state.images.unshift({ src, filename, type, el: item });

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
            if (media.type === "video") {
                return `<video src="${media.src}" controls muted loop></video>`;
            } else if (media.type === "audio") {
                return `<div class="audio-preview"><span class="icon">♪</span><audio src="${media.src}" controls></audio></div>`;
            }
            return `<img src="${media.src}">`;
        }

        if (sel.length >= 2) {
            previewArea.classList.remove("single");
            panes[0].innerHTML = renderPreview(state.images[sel[0]]);
            panes[1].innerHTML = renderPreview(state.images[sel[1]]);
        } else if (sel.length === 1) {
            previewArea.classList.add("single");
            panes[0].innerHTML = renderPreview(state.images[sel[0]]);
            panes[1].innerHTML = "";
        } else {
            previewArea.classList.add("single");
            panes[0].innerHTML = "";
            panes[1].innerHTML = "";
        }

        countEl.textContent = state.images.length;
        taggedCountEl.textContent = `${state.tagged.size} ❤`;
        filterBtn.classList.toggle("on", state.filterOn);

        const exportCount = state.tagged.size > 0 ? state.tagged.size : state.selected.size;
        exportBtn.classList.toggle("active", exportCount > 0);
        exportBtn.textContent = exportCount > 0 ? `Export (${exportCount})` : "Export";
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
        update();
    }

    async function exportSelects() {
        const toExport = state.tagged.size > 0
            ? state.images.filter((_, i) => state.tagged.has(i))
            : state.images.filter((_, i) => state.selected.has(i));

        if (toExport.length === 0) {
            alert("No images to export");
            return;
        }

        const folderWidget = node.widgets?.find(w => w.name === "folder");
        const prefixWidget = node.widgets?.find(w => w.name === "filename_prefix");
        const folder = folderWidget?.value || "";
        const prefix = prefixWidget?.value || "select";

        try {
            const res = await api.fetchApi("/vewd/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    folder: folder,
                    prefix: prefix,
                    images: toExport.map(img => img.filename)
                })
            });
            const data = await res.json();
            if (data.success) {
                alert(`Exported ${data.count} images`);
            } else {
                alert("Export failed: " + data.error);
            }
        } catch (e) {
            alert("Export failed: " + e.message);
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
                if (state.focusIndex >= 0) {
                    state.tagged.has(state.focusIndex)
                        ? state.tagged.delete(state.focusIndex)
                        : state.tagged.add(state.focusIndex);
                    update();
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
    exportBtn.onclick = exportSelects;
    fullscreenBtn.onclick = toggleFullscreen;

    return { el, addImage, addMedia, state };
}

// Global widget reference
let globalVewdWidget = null;
let seenImages = new Set();

// Register
app.registerExtension({
    name: "vewd",

    async setup() {
        api.addEventListener("executed", ({ detail }) => {
            if (!globalVewdWidget) return;

            console.log("[Vewd] executed event:", detail?.node, detail?.output);

            const output = detail?.output;

            // Handle images
            if (output?.images) {
                output.images.forEach(img => {
                    const key = `${img.filename}_${img.subfolder || ""}`;
                    if (seenImages.has(key)) return;
                    seenImages.add(key);

                    const src = api.apiURL(`/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}&t=${Date.now()}`);
                    globalVewdWidget.addMedia(src, img.filename, "image");
                });
            }

            // Handle GIFs (VHS nodes)
            if (output?.gifs) {
                output.gifs.forEach(gif => {
                    const key = `${gif.filename}_${gif.subfolder || ""}`;
                    if (seenImages.has(key)) return;
                    seenImages.add(key);

                    const src = api.apiURL(`/view?filename=${encodeURIComponent(gif.filename)}&subfolder=${encodeURIComponent(gif.subfolder || "")}&type=${gif.type}&t=${Date.now()}`);
                    globalVewdWidget.addMedia(src, gif.filename, "video");
                });
            }

            // Handle videos
            if (output?.videos) {
                output.videos.forEach(vid => {
                    const key = `${vid.filename}_${vid.subfolder || ""}`;
                    if (seenImages.has(key)) return;
                    seenImages.add(key);

                    const src = api.apiURL(`/view?filename=${encodeURIComponent(vid.filename)}&subfolder=${encodeURIComponent(vid.subfolder || "")}&type=${vid.type}&t=${Date.now()}`);
                    globalVewdWidget.addMedia(src, vid.filename, "video");
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
                    globalVewdWidget.addMedia(src, aud.filename, "audio");
                });
            }

            // Debug: log unknown output types to console
            const knownKeys = new Set(["images", "gifs", "videos", "audio", "audios", "audio_file", "vewd_images"]);
            Object.keys(output || {}).forEach(key => {
                if (!knownKeys.has(key)) {
                    console.log("[Vewd] Unknown output key:", key, output[key]);
                }
            });
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

        node.setSize([400, 450]);
    }
});
