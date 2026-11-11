/**
 * scripts/audition/page.ts
 * Builds the self-contained blind listening page. DEVELOPMENT-ONLY.
 * The page holds letters, never provider or voice names; the key is a separate
 * file that only the scorer reads.
 */

export type PageData = {
  round: number;
  title: string;
  characters: Array<{
    id: string;
    name: string;
    role: string;
    want: string;
    lines: Array<{ text: string; source: string }>;
    /** letter -> list of audio paths, one per line (relative to the page) */
    voices: Record<string, string[]>;
  }>;
};

const CRITERIA: Array<{ key: string; label: string; help: string }> = [
  { key: "authenticity", label: "Believable person", help: "Sounds like a real person of 1981 small-town New Hampshire, not an assistant reading a script" },
  { key: "emotion", label: "Feeling and restraint", help: "Tension, hesitation, reserve; changes of mood without melodrama" },
  { key: "consistency", label: "Same person throughout", help: "Stays one voice and one manner across all the lines; no robotic or flat moments" },
  { key: "clarity", label: "Clear on a phone speaker", help: "Every word easy to follow, even played quietly" },
];

export function buildPage(data: PageData): string {
  const json = JSON.stringify({ data, criteria: CRITERIA }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(data.title)}</title>
<style>
  :root { color-scheme: dark; --bg:#14110e; --card:#1d1814; --line:#3a3027; --text:#ece4d8; --muted:#a39889; --amber:#e0a458; }
  * { box-sizing: border-box; }
  body { margin:0; font:16px/1.5 system-ui, sans-serif; background:var(--bg); color:var(--text); }
  header { padding:16px 24px; border-bottom:1px solid var(--line); display:flex; gap:16px; flex-wrap:wrap; align-items:center; }
  h1 { font-size:18px; margin:0; font-weight:600; }
  main { max-width:900px; margin:0 auto; padding:24px; }
  label { color:var(--muted); font-size:14px; }
  input[type=text], textarea { background:#120f0c; color:var(--text); border:1px solid var(--line); border-radius:6px; padding:8px; font:inherit; }
  textarea { width:100%; min-height:56px; }
  nav { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px; }
  button { background:var(--card); color:var(--text); border:1px solid var(--line); border-radius:6px; padding:8px 14px; font:inherit; cursor:pointer; }
  button:hover, button:focus-visible { border-color:var(--amber); outline:none; }
  button[aria-pressed=true] { border-color:var(--amber); background:#3a2a16; }
  .brief { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:16px; margin-bottom:20px; }
  .brief p { margin:4px 0 0; color:var(--muted); }
  .voice { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:16px; margin-bottom:20px; }
  .voice h2 { margin:0 0 12px; font-size:20px; display:flex; gap:12px; align-items:center; }
  .row { display:grid; grid-template-columns:28px 1fr; gap:8px 12px; margin:10px 0; }
  .row .n { color:var(--muted); text-align:right; padding-top:2px; }
  .row .t { color:var(--text); font-size:15px; }
  .row .tag { color:var(--muted); font-size:12px; }
  audio { width:100%; margin-top:6px; height:36px; }
  .scores { display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; margin-top:16px; }
  .scores div { display:flex; flex-direction:column; gap:2px; }
  .scores .help { color:var(--muted); font-size:12px; }
  .verdict { margin-top:12px; display:flex; gap:16px; flex-wrap:wrap; }
  .done { color:var(--amber); font-size:14px; }
  .hint { color:var(--muted); font-size:14px; }
  @media (max-width:640px) { .scores { grid-template-columns:1fr; } }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(data.title)}</h1>
  <label>Your name <input id="who" type="text" size="14" placeholder="e.g. Nilesh" autocomplete="off"></label>
  <button id="export" type="button">Save my scores</button>
  <span id="status" class="hint" role="status"></span>
</header>
<main>
  <p class="hint">Listen to each voice read the same lines. You are not told which voice is which. Score what you hear on the sliders (1 poor, 10 excellent), say whether you would accept the voice, and add a note about anything odd. Your scores save in this browser as you go.</p>
  <nav id="tabs" aria-label="Characters"></nav>
  <section id="panel"></section>
</main>
<script>
const { data, criteria } = ${json};
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const k of kids) e.append(k);
  return e;
};
const storeKey = () => "rn-audition-r" + data.round + "-" + ($("#who").value.trim().toLowerCase() || "anon");
let state = {};
const load = () => { try { state = JSON.parse(localStorage.getItem(storeKey()) || "{}"); } catch { state = {}; } };
const save = () => { localStorage.setItem(storeKey(), JSON.stringify(state)); $("#status").textContent = "Saved " + new Date().toLocaleTimeString(); };
const slot = (cid, letter) => ((state[cid] ||= {})[letter] ||= { scores: {}, verdict: "", notes: "" });
let current = data.characters[0].id;

function renderTabs() {
  const tabs = $("#tabs"); tabs.replaceChildren();
  for (const c of data.characters) {
    const complete = Object.keys(c.voices).every((l) => criteria.every((k) => slot(c.id, l).scores[k.key]) && slot(c.id, l).verdict);
    const b = el("button", { type: "button", "aria-pressed": String(c.id === current), onclick: () => { current = c.id; render(); } }, c.name + (complete ? " ✓" : ""));
    tabs.append(b);
  }
}

function render() {
  renderTabs();
  const c = data.characters.find((x) => x.id === current);
  const panel = $("#panel"); panel.replaceChildren();
  panel.append(el("div", { class: "brief" }, el("strong", {}, c.name + " — " + c.role), el("p", {}, "Listen for: " + c.want)));
  for (const letter of Object.keys(c.voices)) {
    const s = slot(c.id, letter);
    const card = el("div", { class: "voice" });
    const audios = [];
    const playAll = el("button", { type: "button", onclick: () => { let i = 0; const next = () => { if (i >= audios.length) return; const a = audios[i++]; a.onended = next; a.play(); }; audios.forEach((a) => { a.pause(); a.currentTime = 0; }); next(); } }, "Play all lines");
    card.append(el("h2", {}, "Voice " + letter, playAll));
    c.lines.forEach((line, i) => {
      const a = el("audio", { controls: "", preload: "none", src: c.voices[letter][i], "aria-label": "Voice " + letter + ", line " + (i + 1) });
      audios.push(a);
      card.append(el("div", { class: "row" }, el("div", { class: "n" }, String(i + 1)), el("div", {}, el("div", { class: "t" }, line.text), el("div", { class: "tag" }, line.source === "playtest" ? "a real reply from the playtest" : line.source === "narration" ? "scripted narration" : "authored line"), a)));
    });
    const grid = el("div", { class: "scores" });
    for (const k of criteria) {
      const out = el("output", {}, String(s.scores[k.key] || "–"));
      const input = el("input", { type: "range", min: "1", max: "10", step: "1", value: String(s.scores[k.key] || 5), id: "s-" + c.id + letter + k.key, "aria-label": k.label });
      input.addEventListener("input", () => { s.scores[k.key] = Number(input.value); out.textContent = input.value; save(); renderTabs(); });
      grid.append(el("div", {}, el("label", { for: input.id }, k.label + ": ", out), input, el("span", { class: "help" }, k.help)));
    }
    card.append(grid);
    const verdict = el("div", { class: "verdict", role: "radiogroup", "aria-label": "Would you accept this voice?" }, el("span", { class: "hint" }, "Would you accept this voice?"));
    for (const [v, label] of [["yes", "Yes"], ["maybe", "Maybe"], ["no", "No"]]) {
      const r = el("input", { type: "radio", name: "v-" + c.id + letter, value: v, id: "v-" + c.id + letter + v });
      if (s.verdict === v) r.checked = true;
      r.addEventListener("change", () => { s.verdict = v; save(); renderTabs(); });
      verdict.append(el("label", { for: r.id }, r, " " + label));
    }
    card.append(verdict);
    const notes = el("textarea", { placeholder: "Anything odd? Which line numbers sounded robotic, flat or wrong?", "aria-label": "Notes for voice " + letter });
    notes.value = s.notes || "";
    notes.addEventListener("input", () => { s.notes = notes.value; save(); });
    card.append(el("div", { style: "margin-top:12px" }, notes));
    panel.append(card);
  }
}

$("#who").addEventListener("change", () => { load(); render(); });
$("#export").addEventListener("click", () => {
  const who = $("#who").value.trim();
  if (!who) { $("#status").textContent = "Enter your name first."; $("#who").focus(); return; }
  const blob = new Blob([JSON.stringify({ round: data.round, listener: who, savedAt: new Date().toISOString(), scores: state }, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: "scores-round" + data.round + "-" + who.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".json" });
  document.body.append(a); a.click(); a.remove();
  $("#status").textContent = "Saved a file to your Downloads folder. Move it into this round's folder.";
});
load(); render();
</script>
</body>
</html>
`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}
