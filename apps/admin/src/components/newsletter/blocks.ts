/**
 * The newsletter editor's blocks, and the email HTML they turn into. The admin never shows or edits
 * the HTML: it is made here from the blocks on every change, and the API sanitises it again on save
 * (modules/newsletter/render.ts). The block list is stored beside it so a draft can be opened again.
 */

export type Block =
  | { id: string; type: 'heading'; text: string }
  | { id: string; type: 'text'; text: string }
  | { id: string; type: 'image'; src: string; alt: string }
  | { id: string; type: 'button'; label: string; url: string }
  | { id: string; type: 'columns'; left: string; right: string }
  | { id: string; type: 'divider' }
  /** A newsletter written before the block editor: kept exactly as it was, never shown as code. */
  | { id: string; type: 'legacy'; html: string };

export type BlockType = Exclude<Block['type'], 'legacy'>;

export const BLOCK_TYPES: Array<{ type: BlockType; label: string }> = [
  { type: 'heading', label: 'Heading' },
  { type: 'text', label: 'Text' },
  { type: 'image', label: 'Image' },
  { type: 'button', label: 'Button' },
  { type: 'columns', label: 'Two columns' },
  { type: 'divider', label: 'Divider' },
];

export const newId = () => Math.random().toString(36).slice(2, 10);

export function emptyBlock(type: BlockType): Block {
  const id = newId();
  switch (type) {
    case 'heading':
      return { id, type, text: '' };
    case 'text':
      return { id, type, text: '' };
    case 'image':
      return { id, type, src: '', alt: '' };
    case 'button':
      return { id, type, label: 'Book a consultation', url: '' };
    case 'columns':
      return { id, type, left: '', right: '' };
    case 'divider':
      return { id, type };
  }
}

/** Two starting points; a newsletter can also begin blank. */
export const TEMPLATES: Array<{ id: string; name: string; detail: string; blocks: () => Block[] }> = [
  {
    id: 'announcement',
    name: 'Announcement',
    detail: 'A headline, a few lines and one button. For news, offers and openings.',
    blocks: () => [
      { id: newId(), type: 'heading', text: 'Something new at Enzo Interiors' },
      { id: newId(), type: 'text', text: 'Hello,\n\nTell your subscribers what is happening, in a few short lines.' },
      { id: newId(), type: 'button', label: 'Book a consultation', url: 'https://enzointeriors.co.uk/booking' },
    ],
  },
  {
    id: 'showcase',
    name: 'Project showcase',
    detail: 'A finished room with a photo, what made it special and a link to see more.',
    blocks: () => [
      { id: newId(), type: 'heading', text: 'A recent project' },
      { id: newId(), type: 'image', src: '', alt: '' },
      { id: newId(), type: 'text', text: 'Say a little about the room, the brief and what the family wanted.' },
      { id: newId(), type: 'columns', left: 'The brief\nWhat they asked for.', right: 'The result\nWhat we built.' },
      { id: newId(), type: 'divider' },
      { id: newId(), type: 'button', label: 'See more of our work', url: 'https://enzointeriors.co.uk/portfolio' },
    ],
  },
];

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** "a\n\nb" -> two paragraphs; a single newline inside one is a line break. */
function paragraphs(text: string, style = 'margin:0 0 16px'): string {
  return text
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p style="${style}">${escapeHtml(part).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** A typed address becomes a working link: "enzo.co.uk" gets its https://. */
export function linkOf(url: string): string {
  const typed = url.trim();
  if (!typed) return '';
  return /^(https?:|mailto:|tel:)/i.test(typed) ? typed : `https://${typed}`;
}

/** What a block adds to the email. An unfinished block (no image chosen, no words) adds nothing. */
export function blockHtml(block: Block): string {
  switch (block.type) {
    case 'heading':
      return block.text.trim()
        ? `<h2 style="margin:0 0 12px;font:600 24px/1.3 Georgia,serif;color:#102E2D">${escapeHtml(block.text.trim())}</h2>`
        : '';
    case 'text':
      return paragraphs(block.text);
    case 'image':
      return block.src
        ? `<img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" width="496" style="display:block;width:100%;height:auto;border-radius:8px;margin:0 0 16px">`
        : '';
    case 'button': {
      const href = linkOf(block.url);
      return block.label.trim() && href
        ? `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:#102E2D;color:#F2F0EB;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${escapeHtml(block.label.trim())}</a></p>`
        : '';
    }
    case 'columns':
      return block.left.trim() || block.right.trim()
        ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px"><tr><td width="50%" valign="top" style="padding-right:8px">${paragraphs(block.left, 'margin:0 0 8px')}</td><td width="50%" valign="top" style="padding-left:8px">${paragraphs(block.right, 'margin:0 0 8px')}</td></tr></table>`
        : '';
    case 'divider':
      return '<hr style="border:0;border-top:1px solid #ECE9E2;margin:24px 0">';
    case 'legacy':
      return block.html;
  }
}

export const blocksHtml = (blocks: Block[]) => blocks.map(blockHtml).join('\n');

const TYPES = new Set(['heading', 'text', 'image', 'button', 'columns', 'divider', 'legacy']);

/** Blocks as the API stored them, or one kept-as-written block for a newsletter that predates the editor. */
export function blocksOf(saved: unknown, html: string): Block[] {
  if (Array.isArray(saved)) {
    return saved.filter((row): row is Block => !!row && typeof row === 'object' && TYPES.has((row as Block).type) && typeof (row as Block).id === 'string');
  }
  return html.trim() ? [{ id: newId(), type: 'legacy', html }] : [];
}
