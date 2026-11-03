// =====================================================================
// SEMANTIC VERSIONING (SemVer 2.0.0)
// Single source of truth. Do not hard-code the version elsewhere.
// MAJOR: breaking change (e.g. changing bridge function names/signatures that Python depends on)
// MINOR: new backward-compatible feature (e.g. finishing a new topic's code)
// PATCH: bug fix or small tweak with no new feature
// Use 0.x.y while in development; move to 1.0.0 once all 11 topics are complete.
// =====================================================================
const APP_VERSION = "1.16.0";

// 100000 -> "100,000": big prices stay readable.
const fmt = (n) => Number(n).toLocaleString("en-US");
// Python lists arrive as proxies that die when the bridge call returns. Copy to plain JS
// before keeping them or reading them later (toJs converts nested lists too).
const toPlain = (x) => (x && typeof x.toJs === "function") ? x.toJs() : (x || []);

let pyodideInstance = null;
let gardenPlants = {};
// name -> emoji, filled by addPlantsToDropdown so tiles can draw each plant's own emoji.
let plantEmoji = {};

// ---- pixel art helpers (sprites and icons are drawn by pixel-art.js) ----
const HEART_TIER = { "\u2764": "RED", "\ud83e\udde1": "ORANGE", "\ud83d\udc9b": "YELLOW", "\ud83d\udc9a": "GREEN", "\ud83d\udc9c": "VIOLET", "\ud83d\udc97": "PINK", "\ud83e\udd0e": "BROWN" };
// Python still sends an emoji for every row; this turns it into a sprite or icon when we have one.
function symbol(emoji, name, size) {
  size = size || 32;
  if (PixelArt.PLANTS[name]) return PixelArt.img(name, "mature", size);
  const tier = HEART_TIER[[...String(emoji)][0]];
  if (tier) return PixelArt.icon("heart", size, PixelArt.TIERS[tier]);
  if (emoji === "\ud83d\udcd6") return PixelArt.icon("book", size);
  return emoji;
}
// ---- harvest mutations: Python decides who mutates and the multiplier; this only decides the look ----
const MUT_LOOK = {
  Dried:   { color: "#d08a3c", icon: "sun",    filter: "sepia(.75) saturate(.85) brightness(.88)" },
  Chilled: { color: "#7fc4ff", icon: "ice",    filter: "hue-rotate(185deg) saturate(.85) brightness(1.1)" },
  Frosted: { color: "#dbe9ff", icon: "flake",  filter: "grayscale(.4) brightness(1.3) hue-rotate(170deg)" },
  Bumper:  { color: "#8a94a8", icon: "basket", filter: "saturate(.8) contrast(1.1)" },
  Dewy:    { color: "#4a9be0", icon: "drop",   filter: "saturate(1.35) brightness(1.1) drop-shadow(0 0 2px #7fd4ff)" },
  Gilded:  { color: "#f4c93c", icon: "coin",   filter: "sepia(.55) saturate(2.2) brightness(1.15)" },
  Festive: { color: "#ff7fae", icon: "party",  filter: "saturate(1.7) hue-rotate(-20deg)" },
  Lucky:   { color: "#79c63e", icon: "clover", filter: "brightness(1.15) drop-shadow(0 0 2px #79c63e)" },
};
const mutLook = (m) => MUT_LOOK[m] || { color: "#f4c93c", icon: "coin", filter: "none" };
// Inventory and Market rows are keyed "Tomato" or "Tomato::Dried" (a mutated stack of its own).
function keyLabel(key) {
  const [name, mutation] = String(key).split("::");
  return mutation ? `${mutation} ${name}` : name;
}
// A plant sprite, tinted for its mutation.
function mutSprite(emoji, plantName, mutation, size) {
  const html = symbol(emoji, plantName, size);
  return mutation ? `<span class="mut-sprite" style="filter:${mutLook(mutation).filter}">${html}</span>` : html;
}
const mutBadge = (m) => `<span class="mut-badge">${PixelArt.icon(mutLook(m).icon, 16, mutLook(m).color)}</span>`;
function hydratePixelIcons() {
  document.querySelectorAll("[data-px]").forEach(el => { el.innerHTML = PixelArt.icon(el.dataset.px, Number(el.dataset.s) || 16); });
}
// The boot screen shows a tomato growing while Python loads.
function startBootAnimation() {
  const el = document.getElementById("boot-spinner");
  let stage = 0;
  const draw = () => { if (!el.classList.contains("hidden")) el.innerHTML = PixelArt.img("Tomato", stage++ % 4, 64); };
  draw();
  setInterval(draw, 450);
}

// Display-only list of action labels (populated by Python via pushAction). No JS game logic.
let displayActionHistory = [];

// =====================================================================
// TOPIC TEMPLATES — titles live here; the Python for each topic lives in
// garden-topics.py (one file, split by "# ===== TOPIC n =====" markers) and is
// loaded into the `code` fields by loadTopicCode() on startup.
// Call the bridge functions from your Python to update the UI.
// =====================================================================
const TOPICS_PY_URL = "garden-topics.py";
let topicLoadError = ""; // shown in the editor if the fetch fails (the output console gets overwritten by initPyodide)

// True while Python is loading or running topics, so two runs can never overlap.
let pythonBusy = false;

const topicTemplates = {
  1: { title: "Python OOP + Big O + Stacks", code: "" },
  2: { title: "Queues & Deques (FIFO Elements)", code: "" },
  3: { title: "Static/Dynamic Arrays, 2D Lists, & Memory Structures", code: "" },
  4: { title: "Hierarchical Trees & Traversals", code: "" },
  5: { title: "Binary Search Trees (BST) & Node Mutation", code: "" },
  6: { title: "Hash Tables, Collisions, & Rehashing", code: "" },
  7: { title: "Graph Foundations, Adjacency Matrices/Lists, & DFS/BFS", code: "" },
  8: { title: "Sorting Algorithms (Bubble, Insertion, Selection, Quick, & Merge Sort)", code: "" },
  9: { title: "Searching Algorithms (Linear Search vs. Binary Search)", code: "" },
  10: { title: "Advanced Strategic Paradigms (Dijkstra's Algorithm & Greedy Patterns)", code: "" },
  11: { title: "Dynamic Programming (DP), Memoization, & Divide-and-Conquer", code: "" }
};

// Fetches garden-topics.py and fills topicTemplates[n].code for each topic.
async function loadTopicCode() {
  const response = await fetch(TOPICS_PY_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${TOPICS_PY_URL} (HTTP ${response.status})`);
  const text = (await response.text()).replace(/\r\n/g, "\n");

  // split() with a capture group returns [preamble, "1", code1, "2", code2, ...]
  const parts = text.split(/^# ={5,} TOPIC (\d+) ={5,}\n/m);
  for (let i = 1; i < parts.length; i += 2) {
    const key = Number(parts[i]);
    if (topicTemplates[key]) topicTemplates[key].code = parts[i + 1].trim() + "\n";
  }
}

async function initPyodide() {
  if (pyodideInstance) return;
  const consoleEl = document.getElementById("output-console");
  if (consoleEl) {
    consoleEl.innerHTML = `<span class="text-amber-400">Loading Python...</span><br>`;
  }
  try {
    pyodideInstance = await loadPyodide();

    // Bridge functions Python may call (pure display — no game rules)
    pyodideInstance.globals.set("addPlantToGrid", addPlantToGrid);
    pyodideInstance.globals.set("updateResources", updateResources);
    pyodideInstance.globals.set("addPlantsToDropdown", addPlantsToDropdown);
    pyodideInstance.globals.set("pushAction", pushAction);
    pyodideInstance.globals.set("updateClimateQueue", updateClimateQueue);
    pyodideInstance.globals.set("renderPlantBook", renderPlantBook);
    pyodideInstance.globals.set("highlightPlantPath", highlightPlantPath);
    pyodideInstance.globals.set("updateScreenEffects", updateScreenEffects);
    pyodideInstance.globals.set("updateNightShop", updateNightShop);
    pyodideInstance.globals.set("showGameOver", showGameOver);
    pyodideInstance.globals.set("updatePredator", updatePredator);
    pyodideInstance.globals.set("updateTriage", updateTriage);
    pyodideInstance.globals.set("updateRadar", updateRadar);
    pyodideInstance.globals.set("updateRegistry", updateRegistry);
    pyodideInstance.globals.set("updateRaid", updateRaid);
    pyodideInstance.globals.set("renderTraversalCompare", renderTraversalCompare);
    pyodideInstance.globals.set("updateStamina", updateStamina);
    pyodideInstance.globals.set("updateDay", updateDay);
    pyodideInstance.globals.set("updateInventory", updateInventory);
    pyodideInstance.globals.set("updateMarket", updateMarket);
    pyodideInstance.globals.set("updateShop", updateShop);

    await pyodideInstance.runPythonAsync(`
import sys
from js import document

class Console:
    def write(self, text):
        if text and text.strip():
            el = document.getElementById("output-console")
            if el:
                el.innerHTML += text.replace("\\n", "<br>")
    def flush(self):
        pass

sys.stdout = Console()
`);

    if (consoleEl) {
      consoleEl.innerHTML = `<span class="text-emerald-400">Python ready.</span><br>`;
    }
  } catch (err) {
    if (consoleEl) {
      consoleEl.innerHTML = `<span class="text-red-400">Failed to load Python: ${err.message}</span>`;
    }
    throw err;
  }
}

// ---- Pure display bridges (called from Python) ----

// updateClimateQueue(events: list of strings)
// Renders the FIFO climate events. Pass an empty list to clear.
function updateClimateQueue(events) {
  const container = document.getElementById("climate-queue");
  container.innerHTML = "";
  if (!events || !events.length) return;
  events.forEach(event => {
    const div = document.createElement("div");
    div.className = "p-3 bg-amber-950/40 border border-amber-900 rounded-xl text-xs";
    div.innerHTML = `
      <div class="font-bold text-amber-400">${event}</div>
      <div class="text-emerald-300/80"> </div>
    `;
    container.appendChild(div);
  });
}

// addPlantToGrid(pos: int 0-24, name: str)
// Marks a grid cell as planted (display only).
// addPlantToGrid(pos: int 0-24, name: str, stage: "seed"|"sprout"|"mature")
// name === "" clears the tile regardless of stage.
function addPlantToGrid(pos, name, stage) {
  if (!name) {
    delete gardenPlants[pos];
  } else {
    gardenPlants[pos] = { name, stage: stage || "mature" };
  }
  renderGarden();
}

// The Shadow Hound (Topic 10). Python sends what to show; the route is a list of tiles, hound first.
const PREDATOR_STEPS = 5;   // tiles the hound walks per night (matches Python), used to number the route
let predatorView = { present: false, revealed: false, pos: -1, route: [] };
function updatePredator(present, revealed, pos, route, targetName, eta) {
  predatorView = { present, revealed, pos, route: toPlain(route) };
  const status = document.getElementById("predator-status");
  status.classList.toggle("hidden", !present);
  if (present && !revealed) {
    status.textContent = "A Shadow Hound prowls your garden. A Scout's Lens shows where it is heading.";
  } else if (present && predatorView.route.length) {
    status.textContent = `The Shadow Hound (row ${Math.floor(pos / 10) + 1}, column ${pos % 10 + 1}) is heading for your ${targetName}, ` +
      `${eta} night${eta === 1 ? "" : "s"} away. The numbers show the night it passes each tile.`;
  } else if (present) {
    status.textContent = "The Shadow Hound can't reach any plant right now.";
  }
  renderGarden();
}

// Each tile draws a code-made sprite for the plant's stage (see pixel-art.js).
function renderGarden() {
  const grid = document.getElementById("garden-grid");
  grid.innerHTML = "";
  for (let i = 0; i < 100; i++) {
    const cell = document.createElement("div");
    const entry = gardenPlants[i];
    cell.className = "tile aspect-square flex items-center justify-center cursor-pointer select-none" + (entry ? " planted" : "");
    if (entry && (entry.stage === "ward" || entry.stage === "barrier")) {
      // Night Defense looks (Topic 7): a Ward, or blighted ground, or a plant the blight has transformed
      cell.className += " ward" + (entry.stage === "barrier" ? " barrier" : "");
      cell.innerHTML = PixelArt.wardImg(entry.stage === "barrier", 64);
      cell.title = entry.stage === "barrier" ? "Ward - part of a barrier, blight cannot cross" : "Ward - link 3 to form a barrier";
    } else if (entry && entry.stage === "blight") {
      cell.className += " blight";
      cell.innerHTML = PixelArt.blightImg(4, 64);
      cell.title = "Blight - only Cleansing Spray can clear it";
    } else if (entry && String(entry.stage).startsWith("infected-")) {
      cell.className += " blight infected";
      cell.innerHTML = PixelArt.blightImg(PixelArt.blightForStage(entry.stage.slice(9)), 64);
      cell.title = `Infected ${entry.name} - only Cleansing Spray can save it`;
    } else if (entry) {
      cell.innerHTML = PixelArt.PLANTS[entry.name] ? PixelArt.img(entry.name, entry.stage, 64) : (plantEmoji[entry.name] || "\ud83c\udf31");
      cell.title = `${entry.name} (${entry.stage})`;
    }
    // Shadow Hound overlay (Topic 10): only drawn while a Scout's Lens is active
    if (predatorView.revealed && predatorView.route.length) {
      const step = predatorView.route.indexOf(i);
      if (step > 0) cell.insertAdjacentHTML("beforeend", `<span class="route-dot">${Math.ceil(step / PREDATOR_STEPS)}</span>`);
      if (step === predatorView.route.length - 1) cell.classList.add("route-target");
    }
    if (predatorView.revealed && i === predatorView.pos) {
      cell.insertAdjacentHTML("beforeend", `<span class="hound-sprite">${PixelArt.houndImg(64)}</span>`);
    }
    // 10 tiles per row: flat position i  <->  (row, col)
    cell.addEventListener("click", () => handleTileClick(Math.floor(i / 10), i % 10));
    grid.appendChild(cell);
  }
}

// Which tool is active: "plant" | "water" | "harvest" | "shovel" | "ward" | "spray"
let selectedTool = "plant";

function selectTool(tool) {
  selectedTool = tool;
  ["plant", "water", "harvest", "shovel", "ward", "spray", "radar"].forEach(name => {
    const button = document.getElementById("tool-" + name);
    button.classList.toggle("bg-[#6b4423]", name === tool);
    button.classList.toggle("text-emerald-100", name === tool);
    button.classList.toggle("text-emerald-400/80", name !== tool);
  });
}

// Tile click: forwards (row, col, selected tool, selected seed) to Python's
// handle_tile_click. JS stays display-only; Python owns the rules and returns
// a message to show (or None).
function handleTileClick(row, col) {
  const entry = gardenPlants[row * 10 + col];
  const blighted = entry && (entry.stage === "blight" || String(entry.stage).startsWith("infected-"));
  if (blighted) { runTileClick(row, col); return; }      // Python explains that only Spray works here
  if (entry && selectedTool === "shovel") {
    confirmAction("shovel", `Remove ${entry.name}?`,
      `The ${entry.name} at row ${row + 1}, column ${col + 1} is removed for good. Nothing is refunded.`,
      () => runTileClick(row, col), true);
    return;
  }
  if (entry && selectedTool === "harvest" && entry.stage === "mature") {
    confirmAction("harvest", `Harvest ${entry.name}?`,
      `It moves to your Inventory and the tile becomes empty.`,
      () => runTileClick(row, col), true);
    return;
  }
  runTileClick(row, col);
}

function runTileClick(row, col) {
  playerAct(row, col, selectedTool);
  const hook = pyodideInstance ? pyodideInstance.globals.get("handle_tile_click") : null;
  if (!hook) { showToast(notReadyMessage()); return; }
  const plantName = document.getElementById("crop-selector").value;
  try {
    const msg = hook(row, col, selectedTool, plantName);
    if (msg) showToast(msg);
  } catch (err) {
    showToast("Python error: " + err.message.trim().split("\n").pop());
  } finally {
    hook.destroy();
  }
}

// Generic caller for a zero/one-argument Python bridge hook, used by End Day and Sell.
function callPythonAction(pyFunctionName, ...args) {
  const hook = pyodideInstance ? pyodideInstance.globals.get(pyFunctionName) : null;
  if (!hook) { showToast(notReadyMessage()); return; }
  try {
    const msg = hook(...args);
    if (msg) showToast(msg);
  } catch (err) {
    showToast("Python error: " + err.message.trim().split("\n").pop());
  } finally {
    hook.destroy();
  }
}

let currentDay = 1;

function endDay() {
  confirmAction("endday", `End Day ${currentDay}?`,
    "Plants grow, climate events roll, and everything in the Market sells. Anything you haven't done today is left undone.",
    () => playNightSequence(), false);
}

function sellToMarket(key, qty) {
  const label = keyLabel(key);
  confirmAction("sell", `Move ${label} to the Market?`,
    `${qty ? "All " + fmt(qty) + " " : "All "}${label} go to the Market and sell when the day ends.`,
    () => callPythonAction("sell_to_market_action", key), true);
}

function removeFromInventory(key, qty) {
  const label = keyLabel(key);
  confirmAction("remove", `Remove ${label}?`,
    `All ${fmt(qty)} ${label} are discarded from your Inventory. Nothing is refunded.`,
    () => callPythonAction("remove_from_inventory_action", key), false);
}

// ---- confirmation box for crucial actions (display only; Python still owns the rules) ----
// canSkip: show the "Don't ask again this session" tick (kept off for End Day and Remove).
const confirmSkipped = {};
let confirmYes = null;
function confirmAction(key, title, text, onYes, canSkip) {
  if (confirmSkipped[key]) { onYes(); return; }
  confirmYes = () => {
    if (canSkip && document.getElementById("confirm-skip").checked) confirmSkipped[key] = true;
    onYes();
  };
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-text").textContent = text;
  document.getElementById("confirm-skip").checked = false;
  document.getElementById("confirm-skip-row").classList.toggle("hidden", !canSkip);
  document.getElementById("confirm-modal").classList.remove("hidden");
  document.getElementById("confirm-cancel").focus();
}
function closeConfirm() {
  document.getElementById("confirm-modal").classList.add("hidden");
  confirmYes = null;
}
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("confirm-cancel").addEventListener("click", closeConfirm);
  document.getElementById("confirm-ok").addEventListener("click", () => { const go = confirmYes; closeConfirm(); if (go) go(); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && confirmYes) closeConfirm();
  });
});

// updateResources(water, energy, hope, coins)
// Or pass a single object: updateResources({"water": n, "coins": n, ...})
// No fallbacks that turn a valid 0 into a default. Caps used only for bar width.
// Energy and Hope still arrive here (Python keeps tracking them for later use;
// see changes.md) but are no longer drawn - only Water and Coins are shown.
// (Seeds are not a resource any more: they are owned per plant, see the Seed Bag.)
function updateResources(water, energy, hope, coins) {
  if (typeof water === "object" && water !== null) {
    const args = water;
    water = args.water !== undefined ? args.water : 0;
    coins = args.coins !== undefined ? args.coins : 0;
  } else {
    water = water !== undefined ? water : 0;
    coins = coins !== undefined ? coins : 0;
  }

  const waterMax = 200;

  document.getElementById("water-text").innerText = `${water} / ${waterMax} L`;
  document.getElementById("water-bar").style.width = `${Math.min(100, (water / waterMax) * 100)}%`;

  document.getElementById("coins-text").innerText = `${fmt(coins)} Coins`;
}

// addPlantsToDropdown(plants: list of [name, emoji, owned])
// The Seed Bag: the seeds you own, with how many. Rebuilding it keeps your current pick.
function addPlantsToDropdown(plants) {
  const select = document.getElementById("crop-selector");
  const previous = select.value;
  select.innerHTML = "";
  if (!plants || plants.length === 0) {
    const empty = document.createElement("option");
    empty.value = "";
    empty.disabled = true;
    empty.textContent = "No seeds - visit Marco";
    select.appendChild(empty);
    select.value = "";
    renderSeedTray([]);
    return;
  }
  plants.forEach(([name, emoji, owned]) => {
    const option = document.createElement("option");
    plantEmoji[name] = emoji;
    option.value = name;
    option.textContent = `${emoji} ${name} \u00d7${fmt(owned)}`;
    select.appendChild(option);
  });
  if (previous && plants.some(([name]) => name === previous)) select.value = previous;
  renderSeedTray(plants);
}

// The Seed Bag as a tray of sprite buttons. The hidden <select> still holds the pick, so Python-facing code is unchanged.
function renderSeedTray(plants) {
  const select = document.getElementById("crop-selector");
  const tray = document.getElementById("seed-tray");
  tray.innerHTML = "";
  if (!plants || plants.length === 0) {
    tray.innerHTML = '<span class="text-xs text-amber-300/90 pt-2">No seeds - visit Marco</span>';
    return;
  }
  plants.forEach(([name, emoji, owned]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "seed-btn" + (select.value === name ? " selected" : "");
    button.title = `${name} \u00d7${fmt(owned)}`;
    button.innerHTML = symbol(emoji, name, 32) + `<span class="cnt">${fmt(owned)}</span>`;
    button.addEventListener("click", () => { select.value = name; renderSeedTray(plants); });
    tray.appendChild(button);
  });
}

// renderPlantBook(rows, unlockedCount, totalCount)
// rows: list of [depth, emoji, name, unlocked, note], already in preorder
// (each parent comes right before its children). depth sets the indentation.
function renderPlantBook(rows, unlockedCount, totalCount) {
  document.getElementById("plant-book-empty").classList.add("hidden");
  document.getElementById("plant-book-count").textContent = `${unlockedCount} / ${totalCount} unlocked`;
  drawPlantTree(toPlain(rows));
}

// =====================================================================
// PLANT BOOK AS A TREE (display only)
// Python sends the tree as rows in preorder: [depth, emoji, name, unlocked, note].
// The root ("Plant Book") is implicit. This code rebuilds the parent/child links
// from the depths, lays the tree out left to right, and draws nodes and lines.
// Python does the searching (PlantBook.search) and calls highlightPlantPath.
// =====================================================================
const PT = { nodeW: 168, nodeH: 44, colW: 196, rowH: 54, pad: 8 };
let plantTreeNodes = {};      // name -> { info, el, line }
let plantTreeSelected = null; // name of the clicked node
let plantTreeRun = 0;         // bumps on every search, so an old animation stops itself

function drawPlantTree(rows) {
  const box = document.getElementById("plant-tree");
  const root = { name: "Plant Book", emoji: "\ud83d\udcd6", unlocked: true, note: "The root of the tree: every plant family grows from here.", depth: -1, tier: null, children: [] };
  const open = [root];
  rows.forEach(([depth, emoji, name, unlocked, note]) => {
    const tier = HEART_TIER[[...String(emoji)][0]] || null;
    while (open[open.length - 1].depth >= depth) open.pop();
    const parent = open[open.length - 1];
    const node = { name, emoji, unlocked, note, depth, isTier: !!tier, tier: tier || parent.tier, children: [] };
    parent.children.push(node);
    open.push(node);
  });

  // layout: a leaf takes the next row; a parent sits halfway between its first and last child
  let leaves = 0, deepest = 0;
  (function place(node) {
    node.x = PT.pad + (node.depth + 1) * PT.colW;
    deepest = Math.max(deepest, node.depth + 1);
    if (node.children.length === 0) { node.y = PT.pad + leaves++ * PT.rowH; return; }
    node.children.forEach(place);
    node.y = (node.children[0].y + node.children[node.children.length - 1].y) / 2;
  })(root);
  const width = PT.pad * 2 + deepest * PT.colW + PT.nodeW;
  const height = PT.pad * 2 + Math.max(0, leaves - 1) * PT.rowH + PT.nodeH;

  // lines first (behind), one elbow per child: parent's right edge -> child's left edge
  const paths = [];
  (function link(node) {
    node.children.forEach(child => {
      const px = node.x + PT.nodeW, py = node.y + PT.nodeH / 2;
      const cx = child.x, cy = child.y + PT.nodeH / 2, mx = px + (cx - px) / 2;
      paths.push(`<path data-name="${child.name.replace(/"/g, "&quot;")}" d="M${px} ${py}H${mx}V${cy}H${cx}"/>`);
      link(child);
    });
  })(root);
  box.style.width = width + "px";
  box.style.height = height + "px";
  box.innerHTML = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${paths.join("")}</svg>`;

  plantTreeNodes = {};
  const lines = {};
  box.querySelectorAll("path").forEach(p => { lines[p.dataset.name] = p; });
  (function draw(node) {
    const el = document.createElement("div");
    el.className = "pt-node" + (node.isTier ? " pt-tier" : "") + (node.unlocked ? "" : " pt-locked");
    el.style.cssText = `left:${node.x}px;top:${node.y}px;width:${PT.nodeW}px;height:${PT.nodeH}px;--tc:${node.tier ? PixelArt.TIERS[node.tier] : "#f4e8c8"}`;
    el.tabIndex = 0;
    el.title = `${node.name}: ${node.note}`;
    const sub = node.isTier ? `<span class="pt-sub">${String(node.note).split(" ")[0]}</span>` : "";
    el.innerHTML = `<span class="shrink-0">${symbol(node.emoji, node.name, 32)}</span>` +
      `<span class="pt-name">${node.name}${sub}</span>` +
      (node.unlocked || node === root ? "" : `<span class="shrink-0">${PixelArt.icon("lock", 16)}</span>`);
    el.addEventListener("click", () => selectPlantTreeNode(node.name));
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectPlantTreeNode(node.name); } });
    box.appendChild(el);
    plantTreeNodes[node.name] = { info: node, el, line: lines[node.name] || null };
    node.children.forEach(draw);
  })(root);

  if (!plantTreeNodes[plantTreeSelected]) plantTreeSelected = null;
  ++plantTreeRun;
  document.getElementById("plant-tree-status").textContent = "";
  renderPlantTreeDetail();
}

function selectPlantTreeNode(name) {
  plantTreeSelected = name;
  renderPlantTreeDetail();
}

function renderPlantTreeDetail() {
  const detail = document.getElementById("plant-tree-detail");
  Object.entries(plantTreeNodes).forEach(([name, n]) => n.el.classList.toggle("selected", name === plantTreeSelected));
  const picked = plantTreeNodes[plantTreeSelected];
  if (!picked) {
    detail.innerHTML = '<span class="text-xs text-emerald-300/80">Click a node to see how to unlock it.</span>';
    return;
  }
  const n = picked.info;
  detail.innerHTML = `
    <span class="shrink-0">${symbol(n.emoji, n.name, 48)}</span>
    <div class="flex-1">
      <div class="text-sm font-bold text-white">${n.name}</div>
      <div class="text-xs text-emerald-300/80">${n.note}</div>
    </div>
    <span class="text-[10px] font-bold uppercase tracking-widest ${n.unlocked ? "text-emerald-400" : "text-amber-400/80"}">${n.unlocked ? "\u2713 Unlocked" : PixelArt.icon("lock", 16) + " Locked"}</span>
  `;
}

function plantTreeSearch() {
  const hook = pyodideInstance ? pyodideInstance.globals.get("plant_book_search_action") : null;
  if (!hook) { showToast(notReadyMessage()); return; }
  try {
    hook(document.getElementById("plant-tree-search").value, document.getElementById("plant-tree-mode").value);
  } catch (err) {
    showToast("Python error: " + err.message.trim().split("\n").pop());
  } finally {
    hook.destroy();
  }
}

function clearPlantTreeHighlight() {
  Object.values(plantTreeNodes).forEach(n => {
    n.el.classList.remove("visited", "onpath", "found");
    if (n.line) n.line.classList.remove("visited", "onpath");
  });
}

function clearPlantTreeSearch() {
  ++plantTreeRun;
  document.getElementById("plant-tree-search").value = "";
  document.getElementById("plant-tree-status").textContent = "";
  clearPlantTreeHighlight();
}

// highlightPlantPath(visited, path, found, message)
// visited: names in the order the search walked them; path: root -> match (empty if none).
// Replays the walk one node at a time, then lights the path to the match.
function highlightPlantPath(visited, path, found, message) {
  const run = ++plantTreeRun;
  visited = toPlain(visited);
  path = toPlain(path);
  clearPlantTreeHighlight();
  const status = document.getElementById("plant-tree-status");
  status.textContent = message || "";
  if (!visited.length) return;
  const reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const mark = (name, cls) => {
    const n = plantTreeNodes[name];
    if (!n) return;
    n.el.classList.add(cls);
    if (n.line && cls !== "found") n.line.classList.add(cls);
  };
  const finish = () => {
    path.forEach(name => mark(name, "onpath"));
    if (found && path.length) {
      const last = path[path.length - 1];
      mark(last, "found");
      const n = plantTreeNodes[last];
      if (n && n.el.scrollIntoView) n.el.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
    }
    status.textContent = message || "";
  };
  if (reduceMotion) { visited.forEach(name => mark(name, "visited")); finish(); return; }
  let i = 0;
  const tick = () => {
    if (run !== plantTreeRun) return;      // a newer search or Clear took over
    if (i < visited.length) {
      mark(visited[i], "visited");
      status.textContent = `Walking the tree... visited ${i + 1}`;
      i++;
      setTimeout(tick, 70);
    } else {
      finish();
    }
  };
  tick();
}

// =====================================================================
// TRAVERSAL COMPARE (demo only - display only, no game logic)
// Python (PlantBook.traversal_orders) does the traversals; this only draws them.
// =====================================================================
const TRAVERSAL_PANELS = [
  { key: "bfs",       short: "BFS",  title: "BFS · Level-order", hint: "Level by level · Queue",  accent: "text-sky-300" },
  { key: "preorder",  short: "Pre",  title: "DFS · Pre-order",   hint: "Node → children",         accent: "text-emerald-300" },
  { key: "inorder",   short: "In",   title: "DFS · In-order",    hint: "1st child → node → rest", accent: "text-emerald-300" },
  { key: "postorder", short: "Post", title: "DFS · Post-order",  hint: "Children → node",         accent: "text-emerald-300" }
];
const DEPTH_COLORS = ["#fbbf24", "#34d399", "#38bdf8", "#c084fc", "#fb7185", "#a3e635", "#f472b6"];

let plantBookMode = "book";   // "book" | "compare"
let traversalData = null;     // { bfs, preorder, inorder, postorder }: lists of [depth, emoji, name, unlocked, isPlant]
let traversalCells = [];      // traversalCells[panel][i] -> the row element for that panel's i-th visited node
let traversalStep = 0;        // how many nodes each traversal has visited so far
let traversalTimer = null;

// renderTraversalCompare(bfs, preorder, inorder, postorder)
// Each argument: list of [depth, emoji, name, unlocked, isPlant], already in visit order.
function renderTraversalCompare(bfs, preorder, inorder, postorder) {
  // Python proxies die when this call returns, and the animation needs the data later: copy to plain JS.
  const copy = rows => (rows && typeof rows.toJs === "function") ? rows.toJs() : rows;
  const next = { bfs: copy(bfs), preorder: copy(preorder), inorder: copy(inorder), postorder: copy(postorder) };
  const total = next.bfs.length;
  const wasComplete = !traversalData || traversalStep >= traversalData.bfs.length;
  traversalData = next;
  traversalStep = wasComplete ? total : Math.min(traversalStep, total);   // keep your place if the book re-renders mid-play
  document.getElementById("traversal-empty").classList.add("hidden");
  document.getElementById("traversal-body").classList.remove("hidden");
  buildTraversalGrid();
  applyTraversalStep();
}

function buildTraversalGrid() {
  const grid = document.getElementById("traversal-grid");
  grid.innerHTML = "";
  traversalCells = [];
  let maxDepth = 0;

  TRAVERSAL_PANELS.forEach(panel => {
    const col = document.createElement("div");
    col.className = "min-w-0";

    const head = document.createElement("div");
    head.className = "tv-head sticky top-0 z-10 h-11 px-2 py-1 mb-1 rounded-lg bg-[#24160c] border border-emerald-800/60";
    const title = document.createElement("div");
    title.className = "text-[11px] font-extrabold truncate " + panel.accent;
    title.textContent = panel.title;
    const hint = document.createElement("div");
    hint.className = "text-[10px] text-emerald-300/70 truncate";
    hint.textContent = panel.hint;
    head.title = `${panel.title}: ${panel.hint}`;
    head.appendChild(title);
    head.appendChild(hint);
    col.appendChild(head);

    const cells = [];
    traversalData[panel.key].forEach(([depth, emoji, name, unlocked, isPlant], i) => {
      maxDepth = Math.max(maxDepth, depth);
      const row = document.createElement("div");
      row.className = "tv-row unvisited flex items-center gap-1 h-7 px-1.5 mb-1 rounded-md border text-[11px] " +
        (isPlant ? "bg-[#1f130a] border-emerald-900 text-emerald-50" : "bg-[#4a3019] border-emerald-700 font-bold text-white");
      row.dataset.key = name;
      row.title = `#${i + 1} ${name} (depth ${depth}${unlocked ? "" : ", locked"})`;
      row.style.borderLeftWidth = "4px";
      row.style.borderLeftColor = DEPTH_COLORS[depth % DEPTH_COLORS.length];

      const num = document.createElement("span");
      num.className = "tv-num w-5 shrink-0 text-right text-[10px] font-bold tabular-nums text-amber-300";
      num.textContent = i + 1;
      const icon = document.createElement("span");
      icon.className = "shrink-0 leading-none" + (unlocked ? "" : " grayscale");
      icon.innerHTML = symbol(emoji, name, 16);
      const label = document.createElement("span");
      label.className = "truncate min-w-0" + (unlocked ? "" : " text-emerald-200/60");
      label.textContent = name;

      row.appendChild(num);
      row.appendChild(icon);
      row.appendChild(label);
      col.appendChild(row);
      cells.push(row);
    });
    traversalCells.push(cells);
    grid.appendChild(col);
  });

  // Legend: the left stripe on every row is its depth in the tree.
  const legend = document.getElementById("traversal-legend");
  legend.innerHTML = "<span>Left stripe = depth:</span>";
  for (let d = 0; d <= maxDepth; d++) {
    const item = document.createElement("span");
    item.className = "flex items-center gap-1";
    const swatch = document.createElement("span");
    swatch.className = "inline-block w-2.5 h-2.5 rounded-sm";
    swatch.style.backgroundColor = DEPTH_COLORS[d % DEPTH_COLORS.length];
    item.appendChild(swatch);
    item.appendChild(document.createTextNode(d === 0 ? "root" : `level ${d}`));
    legend.appendChild(item);
  }

  // Hover any node to light it up in all four lists.
  grid.onmouseover = e => highlightLinked(e.target.closest(".tv-row"));
  grid.onmouseout = () => highlightLinked(null);
}

function highlightLinked(row) {
  const key = row ? row.dataset.key : null;
  traversalCells.forEach(cells => cells.forEach(r => r.classList.toggle("linked", key !== null && r.dataset.key === key)));
}

function applyTraversalStep() {
  if (!traversalData) return;
  const total = traversalData.bfs.length;
  traversalCells.forEach(cells => cells.forEach((row, i) => {
    row.classList.toggle("unvisited", i >= traversalStep);
    row.classList.toggle("current", traversalStep > 0 && traversalStep < total && i === traversalStep - 1);
  }));

  document.getElementById("traversal-step-label").textContent = `Visited ${traversalStep} / ${total}`;
  const slider = document.getElementById("traversal-slider");
  slider.max = total;
  slider.value = traversalStep;

  const now = document.getElementById("traversal-now");
  if (traversalStep === 0) {
    now.textContent = "Nothing visited yet. Press Play or Step.";
  } else if (traversalStep >= total) {
    now.textContent = `All ${total} nodes visited: same tree, four different orders.`;
  } else {
    now.textContent = `Step ${traversalStep}: ` +
      TRAVERSAL_PANELS.map(p => `${p.short} → ${traversalData[p.key][traversalStep - 1][2]}`).join("  ·  ");
  }
  scrollTraversalIntoView();
}

// Rows have a fixed height, so row i lines up across all four lists: scroll them together.
function scrollTraversalIntoView() {
  const total = traversalData.bfs.length;
  if (traversalStep < 1 || traversalStep >= total) return;
  const wrap = document.getElementById("traversal-scroll");
  const row = traversalCells[0][traversalStep - 1];
  const head = wrap.querySelector(".tv-head");
  const headH = head ? head.offsetHeight : 0;
  const top = row.offsetTop, bottom = top + row.offsetHeight;
  if (top < wrap.scrollTop + headH) wrap.scrollTop = Math.max(0, top - headH - 4);
  else if (bottom > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = bottom - wrap.clientHeight + 4;
}

function toggleTraversalPlay() {
  if (traversalTimer) { pauseTraversal(); return; }
  if (!traversalData) return;
  if (traversalStep >= traversalData.bfs.length) traversalStep = 0;   // finished? replay from the start
  applyTraversalStep();
  startTraversalTimer();
}

function startTraversalTimer() {
  const delay = Number(document.getElementById("traversal-speed").value);
  traversalTimer = setInterval(() => {
    stepTraversal(true);
    if (traversalStep >= traversalData.bfs.length) pauseTraversal();
  }, delay);
  document.getElementById("traversal-play").textContent = "⏸ Pause";
}

function pauseTraversal() {
  if (traversalTimer) clearInterval(traversalTimer);
  traversalTimer = null;
  const button = document.getElementById("traversal-play");
  if (button) button.textContent = "▶ Play";
}

function changeTraversalSpeed() {
  if (!traversalTimer) return;
  clearInterval(traversalTimer);
  startTraversalTimer();
}

function stepTraversal(fromTimer) {
  if (!traversalData) return;
  if (!fromTimer) pauseTraversal();
  const total = traversalData.bfs.length;
  traversalStep = traversalStep >= total ? 1 : traversalStep + 1;   // stepping past the end wraps to the start
  applyTraversalStep();
}

function resetTraversal() {
  pauseTraversal();
  traversalStep = 0;
  applyTraversalStep();
}

function scrubTraversal(value) {
  pauseTraversal();
  traversalStep = Number(value);
  applyTraversalStep();
}

// Plant Book view toggle: the normal book vs. the traversal comparison.
function setPlantBookMode(mode) {
  plantBookMode = mode;
  document.getElementById("plant-book-standard").classList.toggle("hidden", mode !== "book");
  document.getElementById("plant-book-compare").classList.toggle("hidden", mode !== "compare");
  [["book", "pbmode-book"], ["compare", "pbmode-compare"]].forEach(([name, id]) => {
    const button = document.getElementById(id);
    button.classList.toggle("bg-[#6b4423]", mode === name);
    button.classList.toggle("text-emerald-100", mode === name);
    button.classList.toggle("text-emerald-400/80", mode !== name);
  });
  if (mode !== "compare") pauseTraversal();
}

// =====================================================================
// SCREEN EFFECTS FOR CLIMATE EVENTS (display only)
// Python decides which events are active (GardenGame.active_effects) and calls
// updateScreenEffects(names). Each event gets a tint/frame layer, some get falling pixels,
// and a chip under the header says what it does.
//   "day"   events last until the next End Day (Drought, Cold Snap, Festival Demand, Market Glut).
//   "night" events already did their work while the day ended (Snowstorm, Drizzle, Market Rally),
//           so their weather plays for FX_BURST_MS and fades; the chip stays for the day.
// =====================================================================
const FX_BURST_MS = 8000;
const FX = {
  "Drought":         { mode: "day",   cls: "fx-drought",  color: "#f28a1e", tip: "Watering costs double Water today." },
  "Cold Snap":       { mode: "day",   cls: "fx-frost",    color: "#7fc4ff", tip: "Every action costs double stamina today." },
  "Festival Demand": { mode: "day",   cls: "fx-festival", color: "#ff7fae", tip: "One color tier sells for more for a few days.", dots: 26, dotKind: "confetti" },
  "Market Glut":     { mode: "day",   cls: "fx-glut",     color: "#8a94a8", tip: "One color tier sells for less for a few days." },
  "Snowstorm":       { mode: "night", cls: "fx-snow",     color: "#dbe9ff", tip: "Last night: the cold halted all natural growth.", dots: 40, dotKind: "flake" },
  "Drizzle":         { mode: "night", cls: "fx-rain",     color: "#4a9be0", tip: "Last night: rain watered a few young plants.", dots: 48, dotKind: "drop" },
  "Market Rally":    { mode: "night", cls: "fx-rally",    color: "#f4c93c", tip: "Last night: the Market payout got a bonus.", dots: 18, dotKind: "spark" },
};
let fxTimers = [];

function updateScreenEffects(names) {
  const layer = document.getElementById("fx-layer");
  const chips = document.getElementById("fx-chips");
  fxTimers.forEach(clearTimeout);
  fxTimers = [];
  layer.innerHTML = "";
  chips.innerHTML = "";
  const active = toPlain(names).filter(name => FX[name]);
  document.body.dataset.weather = active.length ? WEATHER_THEME[active[0]] : "";   // the UI palette follows the weather
  chips.classList.toggle("hidden", active.length === 0);
  active.forEach(name => {
    const fx = FX[name];
    const chip = document.createElement("span");
    chip.className = "fx-chip" + (fx.mode === "night" ? " past" : "");
    chip.style.setProperty("--c", fx.color);
    chip.textContent = name;
    chip.title = fx.tip;
    chips.appendChild(chip);

    const el = document.createElement("div");
    el.className = "fx " + fx.cls;
    for (let i = 0; i < (fx.dots || 0); i++) {
      const dot = document.createElement("i");
      const fall = fx.dotKind === "drop" ? 0.7 + Math.random() * 0.6 : 6 + Math.random() * 6;
      const colors = Object.values(PixelArt.TIERS);
      dot.style.cssText = `--x:${(Math.random() * 100).toFixed(1)}%;--d:${fall.toFixed(2)}s;--delay:-${(Math.random() * fall).toFixed(2)}s;` +
        `--sway:${Math.round((Math.random() - 0.5) * 60)}px;--c:${fx.dotKind === "confetti" ? colors[i % colors.length] : fx.color}`;
      el.appendChild(dot);
    }
    layer.appendChild(el);
    if (fx.mode === "night") {
      fxTimers.push(setTimeout(() => el.classList.add("fading"), FX_BURST_MS));
      fxTimers.push(setTimeout(() => el.remove(), FX_BURST_MS + 1500));
    }
  });
}

// updateStamina(current, max)
function updateStamina(current, max) {
  document.getElementById("stamina-text").innerText = `${current} / ${max}`;
  document.getElementById("stamina-bar").style.width = `${Math.min(100, (current / max) * 100)}%`;
}

// updateDay(day)
function updateDay(day) {
  currentDay = day;
  document.getElementById("day-counter").innerText = day;
}

// updateShop(seedRows, waterPrice, water, waterMax, tonicPrice, tonicRestore, tonicsOwned)
// seedRows: list of [name, emoji, price, owned, unlocked], cheapest first.
function updateShop(seedRows, waterPrice, water, waterMax, tonicPrice, tonicRestore, tonicsOwned) {
  const missing = waterMax - water;
  document.getElementById("marco-water-info").textContent =
    `Water: ${water} / ${waterMax} L  -  ${waterPrice} coins per point`;
  document.getElementById("marco-water-full").textContent =
    missing > 0 ? `Refill to Full (${fmt(missing * waterPrice)}c)` : "Water is full";
  document.getElementById("marco-tonic-info").textContent = `+${tonicRestore} stamina  -  ${fmt(tonicPrice)} coins`;
  document.getElementById("marco-tonic-owned").textContent = `You have ${tonicsOwned}`;
  supplies.tonic = tonicsOwned; renderSupplies();                      // Tonics live in the Inventory now

  const list = document.getElementById("marco-seeds");
  list.innerHTML = "";
  (seedRows || []).forEach(([name, emoji, price, owned, unlocked]) => {
    const row = document.createElement("div");
    row.className = "flex items-center gap-3 rounded-xl border px-3 py-2 " +
      (unlocked ? "border-emerald-900 bg-[#1f130a]" : "border-emerald-950 bg-[#1a0f08] opacity-50");
    row.innerHTML = `
      <span class="shrink-0 ${unlocked ? "" : "grayscale"}">${symbol(emoji, name, 32)}</span>
      <div class="flex-1">
        <div class="text-sm font-bold text-white">${name}${unlocked ? "" : ' <span class="text-xs font-normal text-amber-400/90">locked</span>'}</div>
        <div class="text-xs text-emerald-300/80">${fmt(price)}c per seed  -  you own ${fmt(owned)}</div>
      </div>
      <button class="text-xs font-bold px-3 py-1.5 rounded-lg ${unlocked ? "bg-emerald-700 hover:bg-emerald-600 text-white" : "bg-[#4a3019] text-emerald-400/50 cursor-not-allowed"}" ${unlocked ? "" : "disabled"}>${unlocked ? "Buy" : "Locked"}</button>
    `;
    if (unlocked) row.querySelector("button").addEventListener("click", () => marcoBuySeed(name));
    list.appendChild(row);
  });
}

// updateNightShop(wardPrice, wardsOwned, sprayPrice, spraysOwned): Marco's night supplies and the tool counts
function updateNightShop(wardPrice, wardsOwned, sprayPrice, spraysOwned, lensPrice, lensesOwned, radarPrice, radarUnlocked, lockboxPrice, lockboxUnlocked) {
  if (lockboxPrice !== undefined) {
    document.getElementById("marco-lockbox-info").textContent = lockboxUnlocked
      ? "Your most valuable stack is safe from the Magpie"
      : `${fmt(lockboxPrice)} coins, one time  -  the Magpie can never take your most valuable stack`;
    document.getElementById("marco-lockbox-owned").textContent = lockboxUnlocked ? "Unlocked" : "Not unlocked";
    const lockButton = document.getElementById("marco-lockbox-btn");
    lockButton.disabled = !!lockboxUnlocked;
    lockButton.textContent = lockboxUnlocked ? "Owned" : "Unlock";
  }
  if (radarPrice !== undefined) {
    document.getElementById("marco-radar-info").textContent = radarUnlocked
      ? "Pick the Radar tool and click any tile to scan it (5 stamina)"
      : `${fmt(radarPrice)} coins, one time  -  scan any tile for 5 stamina to see how close the blight is`;
    document.getElementById("marco-radar-owned").textContent = radarUnlocked ? "Unlocked" : "Not unlocked";
    const button = document.getElementById("marco-radar-btn");
    button.disabled = !!radarUnlocked;
    button.textContent = radarUnlocked ? "Owned" : "Unlock";
    document.getElementById("tool-radar").classList.toggle("hidden", !radarUnlocked);
  }
  if (lensPrice !== undefined) {
    document.getElementById("marco-lens-info").textContent = `${fmt(lensPrice)} coins  -  shows a predator's route until the day ends`;
    document.getElementById("marco-lens-owned").textContent = `You have ${lensesOwned}`;
  }
  document.getElementById("marco-ward-info").textContent = `${fmt(wardPrice)} coins  -  3 or more linked Wards form a barrier`;
  document.getElementById("marco-ward-owned").textContent = `You have ${wardsOwned}`;
  document.getElementById("marco-spray-info").textContent = `${fmt(sprayPrice)} coins  -  cleanses one blighted tile`;
  document.getElementById("marco-spray-owned").textContent = `You have ${spraysOwned}`;
  document.getElementById("ward-count").textContent = wardsOwned;
  document.getElementById("spray-count").textContent = spraysOwned;
  supplies.ward = wardsOwned; supplies.spray = spraysOwned;
  if (lensesOwned !== undefined) supplies.lens = lensesOwned;
  if (radarUnlocked !== undefined) supplies.radar = !!radarUnlocked;
  if (lockboxUnlocked !== undefined) supplies.lockbox = !!lockboxUnlocked;
  renderSupplies();
}
function nightQty() {
  const typed = parseInt(document.getElementById("marco-night-qty").value, 10);
  return Math.max(1, Math.min(999, Number.isFinite(typed) ? typed : 1));
}
function marcoBuyWard() { callPythonAction("buy_ward_action", nightQty()); }
function marcoBuySpray() { callPythonAction("buy_spray_action", nightQty()); }
function marcoBuyLens() { callPythonAction("buy_lens_action", nightQty()); }
function marcoBuyRadar() { callPythonAction("buy_radar_action"); }
function marcoBuyLockbox() { callPythonAction("buy_lockbox_action"); }

// updateRaid(show, rows, value, size, capacity, tableCells, memoSolved, protectedLabel)  (Topic 11)
// rows: what the Magpie would take tonight, as [stackKey, emoji, plantName, mutation, count]. Only sent while a Lens is active.
function updateRaid(show, rows, value, size, capacity, tableCells, memoSolved, protectedLabel) {
  const panel = document.getElementById("raid-panel");
  panel.classList.toggle("hidden", !show);
  if (!show) return;
  document.getElementById("raid-icon").innerHTML = PixelArt.magpieImg(32);
  rows = toPlain(rows);
  document.getElementById("raid-summary").textContent = rows.length
    ? `It can carry ${capacity} and would take plants worth ${fmt(value)} coins (using ${size} of its ${capacity} carrying space). Sell them first, or give it a worse haul.`
    : `It can carry ${capacity} but your Inventory holds nothing it could take.`;
  document.getElementById("raid-list").innerHTML = rows.map(([key, emoji, name, mutation, count]) => `
    <div class="triage-row"><span class="shrink-0">${mutSprite(emoji, name, mutation, 32)}</span>
      <span class="flex-1">${keyLabel(key)}</span><span class="font-bold">x${count}</span></div>`).join("");
  document.getElementById("raid-dp").textContent = rows.length
    ? `It chose by dynamic programming: a table of ${fmt(tableCells)} cells (bottom-up), or ${fmt(memoSolved)} sub-questions with memoization.` : "";
  document.getElementById("raid-lock").textContent = protectedLabel ? `Your Lockbox keeps the ${protectedLabel} safe.` : "";
}

// updateRegistry(rows, buckets, entries, loadPercent, collisions, rehashes, bucketSizes)  (Topic 6)
// rows: each Ward as [tile, dayPlaced, "barrier" | "lone"]. bucketSizes[i] = how many Wards share bucket i.
function updateRegistry(rows, buckets, entries, loadPercent, collisions, rehashes, bucketSizes) {
  const panel = document.getElementById("registry-panel");
  panel.classList.toggle("hidden", entries === 0);
  if (entries === 0) return;
  document.getElementById("registry-list").innerHTML = toPlain(rows).map(([pos, day, status]) => `
    <div class="triage-row"><span class="flex-1">Ward at row ${Math.floor(pos / 10) + 1}, column ${pos % 10 + 1} (tile ${pos})</span>
      <span class="text-emerald-300/70">placed Day ${day}</span><span class="font-bold ${status === "barrier" ? "text-yellow-300" : ""}">${status}</span></div>`).join("");
  document.getElementById("registry-stats").textContent =
    `${buckets} buckets, ${entries} Ward${entries === 1 ? "" : "s"}, load ${loadPercent}%, ${collisions} collision${collisions === 1 ? "" : "s"}, ${rehashes} rehash${rehashes === 1 ? "" : "es"}.`;
  document.getElementById("registry-buckets").innerHTML = toPlain(bucketSizes).map((n, i) =>
    `<span class="bucket b${Math.min(n, 2)}" title="bucket ${i}: ${n} Ward${n === 1 ? "" : "s"}"></span>`).join("");
}

// updateRadar(where, summary, rings, binarySteps, linearSteps, count, note)  (Topic 9)
// rings[i] = how many blighted tiles are within i + 1 steps of the scanned tile. Empty "where" hides the panel.
function updateRadar(where, summary, rings, binarySteps, linearSteps, count, note) {
  const panel = document.getElementById("radar-panel");
  panel.classList.toggle("hidden", !where);
  if (!where) return;
  rings = toPlain(rings);
  document.getElementById("radar-where").textContent = `Scan of ${where}`;
  document.getElementById("radar-summary").textContent = summary;
  const most = Math.max(1, ...rings);
  document.getElementById("radar-bars").innerHTML = rings.map((n, i) => `
    <div class="radar-row"><span class="radar-label">within ${i + 1}</span>
      <span class="radar-track"><span class="radar-bar" style="width:${Math.round(100 * n / most)}%"></span></span>
      <span class="radar-count">${n}</span></div>`).join("");
  document.getElementById("radar-search").textContent = count > 0
    ? `Answering those ${rings.length} questions on ${count} distance${count === 1 ? "" : "s"}: binary search took ${binarySteps} steps, linear search ${linearSteps}.`
    : `There were no distances to search.`;
  document.getElementById("radar-note").textContent = note;
}
function useLens() { callPythonAction("use_lens_action"); }
function quickDefend() { callPythonAction("quick_defend_action"); }
function rescueTriage() { callPythonAction("rescue_action"); }

// updateTriage(rows, table, usedName)  (Topic 8)
// rows: infected plants already sorted by Python, as [tile, emoji, name, stage, value]
// table: what each sorting algorithm would have cost on this list, as [name, comparisons, moves, speed, stable]
const RESCUE_COUNT = 3;   // how many plants Rescue cures at most (matches Python)
function updateTriage(rows, table, used) {
  rows = toPlain(rows);
  table = toPlain(table);
  const board = document.getElementById("triage-board");
  board.classList.toggle("hidden", rows.length === 0);
  if (rows.length === 0) return;
  document.getElementById("triage-list").innerHTML = rows.map(([pos, emoji, name, stage, value], i) => `
    <div class="triage-row${i < RESCUE_COUNT ? " next" : ""}">
      <span class="triage-rank">#${i + 1}</span>
      <span class="shrink-0">${symbol(emoji, name, 32)}</span>
      <span class="flex-1">${name} <span class="text-emerald-300/70">(row ${Math.floor(pos / 10) + 1}, column ${pos % 10 + 1}, ${stage})</span></span>
      <span class="font-bold">${fmt(value)}c</span>
    </div>`).join("");
  document.getElementById("triage-table").innerHTML =
    `<tr class="text-emerald-300/80"><th class="text-left">Sort</th><th class="text-right">Comparisons</th><th class="text-right">Moves</th><th class="text-left pl-3">Speed</th><th class="text-left">Stable</th></tr>` +
    table.map(([name, comparisons, moves, speed, stable]) =>
      `<tr class="${name === used ? "triage-used" : ""}"><td>${name}${name === used ? " (used)" : ""}</td><td class="text-right">${fmt(comparisons)}</td><td class="text-right">${fmt(moves)}</td><td class="pl-3">${speed}</td><td>${stable}</td></tr>`).join("");
}

// showGameOver(message): the blight covered every tile
function showGameOver(message) {
  document.getElementById("gameover-text").textContent = message;
  document.getElementById("gameover-art").innerHTML = PixelArt.blightImg(0, 96);
  document.getElementById("gameover-overlay").classList.remove("hidden");
}

function marcoBuySeed(name) {
  const typed = parseInt(document.getElementById("marco-seed-qty").value, 10);
  const qty = Math.max(1, Math.min(999, Number.isFinite(typed) ? typed : 1));
  callPythonAction("buy_seed_action", name, qty);
}

// marcoBuyWater(10) buys a preset amount; marcoBuyWater() buys whatever is typed in the box.
function marcoBuyWater(amount) {
  const typed = parseInt(document.getElementById("marco-water-amount").value, 10);
  callPythonAction("buy_water_action", amount !== undefined ? amount : (Number.isFinite(typed) ? typed : 0));
}
function marcoBuyWaterFull() { callPythonAction("buy_water_full_action"); }
function marcoBuyTonic() { callPythonAction("buy_tonic_action"); }
function useTonic() { callPythonAction("use_tonic_action"); }

// A small arrow next to a price that an event is currently moving: up 30% / down 25%.
function trendBadge(modifier) {
  const pct = Math.round(((modifier === undefined ? 1 : modifier) - 1) * 100);
  if (!pct) return "";
  return pct > 0
    ? ` <span class="text-emerald-400 font-bold">\u25b2 +${pct}%</span>`
    : ` <span class="text-rose-400 font-bold">\u25bc ${pct}%</span>`;
}

// updateInventory(rows: list of [key, emoji, qty, sellPrice, modifier, plantName, mutation, mutationMultiplier])
// Rows arrive already searched and sorted by Python (see GardenGame.inventory_view).
// key is the plant name, or "Plant::Mutation" for a mutated stack.
let inventoryRows = [];
let inventorySelected = null;
const INVENTORY_MIN_SLOTS = 16;   // a backpack always shows some empty slots

// The Search box and the sort menu both go to Python, which owns the filtering and the order.
function inventoryViewChanged() {
  const hook = pyodideInstance ? pyodideInstance.globals.get("inventory_view_action") : null;
  if (!hook) return;
  try {
    hook(document.getElementById("inventory-sort").value, document.getElementById("inventory-search").value);
  } catch (err) {
    showToast("Python error: " + err.message.trim().split("\n").pop());
  } finally {
    hook.destroy();
  }
}

function selectInventorySlot(name) {
  inventorySelected = name;
  renderInventory();
}

function updateInventory(rows) {
  inventoryRows = toPlain(rows);
  if (!inventoryRows.some(r => r[0] === inventorySelected)) inventorySelected = null;
  renderInventory();
}

function renderInventory() {
  const grid = document.getElementById("inventory-grid");
  const detail = document.getElementById("inventory-detail");
  const searching = document.getElementById("inventory-search").value.trim() !== "";
  const empty = document.getElementById("inventory-empty");
  empty.textContent = searching ? "No plants match that search." : "Nothing harvested yet.";
  empty.classList.toggle("hidden", inventoryRows.length > 0);
  grid.innerHTML = "";
  inventoryRows.forEach(([key, emoji, qty, , , plantName, mutation, mult]) => {
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "inv-slot" + (mutation ? " mutated" : "") + (key === inventorySelected ? " selected" : "");
    if (mutation) slot.style.setProperty("--mc", mutLook(mutation).color);
    slot.title = `${keyLabel(key)} \u00d7${fmt(qty)}` + (mutation ? ` (sells x${mult})` : "");
    slot.innerHTML = mutSprite(emoji, plantName || key, mutation, 48) + (mutation ? mutBadge(mutation) : "") + `<span class="cnt">${fmt(qty)}</span>`;
    slot.addEventListener("click", () => selectInventorySlot(key));
    grid.appendChild(slot);
  });
  for (let i = inventoryRows.length; i < INVENTORY_MIN_SLOTS; i++) {
    const slot = document.createElement("div");
    slot.className = "inv-slot empty";
    grid.appendChild(slot);
  }
  const picked = inventoryRows.find(r => r[0] === inventorySelected);
  if (!picked) {
    detail.innerHTML = '<span class="text-xs text-emerald-300/80">Pick a slot to see its price.</span>';
    return;
  }
  const [key, emoji, qty, sellPrice, modifier, plantName, mutation, mult] = picked;
  const mutChip = mutation
    ? `<span class="mut-chip" style="--mc:${mutLook(mutation).color}">${PixelArt.icon(mutLook(mutation).icon, 16, mutLook(mutation).color)} ${mutation} x${mult}</span>` : "";
  detail.innerHTML = `
    <span class="shrink-0">${mutSprite(emoji, plantName || key, mutation, 48)}</span>
    <div class="flex-1">
      <div class="text-sm font-bold text-white">${keyLabel(key)} <span class="text-emerald-300/80 font-normal">x${fmt(qty)}</span> ${mutChip}</div>
      <div class="text-xs text-emerald-300/80">Sells for ${fmt(sellPrice)}c each${trendBadge(modifier)}</div>
    </div>
    <button id="inv-sell" class="text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5">Sell All</button>
    <button id="inv-remove" class="text-xs font-bold bg-rose-800 hover:bg-rose-700 text-white px-3 py-1.5">Remove</button>
  `;
  document.getElementById("inv-sell").addEventListener("click", () => sellToMarket(key, qty));
  document.getElementById("inv-remove").addEventListener("click", () => removeFromInventory(key, qty));
}

// updateMarket(rows: list of [key, emoji, qty, sellPrice, modifier, plantName, mutation, mutationMultiplier], total: int)
function updateMarket(rows, total) {
  const list = document.getElementById("market-list");
  list.innerHTML = "";
  document.getElementById("market-empty").classList.toggle("hidden", rows && rows.length > 0);
  toPlain(rows).forEach(([key, emoji, qty, sellPrice, modifier, plantName, mutation, mult]) => {
    const row = document.createElement("div");
    row.className = "flex items-center gap-3 rounded-xl border border-amber-900 bg-amber-950/30 px-3 py-2";
    if (mutation) row.style.borderColor = mutLook(mutation).color;
    const tag = mutation
      ? ` <span class="mut-chip" style="--mc:${mutLook(mutation).color}">${PixelArt.icon(mutLook(mutation).icon, 16, mutLook(mutation).color)} x${mult}</span>` : "";
    row.innerHTML = `
      <span class="shrink-0">${mutSprite(emoji, plantName || key, mutation, 32)}</span>
      <div class="flex-1 text-sm font-bold text-white">${keyLabel(key)} <span class="text-amber-300/80 font-normal">x${qty}</span>${tag}</div>
      <span class="text-xs font-bold text-amber-300">${fmt(sellPrice * qty)}c${trendBadge(modifier)}</span>
    `;
    list.appendChild(row);
  });
  document.getElementById("market-total").innerText = fmt(total || 0);
}

// pushAction(action: str)
// Appends a display label to the Action History panel (no JS undo logic).
function pushAction(action) {
  displayActionHistory.push(action);
  if (displayActionHistory.length > 8) displayActionHistory.shift();
  renderActionStack();
}

function renderActionStack() {
  const container = document.getElementById("action-stack");
  container.innerHTML = "";
  [...displayActionHistory].reverse().forEach(act => {
    const div = document.createElement("div");
    div.className = "bg-emerald-950/60 border-l-2 border-amber-500 px-3 py-2 rounded text-xs text-emerald-100";
    div.textContent = act;
    container.appendChild(div);
  });
}


function showToast(msg) {
  const toast = document.createElement("div");
  toast.className = "toast fixed bottom-6 right-6 text-white px-5 py-3 z-50 text-sm";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), Math.min(9000, 2500 + 45 * Math.max(0, String(msg).length - 50)));   // longer messages stay longer
}

async function runPythonCode() {
  if (pythonBusy) { showToast("Python is still busy - one moment."); return; }
  pythonBusy = true;
  const consoleEl = document.getElementById("output-console");
  consoleEl.innerHTML = `<span class="text-amber-400">Running...</span><br>`;
  try {
    await initPyodide();
    const code = document.getElementById("code-editor").value.trim();
    await pyodideInstance.runPythonAsync(code);
  } catch (err) {
    consoleEl.innerHTML += `<span class="text-red-400">Error: ${err.message}</span>`;
  } finally {
    pythonBusy = false;
  }
}
// Runs every topic in order (the loop shared by the button and the auto-start).
// Returns { ok: true, count } or { ok: false, failedTopic, error }.
async function runAllTopicsCore() {
  const consoleEl = document.getElementById("output-console");
  const topicKeys = Object.keys(topicTemplates).map(Number).sort((a, b) => a - b);
  for (const key of topicKeys) {
    const title = topicTemplates[key].title;
    consoleEl.innerHTML += `<span class="text-emerald-400">=== Topic ${key}: ${title} ===</span><br>`;
    try {
      await pyodideInstance.runPythonAsync(topicTemplates[key].code.trim());
    } catch (err) {
      const reason = err.message.trim().split("\n").pop();
      consoleEl.innerHTML += `<span class="text-red-400">Error in Topic ${key}: ${reason}</span><br>`;
      return { ok: false, failedTopic: key, error: reason };
    }
  }
  consoleEl.innerHTML += `<span class="text-emerald-400">All ${topicKeys.length} topics ran successfully.</span><br>`;
  return { ok: true, count: topicKeys.length };
}

// The "Run All Topics" button.
async function runAllTopics() {
  if (pythonBusy) { showToast("Python is still busy - one moment."); return; }
  pythonBusy = true;
  const consoleEl = document.getElementById("output-console");
  consoleEl.innerHTML = `<span class="text-amber-400">Running all topics...</span><br>`;
  try {
    await initPyodide();
  } catch (err) {
    consoleEl.innerHTML += `<span class="text-red-400">Failed to load Python: ${err.message}</span>`;
    pythonBusy = false;
    return;
  }
  const result = await runAllTopicsCore();
  pythonBusy = false;
  if (result.ok) {
    showToast(`All ${result.count} topics ran successfully.`);
  } else {
    showToast(`Stopped at Topic ${result.failedTopic} - see the console for the error.`);
  }
}

// ---- Auto-start: the game boots itself, no button needed ----
function notReadyMessage() {
  return pythonBusy
    ? "The garden is still getting ready..."
    : "The garden hasn't started yet. Open the Code Lab (the </> button on the title screen) and press Run All Topics.";
}

function showBootError(reason) {
  document.getElementById("boot-spinner").classList.add("hidden");
  document.getElementById("boot-title").textContent = "The garden couldn't start";
  document.getElementById("boot-status").textContent = reason;
  document.getElementById("boot-actions").classList.remove("hidden");
  setTitleReady(false, reason);
}

// Loads Python (Pyodide), then runs every topic in order. Safe to call again as a retry.
async function autoStartGame() {
  if (pythonBusy) return;
  pythonBusy = true;
  const overlay = document.getElementById("boot-overlay");
  const setStatus = (msg) => { document.getElementById("boot-status").textContent = msg; setTitleStatus(msg); };
  setTitleBusy();
  document.getElementById("boot-spinner").classList.remove("hidden");
  document.getElementById("boot-title").textContent = "Preparing the garden...";
  document.getElementById("boot-actions").classList.add("hidden");
  try {
    if (!topicTemplates[1].code) {                 // the .py file didn't load earlier: try once more
      setStatus("Loading the game code...");
      await loadTopicCode();
      topicLoadError = "";
      loadTopic();
    }
    setStatus("Loading Python (a few seconds the first time)...");
    await initPyodide();
    setStatus("Planting the garden...");
    const result = await runAllTopicsCore();
    if (!result.ok) throw new Error(`Topic ${result.failedTopic} failed: ${result.error}`);
    overlay.classList.add("hidden");
    setTitleReady(true);
  } catch (err) {
    topicLoadError = topicTemplates[1].code ? topicLoadError : err.message;
    const hint = topicTemplates[1].code ? "" :
      " If the address bar starts with file://, serve the folder instead (python -m http.server) and open http://localhost:8000/garden-simulator.html";
    showBootError(err.message + hint);
  } finally {
    pythonBusy = false;
  }
}

function dismissBootOverlay() {
  document.getElementById("boot-overlay").classList.add("hidden");
  openDevEditor();
}

function loadTopic() {
  const key = document.getElementById("topic-selector").value;
  const editor = document.getElementById("code-editor");
  if (topicTemplates[key].code) {
    editor.value = topicTemplates[key].code;
  } else if (topicLoadError) {
    editor.value =
      `# COULD NOT LOAD ${TOPICS_PY_URL}\n# Reason: ${topicLoadError}\n#\n` +
      `# 1) If the address bar starts with file://, the browser blocks fetch().\n` +
      `#    Serve the folder instead: run  python -m http.server  in it,\n` +
      `#    then open http://localhost:8000/garden-simulator.html\n` +
      `# 2) Check the filename matches exactly (hyphen vs underscore): ${TOPICS_PY_URL}\n` +
      `# 3) Keep the .html, .js and .py files in the same folder.`;
  } else {
    editor.value = `# No code found for Topic ${key} in ${TOPICS_PY_URL}.\n# Check that it has a line:  # ===== TOPIC ${key} =====`;
  }
}

function switchTab(tab) {
  closeNav();
  if (tab !== "book") pauseTraversal();
  ["game", "book", "inventory", "market", "marco"].forEach(name => {
    const button = document.getElementById("tab-" + name);
    document.getElementById("view-" + name).classList.toggle("hidden", name === "game" ? false : tab !== name);   // the garden is always on screen; the rest are windows
    button.classList.toggle("bg-[#6b4423]", tab === name);
    button.classList.toggle("text-emerald-100", tab === name);
    button.classList.toggle("text-emerald-400/80", tab !== name);
  });
}

window.onload = async () => {
  document.getElementById("version-badge").textContent = "v" + APP_VERSION;
  hydratePixelIcons();
  // cosmetic setup must never stop the game from booting
  [buildTitleScreen, buildStage, buildNightScene, initWindows].forEach((fn) => { try { fn(); } catch (err) { console.error(fn.name + " failed:", err); } });
  startBootAnimation();
  renderGarden();
  renderActionStack();

  // Resources stay at 0 until your Python calls updateResources(...)
  updateResources(0, 0, 0, 0);

  const select = document.getElementById("topic-selector");
  Object.keys(topicTemplates).forEach(k => {
    const opt = document.createElement("option");
    opt.value = k;
    opt.textContent = topicTemplates[k].title;
    select.appendChild(opt);
  });
  try {
    await loadTopicCode();
  } catch (err) {
    topicLoadError = err.message;
    console.error("loadTopicCode failed:", err);
    showToast("Could not load " + TOPICS_PY_URL + " - open the Code Lab (</> on the title screen) for details.");
  }
  loadTopic();
  switchTab("game");

  // Start the game by itself: load Python, then run every topic in order.
  autoStartGame();
};

// ---- Title screen & Code Lab (Stage 1) ----
let titleReady = false;

function buildTitleScreen() {
  const row = [["Carrot", 3], ["Sunflower", 2], ["Tomato", 3], ["Strawberry", 1], ["Sunflower", 3], ["Carrot", 2], ["Tomato", 3]];
  renderCharPicker();
  document.getElementById("ts-sprites").innerHTML = row.map(([name, stage], i) =>
    `<span class="ts-sprite" style="--delay:${(-i * 0.37).toFixed(2)}s">${PixelArt.img(name, stage, 64)}</span>`).join("");
}

function setTitleStatus(msg) { document.getElementById("ts-status").textContent = msg; }

function setTitleBusy() {
  titleReady = false;
  const btn = document.getElementById("ts-play");
  btn.disabled = true;
  btn.textContent = "Loading...";
}

function setTitleReady(ready, failReason) {
  titleReady = ready;
  const btn = document.getElementById("ts-play");
  btn.disabled = false;
  btn.textContent = ready ? "Play" : "Try again";
  setTitleStatus(ready ? "Your garden is ready!" : failReason);
}

function startGameFromTitle() {
  if (!titleReady) { autoStartGame(); return; }          // after a failed boot the button retries
  const title = document.getElementById("title-screen");
  title.classList.add("leaving");
  setTimeout(() => title.classList.add("hidden"), 600);
}

function openDevEditor() { document.getElementById("dev-modal").classList.remove("hidden"); }
function closeDevEditor() { document.getElementById("dev-modal").classList.add("hidden"); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDevEditor(); });


// ---- Stage 2: burger menu, Inventory supplies, weather themes ----
const WEATHER_THEME = { "Drought": "drought", "Cold Snap": "frost", "Festival Demand": "festival", "Market Glut": "glut", "Snowstorm": "snow", "Drizzle": "rain", "Market Rally": "rally" };

function toggleNav(e) {
  e.stopPropagation();
  const menu = document.getElementById("nav-menu");
  const open = menu.classList.toggle("hidden") === false;
  document.getElementById("burger").setAttribute("aria-expanded", open);
}
function closeNav() {
  document.getElementById("nav-menu").classList.add("hidden");
  document.getElementById("burger").setAttribute("aria-expanded", "false");
}
document.addEventListener("click", (e) => { if (!e.target.closest(".nav-wrap")) closeNav(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeNav(); });

// Everything Marco sells that isn't a seed or water. Only harvested plants (below) can be sold.
const supplies = { tonic: 0, ward: 0, spray: 0, lens: 0, radar: false, lockbox: false };
let supplySelected = "tonic";
const SUPPLY_INFO = {
  tonic:   { label: "Stamina Tonic",   icon: "tonic",  color: "#d28bff", note: "Restores stamina.", use: () => useTonic() },
  ward:    { label: "Ward",            icon: "ward",   color: "#f4c93c", note: "3 or more linked Wards form a barrier against the blight." },
  spray:   { label: "Cleansing Spray", icon: "spray",  color: "#79c63e", note: "Cleanses one blighted tile." },
  lens:    { label: "Scout's Lens",    icon: "lens",   color: "#4a9be0", note: "Shows a predator's route until the day ends." },
  radar:   { label: "Blight Radar",    icon: "radar",  color: "#b06af5", note: "Pick the Radar tool, then click a tile to scan it." },
  lockbox: { label: "Lockbox",         icon: "lock",   color: "#c9b98f", note: "Keeps your most valuable stack safe from the Magpie." },
};

function renderSupplies() {
  const grid = document.getElementById("supply-grid");
  const detail = document.getElementById("supply-detail");
  if (!grid) return;
  const owned = Object.keys(SUPPLY_INFO).filter(id => supplies[id]);
  if (!owned.includes(supplySelected)) supplySelected = owned[0] || null;
  grid.innerHTML = "";
  owned.forEach(id => {
    const info = SUPPLY_INFO[id], n = supplies[id] === true ? 0 : supplies[id];
    const slot = document.createElement("button");
    slot.type = "button";
    slot.className = "inv-slot" + (id === supplySelected ? " selected" : "");
    slot.title = info.label;
    slot.innerHTML = PixelArt.icon(info.icon, 40, info.color) + (n ? `<span class="cnt">${fmt(n)}</span>` : "");
    slot.addEventListener("click", () => { supplySelected = id; renderSupplies(); });
    grid.appendChild(slot);
  });
  for (let i = owned.length; i < 6; i++) grid.insertAdjacentHTML("beforeend", '<div class="inv-slot empty"></div>');
  if (!supplySelected) { detail.innerHTML = '<span class="text-xs text-emerald-300/80">No supplies yet. Marco sells tonics, wards and tools.</span>'; return; }
  const info = SUPPLY_INFO[supplySelected], n = supplies[supplySelected];
  detail.innerHTML = `<span class="shrink-0">${PixelArt.icon(info.icon, 40, info.color)}</span>
    <div class="flex-1"><div class="text-sm font-bold text-white">${info.label}${n === true ? "" : ` <span class="text-emerald-300/80 font-normal">x${fmt(n)}</span>`}</div>
    <div class="text-xs text-emerald-300/80">${info.note}</div></div>` + (info.use ? '<button id="supply-use" class="text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5">Use</button>' : "");
  if (info.use) document.getElementById("supply-use").addEventListener("click", info.use);
}


// ---- Stage 3: living map border, player + Marco sprites, gardening animations, keybinds ----
let playerChar = "girl";
try { playerChar = localStorage.getItem("gardenPlayerChar") || "girl"; } catch (e) { /* storage unavailable: default */ }
let playerTile = null, playerX = 0, walkTimer = null, actTimer = null, hoverIdx = null;
const ACT_FX = { plant: ["sprout", "#79c63e"], water: ["drop", "#4a9be0"], harvest: ["basket", "#f4c93c"], shovel: ["shovel", "#e6d6a8"],
                 ward: ["ward", "#f4c93c"], spray: ["spray", "#79c63e"], radar: ["radar", "#b06af5"] };
const TOOL_KEYS = { p: "plant", w: "water", h: "harvest", s: "shovel" };

function renderCharPicker() {
  const box = document.getElementById("ts-chars");
  box.innerHTML = Characters.names.map(id =>
    `<button type="button" class="ts-char${id === playerChar ? " selected" : ""}" data-char="${id}" aria-pressed="${id === playerChar}">${Characters.img(id, "idle", 5)}<span>${Characters.data[id].name}</span></button>`).join("");
  box.querySelectorAll("button").forEach(b => b.addEventListener("click", () => pickCharacter(b.dataset.char)));
}
function pickCharacter(id) {
  playerChar = id;
  try { localStorage.setItem("gardenPlayerChar", id); } catch (e) { /* ignore */ }
  renderCharPicker();
  document.querySelector("#player .p-img").src = Characters.url(id, "idle");
}

function buildStage() {
  const trees = (n, size, color) => Array.from({ length: n }, (_, i) => `<span class="bg-tree" style="--i:${i}">${PixelArt.icon("tree", size, color)}</span>`).join("");
  document.getElementById("bg-trees").innerHTML = `<div class="tree-row back">${trees(10, 40, "#3f7f26")}</div><div class="tree-row front">${trees(7, 54, "#2f6a1e")}</div>`;
  const crops = ["Sunflower", "Strawberry", "Carrot", "Tomato"];
  document.getElementById("bg-fg").innerHTML = Array.from({ length: 14 }, (_, i) => `<span class="bg-flower" style="--i:${i}">${PixelArt.img(crops[i % 4], 3, 26)}</span>`).join("");
  document.getElementById("marco-npc").innerHTML = Characters.img("marco", "idle", 4);
  document.querySelectorAll("[data-marco]").forEach(el => { el.innerHTML = Characters.img("marco", "idle", 3); });
  const player = document.getElementById("player");
  player.querySelector(".p-img").src = Characters.url(playerChar, "idle");
  player.classList.remove("hidden");
  const grid = document.getElementById("garden-grid");
  new ResizeObserver(() => placePlayer(playerTile, true)).observe(grid);
  grid.addEventListener("mouseover", (e) => { const t = e.target.closest(".tile"); hoverIdx = t ? [...grid.children].indexOf(t) : null; });
  grid.addEventListener("mouseleave", () => { hoverIdx = null; });
  const keys = { plant: "P", water: "W", harvest: "H", shovel: "S" };
  Object.entries(keys).forEach(([tool, key]) => document.getElementById("tool-" + tool).insertAdjacentHTML("beforeend", `<kbd class="kbd">${key}</kbd>`));
}

function playerSpot(tile) {
  const wrap = document.getElementById("garden-wrap"), wr = wrap.getBoundingClientRect();
  const cell = tile && document.getElementById("garden-grid").children[tile.row * 10 + tile.col];
  if (!cell) return [36, wr.height + 40];                       // home: on the path below the garden
  const r = cell.getBoundingClientRect();
  return [r.left - wr.left + r.width / 2, r.top - wr.top + r.height * 0.92];
}
function placePlayer(tile, instant) {
  const p = document.getElementById("player");
  const [x, y] = playerSpot(tile);
  if (instant) p.style.transition = "none";
  p.style.left = x + "px"; p.style.top = y + "px";
  if (instant) { void p.offsetWidth; p.style.transition = ""; }
  playerX = x;
}
function playerAct(row, col, tool) {
  const p = document.getElementById("player"), img = p.querySelector(".p-img");
  if (!p || p.classList.contains("hidden")) return;
  clearInterval(walkTimer); clearTimeout(actTimer);
  delete p.dataset.act;
  const [x] = playerSpot({ row, col });
  p.classList.toggle("face-left", x < playerX);
  playerTile = { row, col };
  let step = false;
  walkTimer = setInterval(() => { step = !step; img.src = Characters.url(playerChar, step ? "step" : "idle"); }, 130);
  placePlayer(playerTile);
  actTimer = setTimeout(() => {
    clearInterval(walkTimer); img.src = Characters.url(playerChar, "idle");
    p.dataset.act = tool;
    spawnActFx(row, col, tool);
    actTimer = setTimeout(() => { delete p.dataset.act; }, 650);
  }, 400);
}
function spawnActFx(row, col, tool) {
  const [icon, color] = ACT_FX[tool] || ["heart", "#e0605a"];
  const [x, y] = playerSpot({ row, col });
  const fx = document.createElement("span");
  fx.className = "act-fx act-" + tool;
  fx.style.left = x + "px"; fx.style.top = (y - 24) + "px";
  fx.innerHTML = PixelArt.icon(icon, 22, color);
  document.getElementById("garden-wrap").appendChild(fx);
  setTimeout(() => fx.remove(), 800);
}

function togglePanels() {
  document.body.classList.toggle("journal-open");
  placePlayer(playerTile, true);
}

// Keybinds: P / W / H / S pick Plant / Water / Harvest / Shovel; Space or Enter acts on the tile under the mouse.
function gameActive() {
  const hidden = (id) => { const el = document.getElementById(id); return !el || el.classList.contains("hidden"); };
  return hidden("title-screen") && hidden("night-scene") && hidden("morning-modal") && hidden("dev-modal") && hidden("confirm-modal") && ["view-book", "view-inventory", "view-market", "view-marco"].every(hidden);
}
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || !gameActive()) return;
  const tool = TOOL_KEYS[e.key.toLowerCase()];
  if (tool) { e.preventDefault(); selectTool(tool); }
  else if ((e.key === " " || e.key === "Enter") && hoverIdx !== null) { e.preventDefault(); handleTileClick(Math.floor(hoverIdx / 10), hoverIdx % 10); }
});


// ---- Stage 4: end-of-day walk home, night time-lapse, morning summary ----
let nightRunning = false, nightSkip = false, nightWake = null;
const NIGHT_T = matchMedia("(prefers-reduced-motion: reduce)").matches ? 0.15 : 1;
const nightEsc = (s) => String(s).replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

function buildNightScene() {
  const cv = document.getElementById("ns-house"), g = cv.getContext("2d");
  const R = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const stones = (x0, x1, y0, y1) => { for (let y = y0; y < y1; y += 2) for (let x = x0 + (y % 4); x < x1; x += 4) R("#7a7166", x, y, 2, 1); };
  const roof = (cx, y0, y1, k) => { for (let y = y0; y < y1; y++) { const hw = Math.round((y - y0 + 1) * k); R(y % 2 ? "#b8433a" : "#a33a32", cx - hw, y, hw * 2, 1); R("#8f2f2a", cx + (hw >> 1), y, hw - (hw >> 1), 1); } };
  R("#3c7a35", 0, 34, 64, 10);
  for (let y = 34; y < 44; y++) for (let x = (y % 2) * 2; x < 64; x += 4) R("#356f30", x, y, 2, 1);
  R("#a9895a", 22, 34, 12, 10); R("#8f7048", 22, 34, 1, 10); R("#8f7048", 33, 34, 1, 10);
  R("#8d8478", 8, 18, 32, 16); stones(8, 40, 18, 34);
  R("#8d8478", 42, 14, 12, 20); stones(42, 54, 14, 34);
  roof(24, 6, 18, 1.5); roof(48, 4, 14, 0.62);
  R("#6b6b6b", 13, 4, 4, 8); R("#4a4a4a", 13, 4, 4, 1);
  const wins = [[12, 22, 4, 5], [33, 22, 4, 5], [46, 18, 4, 4], [46, 26, 4, 4]];
  wins.forEach(([x, y, w, h]) => { R("#4a2e1c", x - 1, y - 1, w + 2, h + 2); R("#1b2a44", x, y, w, h); });
  R("#4a2e1c", 21, 25, 8, 9); R("#5a3a22", 22, 26, 6, 8); R("#3a2412", 25, 26, 1, 8); R("#d9a441", 26, 30, 1, 1); R("#b8433a", 20, 24, 10, 1);
  [[3, 26], [58, 28]].forEach(([cx, cy]) => { R("#5a3a22", cx, cy + 5, 2, 6); for (let dy = -5; dy <= 5; dy++) { const hw = Math.round(Math.sqrt(30 - dy * dy)); R(dy < 0 ? "#3f7f26" : "#2f6a1e", cx + 1 - hw, cy + dy, hw * 2, 1); } });
  [[4, 37, 14], [44, 37, 14]].forEach(([x, y, w]) => { R("#6b4423", x, y, w, 5); for (let i = 0; i < w; i += 3) R("#79c63e", x + i + 1, y + 1, 1, 2); });
  const stage = document.getElementById("ns-stage");
  wins.concat([[22, 26, 6, 8]]).forEach(([x, y, w, h], i) => stage.insertAdjacentHTML("beforeend",
    `<span class="ns-win${i === 4 ? " door" : ""}" style="left:${x / 0.64}%;top:${y / 0.44}%;width:${w / 0.64}%;height:${h / 0.44}%"></span>`));
  document.getElementById("ns-stars").innerHTML = Array.from({ length: 55 }, () =>
    `<i style="left:${Math.random() * 100}%;top:${Math.random() * 55}%;--d:${(1 + Math.random() * 2).toFixed(1)}s"></i>`).join("");
  document.getElementById("ns-eyes").innerHTML = [[10, 86, 0], [46, 88, 1.1], [30, 94, 0.6], [57, 82, 1.7]].map(([x, y, d]) =>
    `<i style="--x:${x}%;--y:${y}%;--delay:${d}s"></i>`).join("");
}

function nightWait(ms) {
  return new Promise(res => { if (nightSkip) return res(); const t = setTimeout(res, ms * NIGHT_T); nightWake = () => { clearTimeout(t); res(); }; });
}
function skipNight() { nightSkip = true; if (nightWake) nightWake(); }
function setNightPhase(name) {
  const scene = document.getElementById("night-scene"), order = ["dusk", "night", "eerie", "dawn"];
  scene.dataset.phase = name;
  order.forEach((p, i) => scene.classList.toggle("ph-" + p, i <= order.indexOf(name)));
}

// The real night happens in Python (end_day_action); night_report_action returns what it recorded.
function runEndDay() {
  let msg = "", report = null;
  const end = pyodideInstance.globals.get("end_day_action");
  try { msg = end(); } catch (err) { showToast("Python error: " + err.message.trim().split("\n").pop()); } finally { end.destroy(); }
  const rep = pyodideInstance.globals.get("night_report_action");
  try { report = JSON.parse(rep()); } catch (err) { report = null; } finally { rep.destroy(); }
  return { msg, report };
}

async function playNightSequence() {
  if (nightRunning) return;
  if (!pyodideInstance) { showToast(notReadyMessage()); return; }
  nightRunning = true; nightSkip = false;
  const scene = document.getElementById("night-scene"), player = document.getElementById("ns-player"), img = player.querySelector("img");
  const say = (t) => { document.getElementById("ns-caption").textContent = t; };
  scene.classList.remove("hidden", "lit", "show"); setNightPhase("dusk");
  player.classList.remove("enter"); player.style.transition = "none"; player.style.left = "4%"; player.style.top = "88%";
  img.src = Characters.url(playerChar, "idle");
  void scene.offsetWidth;
  scene.classList.add("show");
  say("The sun is setting. Time to head home...");
  await nightWait(700);
  let step = false;
  const walk = setInterval(() => { step = !step; img.src = Characters.url(playerChar, step ? "step" : "idle"); }, 140);
  player.style.transition = "left 2s steps(16), top 2s steps(16)";
  player.style.left = "38%"; player.style.top = "75%";
  await nightWait(2100);
  clearInterval(walk); img.src = Characters.url(playerChar, "idle");
  player.classList.add("enter"); scene.classList.add("lit");
  say("Lights out. Sweet dreams, little gardener...");
  setNightPhase("night");
  await nightWait(3200);
  setNightPhase("eerie"); say("...but the garden is not quiet tonight.");
  scene.classList.add("flash"); setTimeout(() => scene.classList.remove("flash"), 700);
  const result = runEndDay();
  if (result.report && result.report.night.length) say(result.report.night[0]);
  await nightWait(3800);
  setNightPhase("dawn"); scene.classList.remove("lit"); say("Dawn breaks...");
  await nightWait(1800);
  scene.classList.remove("show");
  await nightWait(500);
  scene.classList.add("hidden");
  nightRunning = false; playerTile = null; placePlayer(null, true);
  if (result.report && !result.report.over) showMorningSummary(result.report);
  else if (result.msg) showToast(result.msg);
}

function showMorningSummary(r) {
  const tally = (names) => Object.entries(names.reduce((a, n) => (a[n] = (a[n] || 0) + 1, a), {})).map(([n, k]) => `${k} ${nightEsc(n)}`).join(", ");
  const li = (items, cls = "") => items.map(t => `<li class="${cls}">${nightEsc(t)}</li>`).join("");
  const grew = r.grew.length ? [`${r.grew.length} plant${r.grew.length > 1 ? "s" : ""} grew a stage.`] : ["Nothing grew overnight. Plants only grow after a watering."];
  const dark = r.night.concat(r.lost.length ? [`Lost: ${tally(r.lost)}.`] : [], r.infected.length ? [`Infected by the blight: ${tally(r.infected)}.`] : []);
  const market = [r.earned ? `The Market paid out ${r.earned.toLocaleString()} coins.` : "Nothing sold overnight."].concat(r.prices.length ? [`Prices are back to normal for ${r.prices.join(", ")}.`] : []);
  const block = (icon, title, body) => `<section class="morning-sec"><h3>${title}</h3><ul>${body}</ul></section>`;
  document.getElementById("morning-title").textContent = `Day ${r.day} begins!`;
  document.getElementById("morning-body").innerHTML =
    block("sprout", "What grew", li(grew) + (r.ripe.length ? li([`Ready to harvest: ${tally(r.ripe)}.`], "good") : "")) +
    block("moon", "What happened in the night", dark.length ? li(dark, "bad") : li(["A quiet night. Nothing came creeping."])) +
    block("cloud", "Weather and events", r.events.length ? li(r.events) : li(["Clear skies and nothing unusual."])) +
    block("coin", "The Market", li(market));
  document.getElementById("morning-modal").classList.remove("hidden");
}
function closeMorning() { document.getElementById("morning-modal").classList.add("hidden"); }


// ---- UI v2: windows float over the garden; Esc closes them and the Journal ----
function initWindows() {
  ["book", "inventory", "market", "marco"].forEach(n => document.getElementById("view-" + n)
    .insertAdjacentHTML("afterbegin", '<button type="button" class="win-x" aria-label="Close window" onclick="switchTab(\'game\')">X</button>'));
}
document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  document.body.classList.remove("journal-open");
  if (!document.getElementById("view-game").classList.contains("hidden")) switchTab("game");
});
