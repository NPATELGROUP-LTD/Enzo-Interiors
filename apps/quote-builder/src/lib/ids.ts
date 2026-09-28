// crypto.randomUUID only exists in secure contexts, and the dev server is
// also opened over plain http on the LAN (see next.config.ts), so ids come
// from a short random string instead.
export function makeId(prefix: string): string {
  const random = Math.random().toString(36).slice(2, 10);
  const time = Date.now().toString(36).slice(-4);
  return `${prefix}_${time}${random}`;
}

export function makeReference(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const tag = Array.from({ length: 2 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  return `EZ-${tag}${n}`;
}
