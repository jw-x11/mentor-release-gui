import { instance as vizInstance } from "https://cdn.jsdelivr.net/npm/@viz-js/viz@3.11.0/+esm";

const KINDS = [
  { id: "dfa", label: "DFA" },
  { id: "nfa", label: "NFA" },
  { id: "re", label: "RE" },
  { id: "cfg", label: "CFG" },
  { id: "pda", label: "PDA" },
  { id: "tm", label: "TM" },
  { id: "htm", label: "HTM" },
];

const COMMANDS = {
  dfa: ["accept", "graph", "gen_words", "compare"],
  nfa: ["accept", "graph", "gen_words", "compare"],
  re: ["accept", "gen_words", "compare"],
  cfg: ["accept", "gen_words", "gen_upto_length"],
  pda: ["accept", "graph", "gen_words", "gen_upto_length"],
  tm: ["accept", "trace", "accept_file"],
  htm: ["accept", "trace", "accept_file"],
};

const COMMAND_LABELS = {
  accept: "Accept",
  graph: "Graph",
  gen_words: "Generate words",
  gen_upto_length: "Up to length",
  compare: "Compare",
  trace: "Trace",
  accept_file: "Batch test",
};

const HELP = {
  dfa: [
    "Required: <code>alphabet</code>, <code>start</code>, <code>accepting</code>, then transitions.",
    "Transitions: <code>(a -&gt; q1)</code>, sets <code>({a,b} -&gt; q1)</code>, or <code>(. -&gt; q1)</code> for the whole alphabet.",
    "Exactly one transition from each state for each alphabet symbol. C++ comments allowed.",
    "Commands: accept, graph, gen_words, compare against a DFA/NFA/RE.",
  ],
  nfa: [
    "Same header as DFA. Extra transition: <code>(_ -&gt; q1)</code> for ε-moves.",
    "Sets may include ε: <code>({a,_} -&gt; q1)</code>. Accepting set may be empty.",
    "Commands match DFA: accept, graph, gen_words, compare.",
  ],
  re: [
    "Header: <code>alphabet: {a, b}</code> then one regular expression.",
    "Ops: concat, <code>|</code> union, <code>&amp;</code> intersection, <code>*</code> <code>+</code> <code>?</code>, <code>-re</code> complement.",
    "<code>_</code> empty string, <code>.</code> any alphabet symbol, parentheses for grouping.",
    "Commands: accept, gen_words, compare. Graph is not available for RE.",
  ],
  cfg: [
    "Rules: <code>Start -&gt; X | Y | Start Start</code>. First nonterminal is the start symbol.",
    "RHS is terminals/nonterminals or <code>_</code>. Nonterminals on the RHS must be spaced.",
    "Commands: accept, gen_words, gen_upto_length.",
  ],
  pda: [
    "Accepts by accepting state (stack contents ignored). Input alphabet only — stack symbols can be extra.",
    "Transition: <code>(input, pop -&gt; push, state)</code>. <code>_</code> is ε; empty push is <code>\"\"</code>.",
    "Sets and <code>.</code> work on the input. Leftmost push symbol lands on top of the stack.",
    "Commands: accept, graph, gen_words, gen_upto_length.",
  ],
  tm: [
    "Semi-infinite tape, head starts at the left. Missing transitions implicitly reject.",
    "Move: <code>L</code> left, <code>R</code> right, <code>S</code> start of tape, <code>H</code> stay. <code>_</code> is blank.",
    "<code>.</code> on the left is any tape symbol (including blank); <code>.</code> on the right means “write what was read”.",
    "States <code>accept</code> and <code>reject</code> are reserved. Commands: accept, trace, batch test. Optional step limit.",
  ],
  htm: [
    "Alphabet plus functions. A <code>Main</code> function is required. Leaf TMs use <code>def Name [[ ... ]]</code>.",
    "Non-leaf: sequencing, <code>if [not] Call</code>, <code>while [not] Call</code>, calls, <code>accept</code>/<code>reject</code>.",
    "Parameters are symbol sets, used as <code>$A</code>. Recursion is not allowed.",
    "Commands match TM; traces show function calls, and steps count leaf calls.",
  ],
};

const EXTRA_EXAMPLES = [
  {
    id: "guide-dfa-dot",
    kind: "dfa",
    name: "DFA with dot transitions",
    source: `// Same language, using dot notation for q1.
alphabet: {a, b}
start: q0
accepting: {q0, q2}
q0 (a -> q1) (b -> q2)
q1 (. -> q1)
q2 (a -> q0) (b -> q2)
`,
  },
  {
    id: "guide-re-ops",
    kind: "re",
    name: "RE operator sampler",
    source: `// Not a meaningful language, just showing all the operators.
alphabet: {a, b}
(a(_ | b) & (..)* ) | ((a.a)+ & -(a?b*))
`,
  },
  {
    id: "guide-pda-multi",
    kind: "pda",
    name: "PDA multi-symbol push",
    source: `// An example pushing multiple symbols onto the stack at once.
alphabet: {+, [, ], a}
start: Q0
accepting: {Q2}
Q0 (_, _ -> e$, Q1)
Q1 (_, e -> f+e, Q1)
Q1 (_, e -> f, Q1)
Q1 (_, f -> [e], Q1)
Q1 (_, f -> a, Q1)
Q1 (+, + -> _, Q1)
Q1 ([, [ -> _, Q1)
Q1 (], ] -> _, Q1)
Q1 (a, a -> _, Q1)
Q1 (_, $ -> _, Q2)
`,
  },
  {
    id: "guide-tm-sets",
    kind: "tm",
    name: "TM with sets and dots",
    source: `// Same 0^n 1^n 2^n machine using sets and dot notation.
alphabet: {0, 1, 2, x}
start: q0
q0 (0 -> _,R q1) (x -> x,R q4) (_ -> _,L accept)
q1 ({0,x} -> .,R q1) (1 -> x,R q2)
q2 ({1,x} -> .,R q2) (2 -> x,L q3)
q3 ({0,1,x} -> .,L q3) (_ -> _,R q0)
q4 (x -> x,R q4) (_ -> _,L accept)
`,
  },
];

const state = {
  kind: "dfa",
  command: "accept",
  examples: [],
  viz: null,
};

const els = {
  kinds: document.getElementById("kinds"),
  exampleSelect: document.getElementById("exampleSelect"),
  source: document.getElementById("source"),
  gutter: document.getElementById("gutter"),
  compareWrap: document.getElementById("compareWrap"),
  compareKind: document.getElementById("compareKind"),
  compareSource: document.getElementById("compareSource"),
  compareGutter: document.getElementById("compareGutter"),
  commands: document.getElementById("commands"),
  args: document.getElementById("args"),
  preview: document.getElementById("preview"),
  result: document.getElementById("result"),
  helpTitle: document.getElementById("helpTitle"),
  helpBody: document.getElementById("helpBody"),
  runForm: document.getElementById("runForm"),
  runBtn: document.getElementById("runBtn"),
  fileName: document.getElementById("fileName"),
  uploadBtn: document.getElementById("uploadBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  fileInput: document.getElementById("fileInput"),
  editorDrop: document.getElementById("editorDrop"),
  guideBtn: document.getElementById("guideBtn"),
  guideDialog: document.getElementById("guideDialog"),
  guideText: document.getElementById("guideText"),
};

function currentCommands() {
  return COMMANDS[state.kind];
}

function renderKinds() {
  els.kinds.innerHTML = "";
  for (const kind of KINDS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = kind.label;
    btn.setAttribute("aria-pressed", String(kind.id === state.kind));
    btn.addEventListener("click", () => setKind(kind.id));
    els.kinds.appendChild(btn);
  }
}

function renderCommands() {
  const available = currentCommands();
  if (!available.includes(state.command)) state.command = available[0];
  els.commands.innerHTML = "";
  for (const command of available) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = COMMAND_LABELS[command];
    btn.setAttribute("aria-pressed", String(command === state.command));
    btn.addEventListener("click", () => {
      state.command = command;
      renderCommands();
      renderArgs();
      updatePreview();
    });
    els.commands.appendChild(btn);
  }
}

function renderArgs() {
  const command = state.command;
  const showCompare = command === "compare";
  els.compareWrap.hidden = !showCompare;
  const tmLike = state.kind === "tm" || state.kind === "htm";
  let html = "";
  if (command === "accept" || command === "trace") {
    html += field("string", "Input string", "text", { placeholder: "leave empty for ε" });
    if (tmLike) html += field("steps", "Max steps", "number", { value: "1000", min: "1" });
  } else if (command === "gen_words") {
    html += field("number", "How many words", "number", { value: "10", min: "1" });
  } else if (command === "gen_upto_length") {
    html += field("number", "Max length", "number", { value: "4", min: "0" });
  } else if (command === "accept_file") {
    html += `
      <label class="field"><span>Should accept</span><textarea id="acceptWords" placeholder="one word per line; blank line = ε"></textarea></label>
      <label class="field"><span>Should reject</span><textarea id="rejectWords" placeholder="one word per line"></textarea></label>
    `;
    if (tmLike) html += field("steps", "Max steps", "number", { value: "1000", min: "1" });
  }
  els.args.innerHTML = html;
  if (showCompare) fillCompareDefault();
}

function field(id, label, type, attrs = {}) {
  const extra = Object.entries(attrs)
    .map(([k, v]) => `${k}="${escapeAttr(v)}"`)
    .join(" ");
  return `<label class="field"><span>${label}</span><input id="${id}" type="${type}" ${extra}></label>`;
}

function renderHelp() {
  const meta = KINDS.find((k) => k.id === state.kind);
  els.helpTitle.textContent = `${meta.label} syntax`;
  els.helpBody.innerHTML = `<div class="help-grid">${HELP[state.kind].map((line) => `<p>${line}</p>`).join("")}</div>`;
}

function setKind(kind, { keepSource = false } = {}) {
  state.kind = kind;
  renderKinds();
  renderCommands();
  renderArgs();
  renderHelp();
  fillExampleSelect();
  if (!keepSource) loadDefaultExample();
  syncFileExtension();
  updatePreview();
}

function examplesForKind() {
  return [
    ...state.examples.filter((ex) => ex.kind === state.kind),
    ...EXTRA_EXAMPLES.filter((ex) => ex.kind === state.kind),
  ];
}

function fillExampleSelect() {
  const options = ['<option value="">Choose an example</option>'];
  for (const ex of examplesForKind()) {
    options.push(`<option value="${escapeAttr(ex.id)}">${escapeHtml(ex.title || ex.name)}</option>`);
  }
  els.exampleSelect.innerHTML = options.join("");
}

function fillCompareDefault() {
  if (els.compareSource.value.trim()) return;
  const other = state.examples.find((ex) => ex.kind === "nfa") || EXTRA_EXAMPLES.find((ex) => ex.kind === "nfa");
  if (!other) return;
  els.compareKind.value = other.kind;
  els.compareSource.value = other.source;
  syncGutter(els.compareSource, els.compareGutter);
}

function loadDefaultExample() {
  const first = examplesForKind()[0];
  els.source.value = first ? first.source : "";
  els.exampleSelect.value = first ? first.id : "";
  syncGutter(els.source, els.gutter);
}

function syncGutter(textarea, gutter) {
  const lines = textarea.value.split("\n").length;
  gutter.textContent = Array.from({ length: lines }, (_, i) => i + 1).join("\n");
}

function currentFileName() {
  const typed = els.fileName.value.trim();
  if (!typed) return `machine.${state.kind}`;
  const ext = typed.split(".").pop().toLowerCase();
  if (KINDS.some((kind) => kind.id === ext)) return typed;
  return `${typed}.${state.kind}`;
}

function syncFileExtension() {
  els.fileName.placeholder = `machine.${state.kind}`;
  const typed = els.fileName.value.trim();
  const dot = typed.lastIndexOf(".");
  if (dot <= 0) return;
  const ext = typed.slice(dot + 1).toLowerCase();
  if (KINDS.some((kind) => kind.id === ext) && ext !== state.kind) {
    els.fileName.value = `${typed.slice(0, dot)}.${state.kind}`;
  }
}

function updatePreview() {
  const file = currentFileName();
  let extra = "";
  const command = state.command;
  if (command === "accept" || command === "trace") {
    const value = document.getElementById("string")?.value ?? "";
    extra = value === "" ? ' ""' : ` ${JSON.stringify(value)}`;
    const steps = document.getElementById("steps")?.value;
    if (steps) extra += ` ${steps}`;
  } else if (command === "gen_words" || command === "gen_upto_length") {
    extra = ` ${document.getElementById("number")?.value || ""}`;
  } else if (command === "graph") {
    extra = " diagram";
  } else if (command === "compare") {
    extra = ` other.${els.compareKind.value}`;
  } else if (command === "accept_file") {
    extra = " tests.txt";
    const steps = document.getElementById("steps")?.value;
    if (steps) extra += ` ${steps}`;
  }
  els.preview.textContent = `mentor ${file} ${command}${extra}`;
}

function splitWords(text) {
  return (text || "").split("\n").map((line) => line.replace(/\r$/, ""));
}

async function runMentor(event) {
  event.preventDefault();
  els.runBtn.disabled = true;
  els.result.innerHTML = `<p class="placeholder">Running Mentor…</p>`;
  const payload = {
    kind: state.kind,
    source: els.source.value,
    command: state.command,
  };
  if (state.command === "accept" || state.command === "trace") {
    payload.string = document.getElementById("string")?.value ?? "";
    const steps = document.getElementById("steps")?.value;
    if (steps) payload.steps = Number(steps);
  } else if (state.command === "gen_words" || state.command === "gen_upto_length") {
    payload.number = Number(document.getElementById("number")?.value || 0);
  } else if (state.command === "compare") {
    payload.compare_kind = els.compareKind.value;
    payload.compare_source = els.compareSource.value;
  } else if (state.command === "accept_file") {
    payload.accept_words = splitWords(document.getElementById("acceptWords")?.value);
    payload.reject_words = splitWords(document.getElementById("rejectWords")?.value);
    const steps = document.getElementById("steps")?.value;
    if (steps) payload.steps = Number(steps);
  }
  try {
    const response = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    await renderResult(data);
  } catch (err) {
    els.result.innerHTML = `<div class="banner error">ERROR</div><pre class="err">${escapeHtml(err.message)}</pre>`;
  } finally {
    els.runBtn.disabled = false;
  }
}

async function renderResult(data) {
  const chunks = [];
  const verdict = classify(data);
  if (verdict) chunks.push(`<div class="banner ${verdict.cls}">${verdict.label}</div>`);
  if (data.command === "graph" && (data.dot || data.svg)) {
    chunks.push(await renderGraph(data));
  } else if (data.command === "trace" && data.kind === "tm" && data.stdout) {
    chunks.push(renderTape(data.stdout));
  } else if ((data.command === "gen_words" || data.command === "gen_upto_length") && data.stdout) {
    chunks.push(renderWords(data.stdout));
  } else if (data.stdout) {
    chunks.push(`<pre class="out">${escapeHtml(data.stdout)}</pre>`);
  }
  if (data.stderr) chunks.push(`<pre class="err">${escapeHtml(data.stderr)}</pre>`);
  if (data.error && !data.stderr) chunks.push(`<pre class="err">${escapeHtml(data.error)}</pre>`);
  if (data.timed_out) chunks.push(`<div class="banner warn">TIMEOUT</div>`);
  els.result.innerHTML = chunks.join("") || `<p class="placeholder">No output.</p>`;
}

function classify(data) {
  const text = `${data.stdout || ""}\n${data.stderr || ""}\n${data.error || ""}`;
  if (data.timed_out) return { cls: "warn", label: "TIMEOUT" };
  if (/Input is accepted/.test(text)) return { cls: "accept", label: "ACCEPTED" };
  if (/Input is not accepted/.test(text)) return { cls: "reject", label: "REJECTED" };
  if (/All inputs correctly categorized/.test(text)) return { cls: "accept", label: "BATCH OK" };
  if (/are equivalent/.test(text)) return { cls: "accept", label: "EQUIVALENT" };
  if (/should be accepted|should be rejected/.test(text)) return { cls: "reject", label: "NOT EQUIVALENT" };
  if (!data.ok) return { cls: "error", label: "FAILED" };
  return null;
}

function renderWords(stdout) {
  const words = stdout.split(/\n/).filter((line) => line.length > 0);
  const chips = words
    .map((word) => {
      const label = word === "ε" || word === "" ? "ε" : word;
      const cls = label === "ε" ? "eps" : "";
      return `<span class="${cls}">${escapeHtml(label)}</span>`;
    })
    .join("");
  return `<p class="placeholder">${words.length} word${words.length === 1 ? "" : "s"} in shortlex order</p><div class="words">${chips}</div>`;
}

function prepareDot(dot) {
  if (/rankdir\s*=/.test(dot)) return dot;
  return dot.replace(/digraph\s*\{/, "digraph {\n  rankdir=LR;\n  ranksep=0.4;\n  nodesep=0.3;");
}

async function renderGraph(data) {
  const dot = prepareDot(data.dot || "");
  if (data.svg && /rankdir\s*=/.test(data.dot || "")) {
    return `<div class="graph">${data.svg}</div>`;
  }
  try {
    if (!state.viz) state.viz = await vizInstance();
    const svg = state.viz.renderSVGElement(dot);
    return `<div class="graph">${svg.outerHTML}</div>`;
  } catch (err) {
    return `<pre class="out">${escapeHtml(dot)}</pre><pre class="err">${escapeHtml(err.message)}</pre>`;
  }
}

function renderTape(stdout) {
  const rows = stdout
    .split("\n")
    .map((line) => parseConfig(line))
    .filter(Boolean);
  if (!rows.length) return `<pre class="out">${escapeHtml(stdout)}</pre>`;
  const html = rows
    .map((row, i) => {
      const cells = [...row.left, ...row.right].map((ch, idx) => {
        const isHead = idx === row.left.length;
        return `<span class="cell${isHead ? " head" : ""}">${escapeHtml(ch === " " ? "␣" : ch)}</span>`;
      });
      if (!row.right.length) cells.push(`<span class="cell head">␣</span>`);
      return `<div class="tape-row"><div class="tape-meta">step ${i} · ${escapeHtml(row.state)}</div><div class="tape-cells">${cells.join("")}</div></div>`;
    })
    .join("");
  return `<div class="tape">${html}</div><pre class="out">${escapeHtml(stdout)}</pre>`;
}

function parseConfig(line) {
  const match = line.match(/^(.*)\|([^|]+)\|(.*)$/);
  if (!match) return null;
  return {
    left: [...match[1]],
    state: match[2],
    right: match[3] === "" ? ["_"] : [...match[3]],
  };
}

function bindEditor(textarea, gutter) {
  const sync = () => syncGutter(textarea, gutter);
  textarea.addEventListener("input", sync);
  textarea.addEventListener("scroll", () => {
    gutter.scrollTop = textarea.scrollTop;
  });
  sync();
}

function downloadSource() {
  const blob = new Blob([els.source.value], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName();
  a.click();
  URL.revokeObjectURL(a.href);
}

function openFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  file.text().then((text) => {
    if (KINDS.some((k) => k.id === ext)) setKind(ext, { keepSource: true });
    els.fileName.value = file.name;
    els.source.value = text;
    syncGutter(els.source, els.gutter);
  });
}

function guideId(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function guideInline(text) {
  return escapeHtml(text)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\(#([^)]+)\)/g, '<a href="#$2">$1</a>');
}

function renderGuide(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].trim() === "") {
      i += 1;
      continue;
    }
    if (lines[i].startsWith("```")) {
      const code = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) {
        code.push(lines[i]);
        i += 1;
      }
      i += 1;
      blocks.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(lines[i]);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      blocks.push(`<h${level} id="${guideId(text)}">${guideInline(text)}</h${level}>`);
      i += 1;
      continue;
    }
    if (/^[-•]\s+/.test(lines[i])) {
      const items = [];
      while (i < lines.length && /^[-•]\s+/.test(lines[i])) {
        items.push(`<li>${guideInline(lines[i].replace(/^[-•]\s+/, ""))}</li>`);
        i += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\d+\.\s+/.test(lines[i])) {
      const items = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${guideInline(lines[i].replace(/^\d+\.\s+/, ""))}</li>`);
        i += 1;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    const paragraph = [lines[i]];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !/^#{1,4}\s/.test(lines[i]) &&
      !/^[-•]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i])
    ) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(`<p>${guideInline(paragraph.join(" "))}</p>`);
  }
  return blocks.join("");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

async function init() {
  renderKinds();
  renderCommands();
  renderArgs();
  renderHelp();
  bindEditor(els.source, els.gutter);
  bindEditor(els.compareSource, els.compareGutter);
  els.runForm.addEventListener("submit", runMentor);
  els.runForm.addEventListener("input", updatePreview);
  els.compareKind.addEventListener("change", updatePreview);
  els.uploadBtn.addEventListener("click", () => els.fileInput.click());
  els.fileName.addEventListener("input", updatePreview);
  els.downloadBtn.addEventListener("click", downloadSource);
  els.fileInput.addEventListener("change", () => {
    const file = els.fileInput.files[0];
    if (file) openFile(file);
    els.fileInput.value = "";
  });
  els.editorDrop.addEventListener("dragover", (event) => event.preventDefault());
  els.editorDrop.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];
    if (file) openFile(file);
  });
  els.exampleSelect.addEventListener("change", () => {
    const ex = [...state.examples, ...EXTRA_EXAMPLES].find((item) => item.id === els.exampleSelect.value);
    if (ex) {
      els.fileName.value = ex.id;
      els.source.value = ex.source;
      syncGutter(els.source, els.gutter);
      updatePreview();
    }
  });
  els.guideText.addEventListener("click", (event) => {
    const link = event.target.closest("a[href^='#']");
    if (!link) return;
    event.preventDefault();
    const target = els.guideText.querySelector(link.getAttribute("href"));
    if (target) target.scrollIntoView({ block: "start" });
  });
  els.guideBtn.addEventListener("click", async () => {
    if (!els.guideText.dataset.loaded) {
      const res = await fetch("/api/guide");
      const data = await res.json();
      if (data.error) els.guideText.textContent = data.error;
      else els.guideText.innerHTML = renderGuide(data.text || "");
      els.guideText.dataset.loaded = "1";
    }
    els.guideDialog.showModal();
  });
  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      els.runForm.requestSubmit();
    }
  });
  try {
    const res = await fetch("/api/examples");
    state.examples = await res.json();
  } catch {
    state.examples = [];
  }
  fillExampleSelect();
  els.source.value = "";
  els.exampleSelect.value = "";
  syncGutter(els.source, els.gutter);
  updatePreview();
}

init();
