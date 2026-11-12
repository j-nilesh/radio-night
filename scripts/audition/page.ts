/**
 * scripts/audition/page.ts
 * Builds the self-contained blind listening page. DEVELOPMENT-ONLY.
 * The page holds letters, never provider or voice names; the key is a separate
 * file that only the scorer and the shortlist builder read.
 *
 * Two modes:
 *   triage  quick sieve: Keep / Maybe / Drop on each option, plus a note
 *   score   full scoring: sliders, a verdict and a note
 */

export type Criterion = { key: string; label: string; help: string };

export type PageItem = {
  id: string;
  /** Tab group, for example "Character voices" or "Room sounds" */
  group?: string;
  name: string;
  role: string;
  want: string;
  /** What is being judged for this item: "Voice" (default), "Sound" or "Music" */
  noun?: string;
  /** Score sliders for this item (the four keys must stay authenticity, emotion, consistency, clarity) */
  criteria?: Criterion[];
  /** Play this item's clips on repeat (looping ambience) */
  loop?: boolean;
  lines: Array<{ text: string; source: string }>;
  /** letter -> audio paths, one per line (relative to the page) */
  voices: Record<string, string[]>;
};

export type PageData = {
  round: number | string;
  mode?: "triage" | "score";
  title: string;
  /** Introductory paragraph; a default is used for each mode */
  intro?: string;
  /** Default score sliders, used by items that do not carry their own */
  criteria?: Criterion[];
  /** Placeholder for the notes box */
  notesHint?: string;
  characters: PageItem[];
};

const CRITERIA: Criterion[] = [
  { key: "authenticity", label: "Believable person", help: "Sounds like a real person of 1981 small-town New Hampshire, not an assistant reading a script" },
  { key: "emotion", label: "Feeling and restraint", help: "Tension, hesitation, reserve; changes of mood without melodrama" },
  { key: "consistency", label: "Same person throughout", help: "Stays one voice and one manner across all the lines; no robotic or flat moments" },
  { key: "clarity", label: "Clear on a phone speaker", help: "Every word easy to follow, even played quietly" },
];

const DEFAULT_INTRO = {
  triage:
    "Step 1: a quick sieve. Listen to each option (you are not told where it came from) and mark it Keep, Maybe or Drop. Drop the clear misses without agonising; keep the ones you would be glad to hear in the game; use Maybe for the unsure. Add a note if something specific is wrong, such as which line sounded robotic. Then press Save my shortlist. Your marks save in this browser as you go.",
  score:
    "Step 2: listen to each option without knowing where it came from. Score what you hear on the sliders (1 poor, 10 excellent), say whether you would accept it, and add a note about anything odd. Please score on your own, without comparing with anyone else first. Your scores save in this browser as you go.",
} as const;

export function buildPage(data: PageData): string {
  const mode = data.mode ?? "score";
  const json = JSON.stringify({ data: { ...data, mode }, criteria: data.criteria ?? CRITERIA, defaultIntro: DEFAULT_INTRO[mode] }).replace(/</g, "\\u003c");
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
  nav { display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-bottom:16px; }
  .group { color:var(--muted); font-size:12px; text-transform:uppercase; letter-spacing:.08em; margin-left:12px; }
  .group:first-child { margin-left:0; }
  button { background:var(--card); color:var(--text); border:1px solid var(--line); border-radius:6px; padding:8px 14px; font:inherit; cursor:pointer; }
  button:hover, button:focus-visible { border-color:var(--amber); outline:none; }
  button[aria-pressed=true] { border-color:var(--amber); background:#3a2a16; }
  .brief { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:16px; margin-bottom:20px; }
  .brief p { margin:4px 0 0; color:var(--muted); }
  .voice { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:16px; margin-bottom:20px; }
  .voice.dropped { opacity:.45; }
  .voice.keep { border-color:#6d8f4e; }
  .voice h2 { margin:0 0 12px; font-size:20px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  .row { display:grid; grid-template-columns:28px 1fr; gap:8px 12px; margin:10px 0; }
  .row .n { color:var(--muted); text-align:right; padding-top:2px; }
  .row .t { color:var(--text); font-size:15px; }
  .row .tag { color:var(--muted); font-size:12px; }
  audio { width:100%; margin-top:6px; height:36px; }
  .scores { display:grid; grid-template-columns:1fr 1fr; gap:12px 24px; margin-top:16px; }
  .scores div { display:flex; flex-direction:column; gap:2px; }
  .scores .help { color:var(--muted); font-size:12px; }
  .verdict { margin-top:12px; display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
  .verdict label { color:var(--text); }
  .hint { color:var(--muted); font-size:14px; }
  @media (max-width:640px) { .scores { grid-template-columns:1fr; } }
</style>
</head>
<body>
<header>
  <h1>${escapeHtml(data.title)}</h1>
  <label>Your name <input id="who" type="text" size="14" placeholder="e.g. Nilesh" autocomplete="off"></label>
  <button id="export" type="button"></button>
  <label id="hideWrap" style="display:none"><input id="hide" type="checkbox"> Hide the ones I dropped</label>
  <span id="status" class="hint" role="status"></span>
</header>
<main>
  <p class="hint" id="intro"></p>
  <nav id="tabs" aria-label="Sections"></nav>
  <section id="panel"></section>
</main>
<script>
const { data, criteria, defaultIntro } = ${json};
const triage = data.mode === "triage";
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v);
  }
  for (const k of kids) e.append(k);
  return e;
};
$("#intro").textContent = data.intro || defaultIntro;
$("#export").textContent = triage ? "Save my shortlist" : "Save my scores";
if (triage) $("#hideWrap").style.display = "";
const storeKey = () => "rn-audition-" + data.round + "-" + ($("#who").value.trim().toLowerCase() || "anon");
let state = {};
const load = () => { try { state = JSON.parse(localStorage.getItem(storeKey()) || "{}"); } catch { state = {}; } };
const save = () => { localStorage.setItem(storeKey(), JSON.stringify(state)); $("#status").textContent = "Saved " + new Date().toLocaleTimeString(); };
const slot = (cid, letter) => ((state[cid] ||= {})[letter] ||= { scores: {}, verdict: "", notes: "" });
let current = data.characters[0].id;
const VERDICTS = triage ? [["keep", "Keep"], ["maybe", "Maybe"], ["drop", "Drop"]] : [["yes", "Yes"], ["maybe", "Maybe"], ["no", "No"]];

function itemComplete(c) {
  return Object.keys(c.voices).every((l) => {
    const s = slot(c.id, l);
    if (!s.verdict) return false;
    return triage ? true : (c.criteria || criteria).every((k) => s.scores[k.key]);
  });
}

function renderTabs() {
  const tabs = $("#tabs"); tabs.replaceChildren();
  let lastGroup = null;
  for (const c of data.characters) {
    if (c.group && c.group !== lastGroup) { tabs.append(el("span", { class: "group" }, c.group)); lastGroup = c.group; }
    tabs.append(el("button", { type: "button", "aria-pressed": String(c.id === current), onclick: () => { current = c.id; render(); } }, c.name + (itemComplete(c) ? " ✓" : "")));
  }
}

function render() {
  renderTabs();
  const c = data.characters.find((x) => x.id === current);
  const noun = c.noun || "Voice";
  const crit = c.criteria || criteria;
  const hide = triage && $("#hide").checked;
  const panel = $("#panel"); panel.replaceChildren();
  panel.append(el("div", { class: "brief" }, el("strong", {}, c.name + " — " + c.role), el("p", {}, "Listen for: " + c.want)));
  for (const letter of Object.keys(c.voices)) {
    const s = slot(c.id, letter);
    if (hide && s.verdict === "drop") continue;
    const card = el("div", { class: "voice" + (triage && s.verdict === "drop" ? " dropped" : "") + (triage && s.verdict === "keep" ? " keep" : "") });
    const audios = [];
    const playAll = el("button", { type: "button", onclick: () => { let i = 0; const next = () => { if (i >= audios.length) return; const a = audios[i++]; a.onended = next; a.play(); }; audios.forEach((a) => { a.pause(); a.currentTime = 0; }); next(); } }, "Play all");
    const title = el("h2", {}, noun + " " + letter, playAll);

    // Verdict buttons sit in the heading in triage so a decision is one tap
    const verdict = el("div", { class: "verdict", role: "radiogroup", "aria-label": (triage ? "Keep this " : "Would you accept this ") + noun.toLowerCase() + "?" });
    verdict.append(el("span", { class: "hint" }, triage ? "Your call:" : "Would you accept this " + noun.toLowerCase() + "?"));
    for (const [v, label] of VERDICTS) {
      const r = el("input", { type: "radio", name: "v-" + c.id + letter, value: v, id: "v-" + c.id + letter + v });
      if (s.verdict === v) r.checked = true;
      r.addEventListener("change", () => {
        s.verdict = v; save(); renderTabs();
        // Triage: restyle this card in place so playing audio and the scroll position are not disturbed
        if (triage && hide && v === "drop") render();
        else if (triage) card.className = "voice" + (v === "drop" ? " dropped" : "") + (v === "keep" ? " keep" : "");
      });
      verdict.append(el("label", { for: r.id }, r, " " + label));
    }

    card.append(title);
    if (triage) card.append(verdict);
    c.lines.forEach((line, i) => {
      const a = el("audio", { controls: "", preload: "none", src: c.voices[letter][i], ...(c.loop ? { loop: "" } : {}), "aria-label": noun + " " + letter + ", clip " + (i + 1) });
      audios.push(a);
      card.append(el("div", { class: "row" }, el("div", { class: "n" }, String(i + 1)), el("div", {}, el("div", { class: "t" }, line.text), el("div", { class: "tag" }, line.source === "playtest" ? "a real reply from the playtest" : line.source === "narration" ? "scripted narration" : line.source === "cue" ? "what this is for" : "authored line"), a)));
    });
    if (!triage) {
      const grid = el("div", { class: "scores" });
      for (const k of crit) {
        const out = el("output", {}, String(s.scores[k.key] || "–"));
        const input = el("input", { type: "range", min: "1", max: "10", step: "1", value: String(s.scores[k.key] || 5), id: "s-" + c.id + letter + k.key, "aria-label": k.label });
        input.addEventListener("input", () => { s.scores[k.key] = Number(input.value); out.textContent = input.value; save(); renderTabs(); });
        grid.append(el("div", {}, el("label", { for: input.id }, k.label + ": ", out), input, el("span", { class: "help" }, k.help)));
      }
      card.append(grid, verdict);
    }
    const notes = el("textarea", { placeholder: data.notesHint || "Anything odd? Which clip numbers sounded robotic, flat or wrong?", "aria-label": "Notes for " + noun.toLowerCase() + " " + letter });
    notes.value = s.notes || "";
    notes.addEventListener("input", () => { s.notes = notes.value; save(); });
    card.append(el("div", { style: "margin-top:12px" }, notes));
    panel.append(card);
  }
}

$("#who").addEventListener("change", () => { load(); render(); });
$("#hide").addEventListener("change", render);
$("#export").addEventListener("click", () => {
  const who = $("#who").value.trim();
  if (!who) { $("#status").textContent = "Enter your name first."; $("#who").focus(); return; }
  const file = (triage ? "shortlist-" : "scores-") + "round" + data.round + "-" + who.toLowerCase().replace(/[^a-z0-9]+/g, "-") + ".json";
  const body = { kind: triage ? "shortlist" : "scores", round: data.round, listener: who, savedAt: new Date().toISOString(), scores: state };
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: "application/json" });
  const a = el("a", { href: URL.createObjectURL(blob), download: file });
  document.body.append(a); a.click(); a.remove();
  $("#status").textContent = "Saved " + file + " to your Downloads folder. Move it into this round's folder.";
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
