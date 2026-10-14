/**
 * JSON for a `<script type="application/ld+json">` body. `<` becomes the six
 * characters `<` (still the same string to a JSON parser), so no value can
 * write `</script>` or `<!--` into the page; U+2028/2029 are escaped as well.
 */
const LINE_SEPARATORS = new RegExp("[\\u2028\\u2029]", "g");

export function jsonLdString(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(LINE_SEPARATORS, (c) => "\\u" + c.charCodeAt(0).toString(16));
}
