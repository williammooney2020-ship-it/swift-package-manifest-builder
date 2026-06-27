// Swift Package Manifest Builder — browser-only, no API.
// Generates a valid Package.swift from a visual form.

const SWIFT_TOOLS_VERSIONS = ["6.0", "5.10", "5.9", "5.8", "5.7", "5.6", "5.5"];
const PLATFORMS = ["iOS", "macOS", "watchOS", "tvOS", "visionOS"];
const MIN_VERSIONS = {
  iOS: ["18.0", "17.0", "16.0", "15.0", "14.0", "13.0"],
  macOS: ["15.0", "14.0", "13.0", "12.0", "11.0", "10.15"],
  watchOS: ["11.0", "10.0", "9.0", "8.0", "7.0"],
  tvOS: ["18.0", "17.0", "16.0", "15.0", "14.0", "13.0"],
  visionOS: ["2.0", "1.0"],
};
const PRODUCT_TYPES = ["library", "executable"];
const TARGET_TYPES = ["target", "testTarget", "binaryTarget", "macro"];
const LIBRARY_TYPES = ["automatic", "static", "dynamic"];
const DEPENDENCY_TYPES = ["url", "path", "registry"];

const STORAGE_KEY = "spm_builder_v1";

let state = {
  packageName: "",
  swiftToolsVersion: "5.10",
  platforms: [{ platform: "iOS", minVersion: "16.0" }],
  products: [{ id: genId(), name: "", type: "library", libraryType: "automatic", targets: [] }],
  dependencies: [],
  targets: [{ id: genId(), name: "", type: "target", path: "", sources: [], exclude: [], resources: [], deps: [], swiftSettings: [] }],
};

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function save() {
  state.packageName = val("packageName");
  state.swiftToolsVersion = val("swiftToolsVersion");
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const d = JSON.parse(raw);
      state = { ...state, ...d };
    }
  } catch (e) {}
}

function val(id) { const el = document.getElementById(id); return el ? el.value : ""; }
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v; }

// ── Platforms ─────────────────────────────────────────────────────────────────

function addPlatform() {
  state.platforms.push({ platform: "macOS", minVersion: "12.0" });
  renderPlatforms();
  generate();
}

function removePlatform(i) {
  state.platforms.splice(i, 1);
  renderPlatforms();
  generate();
}

function updatePlatform(i, field, value) {
  state.platforms[i][field] = value;
  if (field === "platform") {
    const versions = MIN_VERSIONS[value] || [];
    state.platforms[i].minVersion = versions[0] || "";
    renderPlatforms();
  }
  generate();
  save();
}

function renderPlatforms() {
  const el = document.getElementById("platformList");
  el.innerHTML = state.platforms.map((p, i) => {
    const versions = MIN_VERSIONS[p.platform] || [];
    const platOpts = PLATFORMS.map(pl => `<option value="${pl}" ${p.platform === pl ? "selected" : ""}>${pl}</option>`).join("");
    const verOpts = versions.map(v => `<option value="${v}" ${p.minVersion === v ? "selected" : ""}>${v}</option>`).join("");
    return `
    <div class="list-row">
      <select onchange="updatePlatform(${i},'platform',this.value)">${platOpts}</select>
      <span style="color:var(--muted);font-size:13px;flex:none">≥</span>
      <select onchange="updatePlatform(${i},'minVersion',this.value)">${verOpts}</select>
      <button class="remove-btn" onclick="removePlatform(${i})">✕</button>
    </div>`;
  }).join("") || `<div style="color:var(--muted);font-size:13px">No platform constraints — supports all Apple platforms.</div>`;
}

// ── Dependencies ──────────────────────────────────────────────────────────────

function addDependency() {
  state.dependencies.push({ id: genId(), type: "url", url: "", name: "", localPath: "", registry: "", from: "", exact: "", upToNextMajor: "", branch: "", revision: "", requirement: "upToNextMajor" });
  renderDependencies();
  generate();
}

function removeDependency(id) {
  state.dependencies = state.dependencies.filter(d => d.id !== id);
  renderDependencies();
  generate();
}

function updateDep(id, field, value) {
  const dep = state.dependencies.find(d => d.id === id);
  if (!dep) return;
  dep[field] = value;
  if (field === "type") renderDependencies();
  else generate();
  save();
}

function renderDependencies() {
  const el = document.getElementById("depList");
  if (state.dependencies.length === 0) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px">No dependencies. Click "+ Add Dependency" to add one.</div>`;
    generate();
    return;
  }
  el.innerHTML = state.dependencies.map(d => {
    const typeOpts = DEPENDENCY_TYPES.map(t => `<option value="${t}" ${d.type === t ? "selected" : ""}>${t === "url" ? "URL (GitHub/GitLab)" : t === "path" ? "Local Path" : "Swift Package Registry"}</option>`).join("");
    const reqOpts = ["upToNextMajor", "upToNextMinor", "exact", "branch", "revision"].map(r =>
      `<option value="${r}" ${d.requirement === r ? "selected" : ""}>${{ upToNextMajor: "Up to next major", upToNextMinor: "Up to next minor", exact: "Exact version", branch: "Branch", revision: "Revision" }[r]}</option>`
    ).join("");

    let extraFields = "";
    if (d.type === "url") {
      extraFields = `
        <div class="dep-row">
          <div class="field-block"><label class="field-label">Git URL</label>
            <input type="text" value="${esc(d.url)}" placeholder="https://github.com/owner/repo.git" oninput="updateDep('${d.id}','url',this.value)" spellcheck="false" />
          </div>
          <div class="field-block"><label class="field-label">Version Requirement</label>
            <select onchange="updateDep('${d.id}','requirement',this.value)">${reqOpts}</select>
          </div>
          <div class="field-block"><label class="field-label">${
            d.requirement === "branch" ? "Branch Name" :
            d.requirement === "revision" ? "Commit Hash" :
            "Version"
          }</label>
            <input type="text" value="${esc(d.requirement === "branch" ? d.branch : d.requirement === "revision" ? d.revision : d.from || d.exact || "")}"
              placeholder="${d.requirement === "branch" ? "main" : d.requirement === "revision" ? "abc123..." : "1.0.0"}"
              oninput="updateDep('${d.id}','${d.requirement === "branch" ? "branch" : d.requirement === "revision" ? "revision" : "from"}',this.value)" spellcheck="false" />
          </div>
        </div>`;
    } else if (d.type === "path") {
      extraFields = `
        <div class="field-block"><label class="field-label">Local Path</label>
          <input type="text" value="${esc(d.localPath)}" placeholder="../MyLibrary" oninput="updateDep('${d.id}','localPath',this.value)" spellcheck="false" />
        </div>`;
    } else {
      extraFields = `
        <div class="dep-row">
          <div class="field-block"><label class="field-label">Package ID</label>
            <input type="text" value="${esc(d.registry)}" placeholder="scope.package-name" oninput="updateDep('${d.id}','registry',this.value)" spellcheck="false" />
          </div>
          <div class="field-block"><label class="field-label">From Version</label>
            <input type="text" value="${esc(d.from)}" placeholder="1.0.0" oninput="updateDep('${d.id}','from',this.value)" />
          </div>
        </div>`;
    }

    return `
    <div class="dep-card">
      <div class="dep-header">
        <select onchange="updateDep('${d.id}','type',this.value)" style="background:var(--panel2);border:1px solid var(--line);color:var(--ink);border-radius:7px;padding:5px 10px;font:inherit;font-size:13px;outline:none">${typeOpts}</select>
        <button class="remove-btn" onclick="removeDependency('${d.id}')">✕ Remove</button>
      </div>
      ${extraFields}
    </div>`;
  }).join("");
  generate();
}

// ── Targets ───────────────────────────────────────────────────────────────────

function addTarget() {
  state.targets.push({ id: genId(), name: "", type: "target", path: "", sources: [], exclude: [], resources: [], deps: [], url: "", checksum: "" });
  renderTargets();
  generate();
}

function removeTarget(id) {
  state.targets = state.targets.filter(t => t.id !== id);
  renderTargets();
  generate();
}

function updateTarget(id, field, value) {
  const t = state.targets.find(t => t.id === id);
  if (!t) return;
  t[field] = value;
  if (field === "type") renderTargets();
  else generate();
  save();
}

function toggleTargetDep(targetId, depName) {
  const t = state.targets.find(t => t.id === targetId);
  if (!t) return;
  if (!t.deps) t.deps = [];
  const idx = t.deps.indexOf(depName);
  if (idx >= 0) t.deps.splice(idx, 1);
  else t.deps.push(depName);
  generate();
  save();
}

function renderTargets() {
  const el = document.getElementById("targetList");
  if (state.targets.length === 0) {
    el.innerHTML = `<div style="color:var(--muted);font-size:13px">No targets yet.</div>`;
    return;
  }

  const allTargetNames = state.targets.map(t => t.name).filter(Boolean);
  const depNames = state.dependencies.map(d => {
    if (d.type === "url") return d.url.split("/").pop()?.replace(/\.git$/, "") || "";
    if (d.type === "path") return d.localPath.split("/").pop() || "";
    return d.registry || "";
  }).filter(Boolean);

  el.innerHTML = state.targets.map(t => {
    const typeOpts = TARGET_TYPES.map(tt => `<option value="${tt}" ${t.type === tt ? "selected" : ""}>${{ target: "Target", testTarget: "Test Target", binaryTarget: "Binary Target", macro: "Macro" }[tt]}</option>`).join("");

    const binaryFields = t.type === "binaryTarget" ? `
      <div class="field-block"><label class="field-label">URL (XCFramework)</label>
        <input type="text" value="${esc(t.url || "")}" placeholder="https://example.com/MyLib.xcframework.zip" oninput="updateTarget('${t.id}','url',this.value)" spellcheck="false" />
      </div>
      <div class="field-block"><label class="field-label">Checksum</label>
        <input type="text" value="${esc(t.checksum || "")}" placeholder="sha256 checksum" oninput="updateTarget('${t.id}','checksum',this.value)" spellcheck="false" />
      </div>` : `
      <div class="field-block"><label class="field-label">Custom Path <span style="font-weight:400;opacity:.6">(optional, leave blank for default)</span></label>
        <input type="text" value="${esc(t.path)}" placeholder="Sources/MyTarget" oninput="updateTarget('${t.id}','path',this.value)" spellcheck="false" />
      </div>`;

    const depsSection = t.type !== "binaryTarget" && (allTargetNames.length > 1 || depNames.length > 0) ? `
      <div class="field-block" style="grid-column:span 2">
        <label class="field-label">Dependencies</label>
        <div class="deps-checkboxes">
          ${allTargetNames.filter(n => n !== t.name).map(n => `
            <label class="dep-check${(t.deps||[]).includes(n) ? " checked" : ""}">
              <input type="checkbox" ${(t.deps||[]).includes(n) ? "checked" : ""} onchange="toggleTargetDep('${t.id}','${n}')" /> ${n}
            </label>`).join("")}
          ${depNames.map(n => `
            <label class="dep-check${(t.deps||[]).includes(".product(name: \""+n+"\", package: \""+n+"\")") ? " checked" : ""}">
              <input type="checkbox" ${(t.deps||[]).includes(".product(name: \""+n+"\", package: \""+n+"\")") ? "checked" : ""} onchange="toggleTargetDep('${t.id}','.product(name: &quot;${n}&quot;, package: &quot;${n}&quot;)')" /> ${n} <span style="color:var(--muted);font-size:11px">(package)</span>
            </label>`).join("")}
        </div>
      </div>` : "";

    return `
    <div class="target-card">
      <div class="target-header">
        <select onchange="updateTarget('${t.id}','type',this.value)" style="background:var(--panel2);border:1px solid var(--line);color:var(--ink);border-radius:7px;padding:5px 10px;font:inherit;font-size:13px;outline:none">${typeOpts}</select>
        <button class="remove-btn" onclick="removeTarget('${t.id}')">✕ Remove</button>
      </div>
      <div class="target-fields">
        <div class="field-block"><label class="field-label">Target Name</label>
          <input type="text" value="${esc(t.name)}" placeholder="MyLibrary" oninput="updateTarget('${t.id}','name',this.value)" />
        </div>
        ${binaryFields}
        ${depsSection}
      </div>
    </div>`;
  }).join("");
}

// ── Products ──────────────────────────────────────────────────────────────────

function addProduct() {
  state.products.push({ id: genId(), name: "", type: "library", libraryType: "automatic", targets: [] });
  renderProducts();
  generate();
}

function removeProduct(id) {
  state.products = state.products.filter(p => p.id !== id);
  renderProducts();
  generate();
}

function updateProduct(id, field, value) {
  const p = state.products.find(p => p.id === id);
  if (!p) return;
  p[field] = value;
  if (field === "type") renderProducts();
  else generate();
  save();
}

function toggleProductTarget(productId, targetName) {
  const p = state.products.find(p => p.id === productId);
  if (!p) return;
  if (!p.targets) p.targets = [];
  const idx = p.targets.indexOf(targetName);
  if (idx >= 0) p.targets.splice(idx, 1);
  else p.targets.push(targetName);
  generate();
  save();
}

function renderProducts() {
  const el = document.getElementById("productList");
  const targetNames = state.targets.map(t => t.name).filter(Boolean);

  el.innerHTML = state.products.map(p => {
    const typeOpts = PRODUCT_TYPES.map(t => `<option value="${t}" ${p.type === t ? "selected" : ""}>${t.charAt(0).toUpperCase() + t.slice(1)}</option>`).join("");
    const libTypeOpts = p.type === "library" ? `
      <div class="field-block"><label class="field-label">Library Type</label>
        <select onchange="updateProduct('${p.id}','libraryType',this.value)">
          ${LIBRARY_TYPES.map(lt => `<option value="${lt}" ${p.libraryType === lt ? "selected" : ""}>${lt.charAt(0).toUpperCase() + lt.slice(1)}</option>`).join("")}
        </select>
      </div>` : "";

    const targetChecks = targetNames.length > 0 ? `
      <div class="field-block">
        <label class="field-label">Targets</label>
        <div class="deps-checkboxes">
          ${targetNames.map(n => `
            <label class="dep-check${(p.targets||[]).includes(n) ? " checked" : ""}">
              <input type="checkbox" ${(p.targets||[]).includes(n) ? "checked" : ""} onchange="toggleProductTarget('${p.id}','${n}')" /> ${n}
            </label>`).join("")}
        </div>
      </div>` : "";

    return `
    <div class="target-card">
      <div class="target-header">
        <select onchange="updateProduct('${p.id}','type',this.value)" style="background:var(--panel2);border:1px solid var(--line);color:var(--ink);border-radius:7px;padding:5px 10px;font:inherit;font-size:13px;outline:none">${typeOpts}</select>
        <button class="remove-btn" onclick="removeProduct('${p.id}')">✕ Remove</button>
      </div>
      <div class="target-fields">
        <div class="field-block"><label class="field-label">Product Name</label>
          <input type="text" value="${esc(p.name)}" placeholder="MyLibrary" oninput="updateProduct('${p.id}','name',this.value)" />
        </div>
        ${libTypeOpts}
        ${targetChecks}
      </div>
    </div>`;
  }).join("") || `<div style="color:var(--muted);font-size:13px;padding:8px 0">No products yet.</div>`;
}

// ── Generate ──────────────────────────────────────────────────────────────────

function generate() {
  state.packageName = val("packageName");
  state.swiftToolsVersion = val("swiftToolsVersion");

  const lines = [];
  lines.push(`// swift-tools-version: ${state.swiftToolsVersion}`);
  lines.push(`import PackageDescription`);
  lines.push(``);
  lines.push(`let package = Package(`);
  lines.push(`    name: "${state.packageName || "MyPackage"}",`);

  // Platforms
  if (state.platforms.length > 0) {
    lines.push(`    platforms: [`);
    state.platforms.forEach((p, i) => {
      const comma = i < state.platforms.length - 1 ? "," : "";
      lines.push(`        .${p.platform.toLowerCase()}("${p.minVersion}")${comma}`);
    });
    lines.push(`    ],`);
  }

  // Products
  if (state.products.length > 0) {
    lines.push(`    products: [`);
    state.products.forEach((p, i) => {
      const comma = i < state.products.length - 1 ? "," : "";
      const name = p.name || "MyProduct";
      const targets = (p.targets || []).length > 0
        ? (p.targets || []).map(t => `"${t}"`).join(", ")
        : `"${name}"`;
      if (p.type === "library") {
        const libType = p.libraryType !== "automatic" ? `, type: .${p.libraryType}` : "";
        lines.push(`        .library(name: "${name}"${libType}, targets: [${targets}])${comma}`);
      } else {
        lines.push(`        .executable(name: "${name}", targets: [${targets}])${comma}`);
      }
    });
    lines.push(`    ],`);
  }

  // Dependencies
  if (state.dependencies.length > 0) {
    lines.push(`    dependencies: [`);
    state.dependencies.forEach((d, i) => {
      const comma = i < state.dependencies.length - 1 ? "," : "";
      if (d.type === "url") {
        const url = d.url || "https://github.com/owner/repo.git";
        let req = "";
        if (d.requirement === "upToNextMajor") req = `, from: "${d.from || "1.0.0"}"`;
        else if (d.requirement === "upToNextMinor") req = `, .upToNextMinor(from: "${d.from || "1.0.0"}")`;
        else if (d.requirement === "exact") req = `, exact: "${d.exact || d.from || "1.0.0"}"`;
        else if (d.requirement === "branch") req = `, branch: "${d.branch || "main"}"`;
        else if (d.requirement === "revision") req = `, revision: "${d.revision || "abc123"}"`;
        lines.push(`        .package(url: "${url}"${req})${comma}`);
      } else if (d.type === "path") {
        lines.push(`        .package(path: "${d.localPath || "../LocalPackage"}")${comma}`);
      } else {
        lines.push(`        .package(id: "${d.registry || "scope.package"}", from: "${d.from || "1.0.0"}")${comma}`);
      }
    });
    lines.push(`    ],`);
  }

  // Targets
  if (state.targets.length > 0) {
    lines.push(`    targets: [`);
    state.targets.forEach((t, i) => {
      const comma = i < state.targets.length - 1 ? "," : "";
      const name = t.name || "MyTarget";
      const parts = [];
      parts.push(`name: "${name}"`);
      if (t.deps && t.deps.length > 0) {
        const depStr = t.deps.map(d => {
          if (d.startsWith(".product")) return d;
          return `"${d}"`;
        }).join(", ");
        parts.push(`dependencies: [${depStr}]`);
      }
      if (t.path) parts.push(`path: "${t.path}"`);

      if (t.type === "binaryTarget") {
        lines.push(`        .binaryTarget(`);
        lines.push(`            name: "${name}",`);
        if (t.url) lines.push(`            url: "${t.url}",`);
        if (t.checksum) lines.push(`            checksum: "${t.checksum}"`);
        lines.push(`        )${comma}`);
      } else if (t.type === "macro") {
        lines.push(`        .macro(${parts.join(", ")})${comma}`);
      } else if (t.type === "testTarget") {
        lines.push(`        .testTarget(${parts.join(", ")})${comma}`);
      } else {
        lines.push(`        .target(${parts.join(", ")})${comma}`);
      }
    });
    lines.push(`    ]`);
  }

  lines.push(`)`);

  const output = lines.join("\n");
  document.getElementById("manifestOutput").textContent = output;
  countLines(output);
}

function countLines(text) {
  const lineCount = text.split("\n").length;
  document.getElementById("lineCount").textContent = `${lineCount} lines`;
}

function copyManifest() {
  const text = document.getElementById("manifestOutput").textContent;
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("copyBtn");
    btn.textContent = "Copied!";
    setTimeout(() => { btn.textContent = "Copy Package.swift"; }, 1500);
  });
}

function downloadManifest() {
  const text = document.getElementById("manifestOutput").textContent;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
  a.download = "Package.swift";
  a.click();
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.addEventListener("DOMContentLoaded", () => {
  load();
  setVal("packageName", state.packageName);
  setVal("swiftToolsVersion", state.swiftToolsVersion);

  document.getElementById("packageName").addEventListener("input", () => { save(); generate(); });
  document.getElementById("swiftToolsVersion").addEventListener("change", () => { save(); generate(); });

  renderPlatforms();
  renderDependencies();
  renderTargets();
  renderProducts();
  generate();
});
