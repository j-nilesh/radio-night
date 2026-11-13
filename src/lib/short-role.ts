/**
 * lib/short-role.ts
 * Short forms of the roles on the character cards. A role in the case data can
 * be a full description ("Local businessman, owner of Millhaven Lumber Supply");
 * a small card wants the part that says who they are ("Local businessman").
 */

/** The first clause of a role: up to the first comma or " at ". */
export function shortRole(role: string): string {
  const first = role.split(",")[0].split(/\s+at\s+/i)[0].trim();
  return first.length > 0 ? first : role.trim();
}

/** Up to two capital letters for a portrait that has not loaded: "Ray Kowalski" -> "RK". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
