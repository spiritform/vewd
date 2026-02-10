import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

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
        border: 2px solid transparent;
        border-radius: 3px;
        overflow: hidden;
        cursor: pointer;
        position: relative;
    }
    .vewd-item:hover { border-color: #444; }
    .vewd-item.selected { border-color: #888; }
    .vewd-item.tagged::after {
        content: "v";
        position: absolute;
        top: 2px;
        right: 2px;
        background: #4a9eff;
        color: #fff;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        font-size: 9px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .vewd-item.hidden { display: none; }
    .vewd-item img { width: 100%; height: 100%; object-fit: contain; }

    .vewd-preview-area {
        flex: 1;
        background: #0a0a0a;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px;
        min-width: 0;
    }
    .vewd-preview-area img { max-width: 100%; max-height: 100%; object-fit: contain; }

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
    .vewd-bar button.on { background: #4a9eff; color: #fff; }
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
        filterOn: false
    };

    const el = document.createElement("div");
    el.className = "vewd-container";
    el.tabIndex = 0;
    el.innerHTML = `
        <div class="vewd-main">
            <div class="vewd-grid-area"><div class="vewd-grid"></div></div>
            <div class="vewd-preview-area"></div>
        </div>
        <div class="vewd-bar">
            <button class="fullscreen-btn">⛶</button>
            <span class="count">0</span>
            <span class="tagged-count">0 tagged</span>
            <button class="filter-btn">Filter</button>
            <button class="clear-btn">Clear</button>
            <button class="export-btn">Export Selects</button>
            <span style="margin-left:auto;color:#444">Space: tag • Esc: exit fullscreen</span>
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

    function addImage(src, filename) {
        const item = document.createElement("div");
        item.className = "vewd-item";
        item.innerHTML = `<img src="${src}">`;
        item.ondblclick = (e) => { e.stopPropagation(); toggleFullscreen(); };

        // Add to beginning
        grid.insertBefore(item, grid.firstChild);
        state.images.unshift({ src, filename, el: item });

        // Update click handlers with correct indices
        state.images.forEach((img, idx) => {
            img.el.onclick = (e) => handleClick(idx, e);
        });

        // Shift tagged/selected indices
        const newTagged = new Set();
        state.tagged.forEach(i => newTagged.add(i + 1));
        state.tagged = newTagged;

        const newSelected = new Set();
        state.selected.forEach(i => newSelected.add(i + 1));
        state.selected = newSelected;

        if (state.focusIndex >= 0) state.focusIndex++;

        // Select new image
        state.selected.clear();
        state.selected.add(0);
        state.focusIndex = 0;

        update();
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
            img.el.classList.toggle("hidden", state.filterOn && !state.tagged.has(i));
        });

        // Single preview
        const sel = [...state.selected].sort((a, b) => a - b);
        if (sel.length >= 1) {
            previewArea.innerHTML = `<img src="${state.images[sel[0]].src}">`;
        } else {
            previewArea.innerHTML = "";
        }

        countEl.textContent = state.images.length;
        taggedCountEl.textContent = `${state.tagged.size} tagged`;
        filterBtn.classList.toggle("on", state.filterOn);

        // Export button - uses tagged if any, otherwise selected
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

        // Reindex tagged
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
        // Use tagged if any, otherwise use selected
        const toExport = state.tagged.size > 0
            ? state.images.filter((_, i) => state.tagged.has(i))
            : state.images.filter((_, i) => state.selected.has(i));

        if (toExport.length === 0) {
            alert("No images to export");
            return;
        }

        // Get folder and prefix from node widgets
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

    // Stop clicks from selecting the node
    el.onclick = (e) => e.stopPropagation();
    el.onmousedown = (e) => e.stopPropagation();

    filterBtn.onclick = () => { state.filterOn = !state.filterOn; update(); };
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

    return { el, addImage, state };
}

// Global widget reference
let globalVewdWidget = null;
let seenImages = new Set();

// Register
app.registerExtension({
    name: "vewd",

    async setup() {
        // Hook into all node executions to capture images
        api.addEventListener("executed", ({ detail }) => {
            if (!globalVewdWidget) return;

            const output = detail?.output;
            if (output?.images) {
                output.images.forEach(img => {
                    // Skip if we've already seen this image
                    const key = `${img.filename}_${img.subfolder || ""}`;
                    if (seenImages.has(key)) return;
                    seenImages.add(key);

                    const src = api.apiURL(`/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}&t=${Date.now()}`);
                    globalVewdWidget.addImage(src, img.filename);
                });
            }
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
