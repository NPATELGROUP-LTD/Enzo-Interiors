# Quote builder (prototype)

A standalone mock of the 3D/2D component quote builder: quick estimate,
room planner with 2D plan and 3D view, board cutting diagrams, and a staff
catalogue for boards, units and pricing.

**Local only. Not deployed.** It is not part of `apps/web`, and the root
`pnpm dev` / `build` / `start` scripts only run the website. All data is
kept in the browser's localStorage; nothing talks to `apps/api` yet.

```bash
pnpm install                          # from the repo root
pnpm --filter=@enzo-interiors/quote-builder dev    # http://localhost:3001
pnpm --filter=@enzo-interiors/quote-builder test
```

| Route    | What it is                                                       |
|----------|------------------------------------------------------------------|
| `/`      | Choose quick estimate or room planner                           |
| `/quick` | Room type, wall length, door finish → live price range           |
| `/plan`  | Room → layout and finishes → estimate. `?studio=1` shows costs  |
| `/admin` | Staff catalogue: boards, units, pricing, saved estimates         |

"Back to site" and "Book a free consultation" link to the website at
`NEXT_PUBLIC_SITE_URL` (default `http://localhost:3000`).
