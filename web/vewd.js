import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

// Vewd Viewer Panel for ComfyUI
class VewdViewer {
    constructor() {
        this.images = [];
        this.focusIndex = -1;
        this.selectedIndices = new Set();
        this.taggedIndices = new Set();
        this.showOnlyTagged = false;
        this.panel = null;
        this.isOpen = false;
    }

    createPanel() {
        if (this.panel) return;

        this.panel = document.createElement("div");
        this.panel.id = "vewd-panel";
        this.panel.innerHTML = `
            <div id="vewd-header">
                <span id="vewd-title">Vewd</span>
                <span id="vewd-stats">0 images</span>
                <span id="vewd-tagged-stats">0 tagged</span>
                <button id="vewd-filter-btn">Show Tagged</button>
                <button id="vewd-close">✕</button>
            </div>
            <div id="vewd-main">
                <div id="vewd-grid-container">
                    <div id="vewd-grid"></div>
                </div>
                <div id="vewd-preview">
                    <div id="vewd-preview-images">
                        <div class="vewd-preview-pane" id="vewd-pane1"></div>
                        <div class="vewd-preview-pane" id="vewd-pane2"></div>
                    </div>
                </div>
            </div>
            <div id="vewd-help">
                ← → ↑ ↓ navigate • Space tag • T filter • S save • Del remove
            </div>
        `;

        const style = document.createElement("style");
        style.textContent = `
            #vewd-panel {
                position: fixed;
                top: 50px;
                left: 50px;
                width: 900px;
                height: 600px;
                background: #1a1a1a;
                border: 1px solid #333;
                border-radius: 8px;
                display: none;
                flex-direction: column;
                z-index: 10000;
                font-family: system-ui, sans-serif;
                box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            }
            #vewd-panel.open { display: flex; }

            #vewd-header {
                padding: 10px 15px;
                background: #222;
                border-bottom: 1px solid #333;
                display: flex;
                gap: 15px;
                align-items: center;
                border-radius: 8px 8px 0 0;
                cursor: move;
            }
            #vewd-title { color: #888; font-weight: 600; }
            #vewd-stats, #vewd-tagged-stats { color: #555; font-size: 12px; }
            #vewd-header button {
                background: #333;
                border: 1px solid #444;
                color: #888;
                padding: 4px 10px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            }
            #vewd-header button:hover { background: #444; color: #aaa; }
            #vewd-header button.active { background: #4a9eff; color: #fff; border-color: #4a9eff; }
            #vewd-close { margin-left: auto; }

            #vewd-main {
                flex: 1;
                display: flex;
                overflow: hidden;
            }

            #vewd-grid-container {
                width: 40%;
                overflow-y: auto;
                padding: 10px;
            }
            #vewd-grid-container::-webkit-scrollbar { width: 6px; }
            #vewd-grid-container::-webkit-scrollbar-track { background: #1a1a1a; }
            #vewd-grid-container::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }

            #vewd-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 6px;
            }

            .vewd-thumb {
                aspect-ratio: 1;
                background: #111;
                border: 2px solid transparent;
                border-radius: 4px;
                overflow: hidden;
                cursor: pointer;
                position: relative;
            }
            .vewd-thumb:hover { border-color: #444; }
            .vewd-thumb.focused { border-color: #666; }
            .vewd-thumb.selected { border-color: #4a9eff; }
            .vewd-thumb.tagged::after {
                content: "✓";
                position: absolute;
                top: 4px;
                right: 4px;
                background: #4a9eff;
                color: #fff;
                width: 16px;
                height: 16px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
            }
            .vewd-thumb.hidden { display: none; }
            .vewd-thumb img {
                width: 100%;
                height: 100%;
                object-fit: contain;
            }

            #vewd-preview {
                flex: 1;
                background: #111;
                border-left: 1px solid #333;
                display: flex;
                flex-direction: column;
            }
            #vewd-preview-images {
                flex: 1;
                display: flex;
            }
            .vewd-preview-pane {
                flex: 1;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 10px;
            }
            .vewd-preview-pane img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
            }
            .vewd-preview-pane + .vewd-preview-pane {
                border-left: 1px solid #333;
            }

            #vewd-help {
                padding: 8px 15px;
                background: #222;
                border-top: 1px solid #333;
                color: #444;
                font-size: 11px;
                border-radius: 0 0 8px 8px;
            }
        `;

        document.head.appendChild(style);
        document.body.appendChild(this.panel);

        // Make draggable
        this.makeDraggable();

        // Event listeners
        this.panel.querySelector("#vewd-close").onclick = () => this.close();
        this.panel.querySelector("#vewd-filter-btn").onclick = () => this.toggleFilter();

        // Keyboard
        document.addEventListener("keydown", (e) => this.handleKey(e));
    }

    makeDraggable() {
        const header = this.panel.querySelector("#vewd-header");
        let offsetX, offsetY;

        header.onmousedown = (e) => {
            if (e.target.tagName === "BUTTON") return;
            offsetX = e.clientX - this.panel.offsetLeft;
            offsetY = e.clientY - this.panel.offsetTop;

            const move = (e) => {
                this.panel.style.left = (e.clientX - offsetX) + "px";
                this.panel.style.top = (e.clientY - offsetY) + "px";
            };
            const up = () => {
                document.removeEventListener("mousemove", move);
                document.removeEventListener("mouseup", up);
            };
            document.addEventListener("mousemove", move);
            document.addEventListener("mouseup", up);
        };
    }

    open() {
        this.createPanel();
        this.panel.classList.add("open");
        this.isOpen = true;
        this.panel.focus();
    }

    close() {
        if (this.panel) {
            this.panel.classList.remove("open");
            this.isOpen = false;
        }
    }

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    }

    addImage(src, filename) {
        const index = this.images.length;
        const grid = this.panel.querySelector("#vewd-grid");

        const thumb = document.createElement("div");
        thumb.className = "vewd-thumb";
        thumb.dataset.index = index;

        const img = document.createElement("img");
        img.src = src;
        thumb.appendChild(img);
        grid.appendChild(thumb);

        this.images.push({ src, filename, element: thumb });

        thumb.onclick = (e) => this.handleClick(index, e);

        if (this.focusIndex === -1) {
            this.setFocus(0);
            this.selectedIndices.add(0);
        }

        this.updateUI();
    }

    handleClick(index, e) {
        if (e.ctrlKey || e.metaKey) {
            if (this.selectedIndices.has(index)) this.selectedIndices.delete(index);
            else this.selectedIndices.add(index);
        } else if (e.shiftKey && this.focusIndex !== -1) {
            const start = Math.min(this.focusIndex, index);
            const end = Math.max(this.focusIndex, index);
            this.selectedIndices.clear();
            for (let i = start; i <= end; i++) this.selectedIndices.add(i);
        } else {
            this.selectedIndices.clear();
            this.selectedIndices.add(index);
        }
        this.setFocus(index);
        this.updateUI();
    }

    setFocus(index) {
        if (index < 0 || index >= this.images.length) return;
        if (this.focusIndex >= 0 && this.images[this.focusIndex]) {
            this.images[this.focusIndex].element.classList.remove("focused");
        }
        this.focusIndex = index;
        this.images[index].element.classList.add("focused");
        this.images[index].element.scrollIntoView({ block: "nearest" });
    }

    updateUI() {
        let taggedCount = 0;
        this.images.forEach((img, i) => {
            img.element.classList.toggle("selected", this.selectedIndices.has(i));
            img.element.classList.toggle("tagged", this.taggedIndices.has(i));
            if (this.taggedIndices.has(i)) taggedCount++;
            img.element.classList.toggle("hidden", this.showOnlyTagged && !this.taggedIndices.has(i));
        });

        this.panel.querySelector("#vewd-stats").textContent = `${this.images.length} images`;
        this.panel.querySelector("#vewd-tagged-stats").textContent = `${taggedCount} tagged`;
        this.panel.querySelector("#vewd-filter-btn").classList.toggle("active", this.showOnlyTagged);
        this.panel.querySelector("#vewd-filter-btn").textContent = this.showOnlyTagged ? "Show All" : "Show Tagged";

        this.updatePreview();
    }

    updatePreview() {
        const selected = Array.from(this.selectedIndices).sort((a, b) => a - b);
        const pane1 = this.panel.querySelector("#vewd-pane1");
        const pane2 = this.panel.querySelector("#vewd-pane2");

        if (selected.length >= 2) {
            pane1.innerHTML = `<img src="${this.images[selected[0]].src}">`;
            pane2.innerHTML = `<img src="${this.images[selected[1]].src}">`;
            pane2.style.display = "flex";
        } else if (selected.length === 1) {
            pane1.innerHTML = `<img src="${this.images[selected[0]].src}">`;
            pane2.innerHTML = "";
            pane2.style.display = "none";
        } else {
            pane1.innerHTML = "";
            pane2.innerHTML = "";
        }
    }

    handleKey(e) {
        if (!this.isOpen || this.images.length === 0) return;

        const cols = 3;
        switch (e.key) {
            case "ArrowRight": e.preventDefault(); this.navigate(1, e); break;
            case "ArrowLeft": e.preventDefault(); this.navigate(-1, e); break;
            case "ArrowDown": e.preventDefault(); this.navigate(cols, e); break;
            case "ArrowUp": e.preventDefault(); this.navigate(-cols, e); break;
            case " ":
                e.preventDefault();
                if (this.taggedIndices.has(this.focusIndex)) this.taggedIndices.delete(this.focusIndex);
                else this.taggedIndices.add(this.focusIndex);
                this.updateUI();
                break;
            case "t":
                if (!e.ctrlKey) {
                    e.preventDefault();
                    this.toggleFilter();
                }
                break;
            case "Delete":
            case "Backspace":
                e.preventDefault();
                this.deleteSelected();
                break;
            case "Escape":
                e.preventDefault();
                this.close();
                break;
        }
    }

    navigate(delta, e) {
        let index = this.focusIndex + delta;
        index = Math.max(0, Math.min(this.images.length - 1, index));

        if (e.shiftKey) {
            this.selectedIndices.add(index);
        } else if (!e.ctrlKey) {
            this.selectedIndices.clear();
            this.selectedIndices.add(index);
        }
        this.setFocus(index);
        this.updateUI();
    }

    toggleFilter() {
        this.showOnlyTagged = !this.showOnlyTagged;
        this.updateUI();
    }

    deleteSelected() {
        const toDelete = Array.from(this.selectedIndices).sort((a, b) => b - a);
        toDelete.forEach(i => {
            this.images[i].element.remove();
            this.images.splice(i, 1);
            this.taggedIndices.delete(i);
        });
        // Reindex
        this.images.forEach((img, i) => img.element.dataset.index = i);
        this.selectedIndices.clear();
        if (this.images.length > 0) {
            this.focusIndex = Math.min(this.focusIndex, this.images.length - 1);
            this.setFocus(this.focusIndex);
            this.selectedIndices.add(this.focusIndex);
        }
        this.updateUI();
    }

    clear() {
        this.images = [];
        this.focusIndex = -1;
        this.selectedIndices.clear();
        this.taggedIndices.clear();
        if (this.panel) {
            this.panel.querySelector("#vewd-grid").innerHTML = "";
        }
        this.updateUI();
    }
}

// Global instance
const vewdViewer = new VewdViewer();

// Register extension
app.registerExtension({
    name: "vewd.viewer",

    async setup() {
        // Add menu button
        const menu = document.querySelector(".comfy-menu");
        if (menu) {
            const btn = document.createElement("button");
            btn.textContent = "Vewd";
            btn.onclick = () => vewdViewer.toggle();
            btn.style.cssText = "margin-top: 5px;";
            menu.appendChild(btn);
        }
    },

    async nodeCreated(node) {
        if (node.comfyClass === "Vewd") {
            // Hook into the node to capture images
            const origOnExecuted = node.onExecuted;
            node.onExecuted = function(output) {
                if (origOnExecuted) origOnExecuted.call(this, output);

                // Add images to viewer
                if (output && output.images) {
                    output.images.forEach(img => {
                        const src = `/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}`;
                        vewdViewer.addImage(src, img.filename);
                    });

                    // Auto-open viewer
                    if (!vewdViewer.isOpen) {
                        vewdViewer.open();
                    }
                }
            };
        }
    }
});

// Expose for debugging
window.vewdViewer = vewdViewer;
