# Enzo Interiors — Digital Experience Design Brief

**Prepared for:** Enzo Interiors  
**Prepared by:** NPATEL GROUP LTD  
**Version:** 1.3 — Client Review & Build Specification  
**Date:** July 2026

## Purpose
This brief defines the visual and interaction direction for the Enzo Interiors public website, Client Portal and Admin CRM. It is suitable for client review and serves as a clear build contract for designers, developers and AI agents.

The platform supports the full client journey: service discovery, indicative estimating, consultation booking, project updates, design approvals, documents, messages, quotations and invoices.

## Design Principles
- **Premium through restraint:** create quality with real project photography, typography, proportion and whitespace.
- **Action-led:** make the next relevant step clear on every screen.
- **Calm operations:** make Portal and CRM information useful, not decorative.
- **One cohesive brand:** public pages are aspirational; authenticated products are practical; all share the same foundations.
- **Accessible by default:** colour reinforces meaning but never provides the only signal.

### Visual exclusions
- Use only `Inter, system-ui, sans-serif`; no serif font anywhere.
- No decorative dots, bullet markers in status tags, icon confetti or generic AI-style decoration.
- No mesh gradients, glow effects, floating shapes, aurora fills or excessive glass effects.
- No fully rounded/pill buttons.
- No decorative icons without a functional purpose.
- No exaggerated bounce, scale or card-hover movement.

## Foundation Tokens

### Colour
| Token | Value | Use |
|---|---:|---|
| `green-900` | `#173C30` | Primary action, active navigation, key heading |
| `green-800` | `#245441` | Primary button hover/pressed state |
| `green-100` | `#E4EEE8` | Selected or quiet active surface |
| `secondary-default` | `#F2F7F3` | Secondary button background |
| `secondary-hover` | `#D9E9DC` | Secondary button hover background |
| `canvas` | `#F7F5F0` | Page background |
| `surface` | `#FFFEFA` | Cards, inputs and dialogs |
| `surface-muted` | `#EEEAE1` | Table headers and quiet grouped areas |
| `ink` | `#242723` | Primary text |
| `ink-muted` | `#62665F` | Supporting text |
| `border` | `#D8D2C6` | Standard border/divider |
| `success` / `success-bg` | `#24613E` / `#E6F1E9` | Paid, completed, approved |
| `warning` / `warning-bg` | `#8A5716` / `#FAEEDB` | Pending or awaiting a decision |
| `danger` / `danger-bg` | `#A63835` / `#F9E7E5` | Error, overdue and destructive action |
| `focus-ring` | `#5D8A71` | Keyboard focus outline |

### Typography
Use **Inter only**.

| Element | Desktop / mobile | Weight | Rule |
|---|---:|---:|---|
| H1 | 64px / 42px | 700 | -0.03em tracking; 1.05 line height |
| H2 | 40px / 32px | 600 | -0.02em tracking |
| H3 | 24px / 20px | 600 | -0.01em tracking |
| Website body | 16px | 400 | 1.6 line height |
| Portal/CRM body | 14px | 500 | 1.5 line height |
| Labels | 12px / 11px | 700 | Uppercase; 0.08em tracking |

### Layout
Use the 8-point spacing scale: 4, 8, 12, 16, 24, 32, 48, 64 and 96px. Controls use 8px corners; cards, tiles and modals use 12px corners. Prefer a 1px border to a shadow. A raised overlay may use only `0 8px 24px rgba(30,38,31,.08)`.

Support 1440px desktop, 768px tablet and 375px mobile. Mobile interactive targets must be at least 44px.

## Buttons and Links

### Standard buttons
All filled or outlined buttons use 44px minimum height, 16px horizontal padding, 8px corners, Inter 600 at 14px and 160ms colour/border transitions.

| Variant | Default | Hover | Use |
|---|---|---|---|
| Primary | Green-900 with white text | Green-800 with restrained shadow | One principal forward action |
| Secondary | Pale green `#F2F7F3`, soft green border, green text | Darker green tint `#D9E9DC`, forest border, restrained shadow | Alternative action |
| Destructive | Surface with danger text and border | Danger-tinted surface | Delete/remove, after confirmation |

### Text links / tertiary actions — updated rule
Text links must remain **lightweight and stable**. They are not button containers and must not gain a coloured background, box, shadow or movement on hover.

| State | Required behaviour |
|---|---|
| Default | Green-900 text, 14px Inter 600; underline offset 3px with a subtle 1px underline |
| Hover | Change text and underline to green-800 only; underline thickness increases from 1px to 2px |
| Focus | 2px `focus-ring` outline with 2px offset; preserve the underline |
| Pressed | No translate, no background, no shadow |
| Disabled | Use only for a true unavailable action; remove link behaviour and show muted text |

Use text links for “View projects”, “Open inbox”, “Review leads”, “Preview quote” and similar navigation. Use filled/outlined buttons only for actions such as booking, sending, saving, approving or deleting.

## Improved Dashboard Cards
Cards establish hierarchy through a purposeful accent rail, content order, useful supporting context and a clear next step—not decorative graphics.

### Card anatomy
1. Eyebrow label: 11px uppercase Inter, muted ink.
2. Primary metric: 38px/700 Inter, green-900, tight tracking.
3. Context: one short, useful sentence; maximum two lines.
4. Bottom content: a text status tag or tertiary link, aligned to the bottom.
5. Accent rail: a 3px left edge in a semantic colour.

### Content rules
| Card | Value | Supporting content | Bottom item |
|---|---:|---|---|
| Active projects | 24 | 16 on track; 3 need a decision | View projects |
| Today’s bookings | 06 | First appointment at 09:30 | 2 awaiting confirmation, only if applicable |
| Outstanding invoices | £8.4k | £1.2k due this week | 1 overdue |
| Unread messages | 07 | 3 conversations require a reply today | Open inbox |
| New enquiries | 12 | 5 received since yesterday | Review leads |

### Interaction rules
- Non-clickable cards do not animate on hover.
- A fully interactive card may shift up 2px, change border to green-900 and show a restrained shadow.
- A card containing an independent action link is **not** fully clickable; the text link is the only action.
- Text links follow the stable hover rule above: colour/underline only, with no tinted background, box or movement.
- Status tags use written labels only—no dots or bullets.

## Product Journeys

### Public Website
Homepage → Service (Kitchens, Bedrooms, Media Walls or Wardrobes) → investment guide → quote calculator → request quote or book consultation. The calculator clearly states that results are indicative until consultation and site measurement.

### Client Portal
Dashboard → project detail → Timeline, Designs, Documents and Messages. Prioritise the next appointment and any client decision. Design approval provides **Approve design** and **Request changes** as clear, equally understandable outcomes.

### Admin CRM
Dashboard → Clients, Bookings, Quotes & Pricing, Projects, Invoices, Messages, Content and Settings. Quote lifecycle: build → save draft → send → client accepts/revises → convert to invoice. Project stages: Consultation, Design, Approval, Installation and Completed.

## Product Direction

### Public Website
Image-led and spacious. Use real completed project photography, concise service content, portfolio proof, investment tiers and strong consultation routes. The header is transparent over a darkened hero image and becomes a warm solid surface after scroll.

### Client Portal
Reassuring and simple. Dashboard order: next appointment, decision awaiting client, timeline, unread messages, invoice summary and documents. Mobile navigation: Dashboard, Projects, Messages, Invoices and More.

### Admin CRM
Efficient and information-led. Desktop sidebar: Dashboard, Clients, Bookings, Quotes & Pricing, Projects, Invoices, Messages, Content and Settings. Tables need search, filters, loading/empty/error states and labelled mobile card views. Kanban must provide “Move to…” alongside drag-and-drop.

## Accessibility and QA
- WCAG AA contrast in every theme.
- Keyboard navigation and visible focus states for navigation, forms, modals, tabs, tables and Kanban actions.
- 44px minimum touch targets.
- Semantic headings, labelled fields, descriptive image alt text and plain-English errors.
- Test desktop 1440px, tablet 768px, mobile 375px, 200% zoom, reduced motion and slow/offline states.
- Portal/Admin offline mode retains shell and uses a clear reconnection message.

## AI Agent Instruction
This brief is a strict implementation contract. Use Inter only, listed tokens, 8px controls, 12px cards, semantic text-only statuses and stable text-link behaviour. Never introduce serif type, dots, pills, decorative icons, generic gradients, glows, tinted/animated text-link hovers or visual filler. If a requirement is ambiguous, select the simplest accessible option and flag it for review.


## Visual Guide Contents
The accompanying HTML visual guide includes a visible palette board with primary, hover, selected, secondary, canvas, surface and ink tokens. It also includes a button library showing normal and hover-preview versions of primary, secondary and text-link actions, plus the text-only status labels.
