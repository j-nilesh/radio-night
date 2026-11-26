/**
 * ai-orchestration/address.ts
 * Notices when the detective speaks to one person but names another as the one
 * being addressed: "So, Carol, where were you?" asked of Edna.
 *
 * Only a direct address counts, not a mention. "Carol, where were you?" and
 * "Where were you, Carol?" address Carol; "What did Carol say?" and "Was Carol
 * here earlier?" are questions about Carol, put to whoever is listening, and
 * must still work. When in doubt this says nothing: wrongly refusing a fair
 * question costs more than letting a misdirected one through.
 *
 * Names come from the case (first name, full name, surname when it is not
 * shared, plus any `aliases` such as "Mrs. Wentworth"). The detector never
 * reads anything but text it is given and returns only a name from the case.
 */
export type Addressable = { id: string; name: string; aliases?: string[] };

export type Misaddress = {
  /** The character the detective seems to be speaking to */
  id: string;
  /** How to refer to them, taken from the case, never from the player's text */
  alias: string;
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "Mrs. Wentworth" also matches "Mrs Wentworth". */
const aliasPattern = (alias: string) => escape(alias).replace(/\\\./g, "\\.?").replace(/\s+/g, "\\s+");

const FILLER = "(?:so|well|now|okay|ok|and|right|hey|hello|hi|listen|look|excuse me|pardon me|tell me|please|detective|oh|um|uh)";
const QUESTION_WORD = "(?:where|what|why|how|when|who|tell|you|your)";

type Entry = { id: string; alias: string; re: RegExp[] };

function entries(people: Addressable[]): Entry[] {
  const surnameCount = new Map<string, number>();
  for (const p of people) {
    const sur = p.name.split(/\s+/).slice(-1)[0].toLowerCase();
    surnameCount.set(sur, (surnameCount.get(sur) ?? 0) + 1);
  }
  const out: Entry[] = [];
  for (const p of people) {
    const parts = p.name.split(/\s+/);
    const surname = parts[parts.length - 1];
    const names = new Set<string>([p.name, parts[0], ...(p.aliases ?? [])]);
    // A surname alone is only an address when it points at one person.
    if (parts.length > 1 && surnameCount.get(surname.toLowerCase()) === 1) names.add(surname);
    for (const alias of names) {
      const a = aliasPattern(alias);
      out.push({
        id: p.id,
        alias,
        re: [
          // At the start: "So, Carol, ..." / "Hey Carol, ..." / "Carol where were you"
          new RegExp(`^\\W*(?:${FILLER}\\b[\\s,]*)*(${a})(?:\\s*[,:;!?.]|\\s+${QUESTION_WORD}\\b)`, "i"),
          // At the end: "..., Carol?"
          new RegExp(`,\\s*(${a})\\s*[?.!]*\\s*$`, "i"),
          // In the middle, set off by commas: "You said, Ray, that ..."
          new RegExp(`,\\s*(${a})\\s*,`, "i"),
        ],
      });
    }
  }
  // Longer names first, so "Ray Kowalski" is found as a whole before "Ray".
  return out.sort((x, y) => y.alias.length - x.alias.length);
}

/**
 * The person the detective is addressing, if it is someone other than the
 * person listening. Returns null when the listener is addressed, when nobody is
 * named as a direct address, or when there is no listener.
 */
export function findMisaddress(text: string, listenerId: string | undefined, people: Addressable[]): Misaddress | null {
  if (!listenerId) return null;
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return null;
  let firstOther: { index: number; hit: Misaddress } | null = null;
  for (const entry of entries(people)) {
    for (const re of entry.re) {
      const m = re.exec(t);
      if (!m) continue;
      if (entry.id === listenerId) return null; // the listener is addressed too: nothing is wrong
      const index = m.index + m[0].toLowerCase().indexOf(m[1].toLowerCase());
      if (!firstOther || index < firstOther.index) firstOther = { index, hit: { id: entry.id, alias: entry.alias } };
    }
  }
  return firstOther?.hit ?? null;
}
