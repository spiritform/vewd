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
    }

    .vewd-main {
        flex: 1;
        display: flex;
        overflow: hidden;
        min-height: 0;
    }

    .vewd-grid-area {
        width: 40%;
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
    .vewd-item:hover { border-color: #333; }
    .vewd-item.selected { border-color: #4a9eff; }
    .vewd-item.tagged::after {
        content: "✓";
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
        min-width: 0;
    }
    .vewd-preview-area.single .vewd-pane:nth-child(2) { display: none; }

    .vewd-pane {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
        min-width: 0;
    }
    .vewd-pane + .vewd-pane { border-left: 1px solid #222; }
    .vewd-pane img { max-width: 100%; max-height: 100%; object-fit: contain; }

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
        padding: 2px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 10px;
    }
    .vewd-bar button:hover { background: #333; color: #aaa; }
    .vewd-bar button.on { background: #4a9eff; color: #fff; }
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
            <div class="vewd-preview-area single">
                <div class="vewd-pane"></div>
                <div class="vewd-pane"></div>
            </div>
        </div>
        <div class="vewd-bar">
            <span class="count">0</span>
            <span class="tagged-count">0 tagged</span>
            <button class="filter-btn">Filter</button>
            <button class="clear-btn">Clear</button>
            <span style="margin-left:auto;color:#444">Space: tag • Arrows: nav</span>
        </div>
    `;

    const grid = el.querySelector(".vewd-grid");
    const previewArea = el.querySelector(".vewd-preview-area");
    const panes = el.querySelectorAll(".vewd-pane");
    const countEl = el.querySelector(".count");
    const taggedCountEl = el.querySelector(".tagged-count");
    const filterBtn = el.querySelector(".filter-btn");
    const clearBtn = el.querySelector(".clear-btn");

    function addImage(src, filename) {
        const i = state.images.length;
        const item = document.createElement("div");
        item.className = "vewd-item";
        item.innerHTML = `<img src="${src}">`;
        item.onclick = (e) => handleClick(i, e);
        grid.appendChild(item);
        state.images.push({ src, filename, el: item });

        if (state.focusIndex === -1) {
            state.focusIndex = 0;
            state.selected.add(0);
        }
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

        const sel = [...state.selected].sort((a, b) => a - b);
        if (sel.length >= 2) {
            previewArea.classList.remove("single");
            panes[0].innerHTML = `<img src="${state.images[sel[0]].src}">`;
            panes[1].innerHTML = `<img src="${state.images[sel[1]].src}">`;
        } else if (sel.length === 1) {
            previewArea.classList.add("single");
            panes[0].innerHTML = `<img src="${state.images[sel[0]].src}">`;
            panes[1].innerHTML = "";
        } else {
            panes[0].innerHTML = "";
            panes[1].innerHTML = "";
        }

        countEl.textContent = state.images.length;
        taggedCountEl.textContent = `${state.tagged.size} tagged`;
        filterBtn.classList.toggle("on", state.filterOn);
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

    el.onkeydown = (e) => {
        switch (e.key) {
            case "ArrowRight": e.preventDefault(); navigate(1); break;
            case "ArrowLeft": e.preventDefault(); navigate(-1); break;
            case "ArrowDown": e.preventDefault(); navigate(3); break;
            case "ArrowUp": e.preventDefault(); navigate(-3); break;
            case " ":
                e.preventDefault();
                if (state.focusIndex >= 0) {
                    state.tagged.has(state.focusIndex)
                        ? state.tagged.delete(state.focusIndex)
                        : state.tagged.add(state.focusIndex);
                    update();
                }
                break;
        }
    };

    filterBtn.onclick = () => { state.filterOn = !state.filterOn; update(); };
    clearBtn.onclick = () => {
        state.images.forEach(img => img.el.remove());
        state.images = [];
        state.focusIndex = -1;
        state.selected.clear();
        state.tagged.clear();
        update();
    };

    return { el, addImage, state };
}

// Register
app.registerExtension({
    name: "vewd",

    async nodeCreated(node) {
        if (node.comfyClass !== "Vewd") return;

        const widget = createVewdWidget(node);
        node.vewdWidget = widget;

        node.addDOMWidget("vewd_ui", "custom", widget.el, {
            serialize: false,
            hideOnZoom: false,
        });

        const orig = node.onExecuted;
        node.onExecuted = function(output) {
            if (orig) orig.call(this, output);
            if (output?.images) {
                output.images.forEach(img => {
                    const src = api.apiURL(`/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder || "")}&type=${img.type}&t=${Date.now()}`);
                    widget.addImage(src, img.filename);
                });
            }
        };

        node.setSize([400, 450]);
    }
});
