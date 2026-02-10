import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// Add styles
const style = document.createElement("style");
style.textContent = `
    .vewd-widget {
        background: #1a1a1a;
        border-radius: 8px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .vewd-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 4px;
        padding: 8px;
        max-height: 200px;
        overflow-y: auto;
    }

    .vewd-grid::-webkit-scrollbar { width: 4px; }
    .vewd-grid::-webkit-scrollbar-track { background: #1a1a1a; }
    .vewd-grid::-webkit-scrollbar-thumb { background: #444; border-radius: 2px; }

    .vewd-grid-item {
        aspect-ratio: 1;
        background: #111;
        border: 2px solid transparent;
        border-radius: 4px;
        overflow: hidden;
        cursor: pointer;
        position: relative;
    }
    .vewd-grid-item:hover { border-color: #444; }
    .vewd-grid-item.selected { border-color: #4a9eff; }
    .vewd-grid-item.tagged::after {
        content: "✓";
        position: absolute;
        top: 2px;
        right: 2px;
        background: #4a9eff;
        color: #fff;
        width: 14px;
        height: 14px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 8px;
    }
    .vewd-grid-item img {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }

    .vewd-preview {
        background: #111;
        border-top: 1px solid #333;
        display: flex;
        min-height: 150px;
        max-height: 300px;
    }

    .vewd-preview-pane {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
    }
    .vewd-preview-pane img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
    }
    .vewd-preview-pane + .vewd-preview-pane {
        border-left: 1px solid #333;
    }

    .vewd-toolbar {
        display: flex;
        gap: 8px;
        padding: 6px 8px;
        background: #222;
        border-top: 1px solid #333;
        font-size: 10px;
        color: #666;
    }
    .vewd-toolbar span { color: #555; }
    .vewd-toolbar button {
        background: #333;
        border: none;
        color: #888;
        padding: 2px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
    }
    .vewd-toolbar button:hover { background: #444; }
    .vewd-toolbar button.active { background: #4a9eff; color: #fff; }
`;
document.head.appendChild(style);

// Vewd widget class
class VewdWidget {
    constructor(node) {
        this.node = node;
        this.images = [];
        this.selectedIndex = -1;
        this.selectedIndices = new Set();
        this.taggedIndices = new Set();
        this.showTaggedOnly = false;

        this.element = document.createElement("div");
        this.element.className = "vewd-widget";
        this.element.innerHTML = `
            <div class="vewd-grid"></div>
            <div class="vewd-preview">
                <div class="vewd-preview-pane"></div>
                <div class="vewd-preview-pane"></div>
            </div>
            <div class="vewd-toolbar">
                <span class="vewd-count">0 images</span>
                <span class="vewd-tagged">0 tagged</span>
                <button class="vewd-filter">Filter</button>
                <button class="vewd-clear">Clear</button>
            </div>
        `;

        this.grid = this.element.querySelector(".vewd-grid");
        this.pane1 = this.element.querySelectorAll(".vewd-preview-pane")[0];
        this.pane2 = this.element.querySelectorAll(".vewd-preview-pane")[1];
        this.countEl = this.element.querySelector(".vewd-count");
        this.taggedEl = this.element.querySelector(".vewd-tagged");
        this.filterBtn = this.element.querySelector(".vewd-filter");
        this.clearBtn = this.element.querySelector(".vewd-clear");

        this.filterBtn.onclick = () => this.toggleFilter();
        this.clearBtn.onclick = () => this.clear();

        // Keyboard
        this.element.tabIndex = 0;
        this.element.addEventListener("keydown", (e) => this.handleKey(e));
    }

    addImage(src, filename) {
        const index = this.images.length;

        const item = document.createElement("div");
        item.className = "vewd-grid-item";
        item.dataset.index = index;

        const img = document.createElement("img");
        img.src = src;
        item.appendChild(img);

        item.onclick = (e) => this.handleClick(index, e);

        this.grid.appendChild(item);
        this.images.push({ src, filename, element: item });

        // Select first image
        if (this.selectedIndex === -1) {
            this.selectedIndex = 0;
            this.selectedIndices.add(0);
        }

        this.updateUI();
        this.node.setSize([this.node.size[0], this.node.computeSize()[1]]);
    }

    handleClick(index, e) {
        if (e.ctrlKey || e.metaKey) {
            if (this.selectedIndices.has(index)) this.selectedIndices.delete(index);
            else this.selectedIndices.add(index);
        } else if (e.shiftKey && this.selectedIndex >= 0) {
            const start = Math.min(this.selectedIndex, index);
            const end = Math.max(this.selectedIndex, index);
            for (let i = start; i <= end; i++) this.selectedIndices.add(i);
        } else {
            this.selectedIndices.clear();
            this.selectedIndices.add(index);
        }
        this.selectedIndex = index;
        this.updateUI();
    }

    handleKey(e) {
        if (this.images.length === 0) return;

        const cols = 4;
        switch(e.key) {
            case "ArrowRight": e.preventDefault(); this.navigate(1); break;
            case "ArrowLeft": e.preventDefault(); this.navigate(-1); break;
            case "ArrowDown": e.preventDefault(); this.navigate(cols); break;
            case "ArrowUp": e.preventDefault(); this.navigate(-cols); break;
            case " ":
                e.preventDefault();
                if (this.taggedIndices.has(this.selectedIndex)) {
                    this.taggedIndices.delete(this.selectedIndex);
                } else {
                    this.taggedIndices.add(this.selectedIndex);
                }
                this.images[this.selectedIndex].element.classList.toggle("tagged");
                this.updateUI();
                break;
        }
    }

    navigate(delta) {
        let newIndex = this.selectedIndex + delta;
        newIndex = Math.max(0, Math.min(this.images.length - 1, newIndex));
        this.selectedIndices.clear();
        this.selectedIndices.add(newIndex);
        this.selectedIndex = newIndex;
        this.updateUI();
        this.images[newIndex].element.scrollIntoView({ block: "nearest" });
    }

    toggleFilter() {
        this.showTaggedOnly = !this.showTaggedOnly;
        this.filterBtn.classList.toggle("active", this.showTaggedOnly);
        this.images.forEach((img, i) => {
            img.element.style.display = (this.showTaggedOnly && !this.taggedIndices.has(i)) ? "none" : "";
        });
    }

    clear() {
        this.images = [];
        this.selectedIndex = -1;
        this.selectedIndices.clear();
        this.taggedIndices.clear();
        this.grid.innerHTML = "";
        this.updateUI();
        this.node.setSize([this.node.size[0], this.node.computeSize()[1]]);
    }

    updateUI() {
        // Update selection
        this.images.forEach((img, i) => {
            img.element.classList.toggle("selected", this.selectedIndices.has(i));
            img.element.classList.toggle("tagged", this.taggedIndices.has(i));
        });

        // Update preview
        const selected = Array.from(this.selectedIndices).sort((a,b) => a-b);
        if (selected.length >= 2) {
            this.pane1.innerHTML = `<img src="${this.images[selected[0]].src}">`;
            this.pane2.innerHTML = `<img src="${this.images[selected[1]].src}">`;
            this.pane2.style.display = "flex";
        } else if (selected.length === 1) {
            this.pane1.innerHTML = `<img src="${this.images[selected[0]].src}">`;
            this.pane2.innerHTML = "";
            this.pane2.style.display = "none";
        } else {
            this.pane1.innerHTML = "";
            this.pane2.innerHTML = "";
        }

        // Update counts
        this.countEl.textContent = `${this.images.length} images`;
        this.taggedEl.textContent = `${this.taggedIndices.size} tagged`;
    }
}

// Register extension
app.registerExtension({
    name: "vewd",

    async nodeCreated(node) {
        if (node.comfyClass !== "Vewd") return;

        // Create widget
        const widget = new VewdWidget(node);
        node.vewdWidget = widget;

        // Add as DOM widget
        node.addDOMWidget("vewd_viewer", "customWidget", widget.element, {
            serialize: false,
            hideOnZoom: false,
        });

        // Hook into execution to capture images
        const origOnExecuted = node.onExecuted;
        node.onExecuted = function(output) {
            if (origOnExecuted) origOnExecuted.call(this, output);

            if (output && output.images) {
                output.images.forEach(img => {
                    const src = api.apiURL(`/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}&t=${Date.now()}`);
                    widget.addImage(src, img.filename);
                });
            }
        };

        // Set initial size
        node.setSize([350, 500]);
    }
});
