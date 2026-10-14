import sanitizeHtml from 'sanitize-html';

/**
 * A campaign body as an admin wrote it, made safe to store and send.
 *
 * Styling is kept — inline `style=""` on anything, and the table layout
 * attributes email still relies on — because that is the point of writing
 * HTML. What goes: scripts, event handlers, forms, iframes, and any link or
 * image that is not http(s) (so no `javascript:`). Email clients strip most
 * of that anyway; this does it for the ones that do not.
 */
export function cleanCampaignHtml(html: string): string {
  const layout = ['style', 'align', 'valign', 'width', 'height', 'bgcolor', 'class'];
  return sanitizeHtml(html, {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'center'],
    allowedAttributes: {
      '*': layout,
      a: [...layout, 'href', 'title', 'target', 'rel'],
      img: [...layout, 'src', 'alt', 'border'],
      table: [...layout, 'role', 'cellpadding', 'cellspacing', 'border'],
      td: [...layout, 'colspan', 'rowspan'],
      th: [...layout, 'colspan', 'rowspan', 'scope'],
    },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowedSchemesByTag: { img: ['https', 'http'] },
    allowProtocolRelative: false,
  });
}

/** The plain-text part every campaign carries alongside its HTML. */
export function campaignText(html: string): string {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h[1-6]|tr|li|div|table|blockquote)>/gi, '\n\n')
    .replace(/<a\s[^>]*href="(https?:[^"]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)');
  return sanitizeHtml(withBreaks, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Characters a spreadsheet would run as a formula at the start of a cell. */
const FORMULA = /^[=+\-@\t\r]/;

/** One CSV cell: quoted, quotes doubled, and never read as a formula. */
export function csvCell(value: string | null | undefined): string {
  const text = value ?? '';
  return `"${(FORMULA.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`;
}
