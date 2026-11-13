import { Suspense, lazy, useCallback, useMemo, useState } from 'react';

import { Select } from '@/components/ui';

import { Elevation } from './Elevation';
import type { Plan, PlanWall, StockItem, TemplateVariant, UnitTemplate } from './plan';

const Preview3D = lazy(() => import('./Preview3D'));
const noop = () => {};

/** The unit as the form stands (unsaved), alone on a short wall: its front, and the same in 3D. Nothing is priced here. */
export function UnitPreview({ unit, items }: { unit: Omit<UnitTemplate, 'id' | 'problems' | 'updated_by' | 'position' | 'variants'> & { variants: TemplateVariant[] }; items: StockItem[] }) {
  const [size, setSize] = useState(0);
  const sizes = unit.variants;
  const variant = sizes[Math.min(size, sizes.length - 1)];

  const template = useMemo<UnitTemplate | null>(
    () =>
      variant
        ? { ...unit, id: 'preview', problems: [], updated_by: null, position: 0, variants: [{ ...variant, id: 'preview-size' }] }
        : null,
    [unit, variant],
  );
  const templates = useMemo(() => new Map(template ? [[template.id, template]] : []), [template]);

  const bySwatch = useMemo(() => new Map(items.map((i) => [i.id, i.swatch])), [items]);
  const colourOf = useCallback(
    (_u: PlanWall['units'][number], t: UnitTemplate) => {
      const slot = t.slots.find((s) => s.roles.includes('front')) ?? t.slots[0];
      return (slot?.default_item_id && bySwatch.get(slot.default_item_id)) || null;
    },
    [bySwatch],
  );

  const plan = useMemo<Plan | null>(() => {
    if (!template || !variant) return null;
    const top = (template.mount === 'wall' ? template.elevation_mm : 0) + variant.height_mm + (template.structure.worktop ? 40 : 0);
    const length = Math.max(1200, variant.width_mm + 600);
    return {
      layout: 'single',
      height_mm: Math.max(600, top + 150), // the room is only as tall as the unit needs: no limits apply to a preview
      walls: [{ length_mm: length, units: [{ id: 'preview-unit', template_id: template.id, variant_id: 'preview-size', x_mm: Math.round((length - variant.width_mm) / 2 / 10) * 10 }] }],
      island: null,
    };
  }, [template, variant]);

  if (!template || !plan || !variant) return <p className="text-sm text-ink-muted">Add a size to see the unit.</p>;
  return (
    <div className="flex flex-col gap-3">
      {sizes.length > 1 ? (
        <Select label="Preview size" value={String(Math.min(size, sizes.length - 1))} onChange={(e) => setSize(Number(e.target.value))}>
          {sizes.map((v, i) => (
            <option key={v.id ?? i} value={i}>
              {v.width_mm} × {v.height_mm} × {v.depth_mm} mm
            </option>
          ))}
        </Select>
      ) : null}
      <div className="[&_svg]:max-h-[26vh]">
      <Elevation
        label="Front"
        wall={plan.walls[0]!}
        ceiling_mm={plan.height_mm}
        templates={templates}
        colourOf={colourOf}
        selectedId={null}
        onSelect={noop}
        onMove={noop}
        onRemove={noop}
      />
      </div>
      <div className="h-[28vh] min-h-40 overflow-hidden rounded-card bg-surface-muted">
        <Suspense fallback={<div className="h-full w-full animate-pulse bg-surface-muted" />}>
          <Preview3D plan={plan} templates={templates} colourOf={colourOf} hint={false} />
        </Suspense>
      </div>
      <p className="text-xs text-ink-muted">Drawn from the form as it stands, to scale. Drag the 3D view to turn it.</p>
    </div>
  );
}
