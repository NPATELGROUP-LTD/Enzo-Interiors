/** http(s):// or www. up to the next space, without trailing punctuation. */
const URL_RE = /((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi;

/** Text and links in order: odd indexes are the links. */
export function linkParts(text: string): string[] {
  return text.split(URL_RE);
}

/** Where a link goes: www. addresses get https://. */
export function linkHref(part: string): string {
  return /^www\./i.test(part) ? `https://${part}` : part;
}
