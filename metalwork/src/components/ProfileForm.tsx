import { GAUGES, INCH_MM, PROFILES, PROFILE_MAP, type ProfileDims, type ProfileType } from '../domain/profiles';
import { Field, NumberInput, Segmented, Select } from './ui';

export type SecUnit = 'mm' | 'in';
export type ThickUnit = 'mm' | 'in' | 'cal';

const round = (n: number, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

export function ProfileTypeSelect({ value, onChange, id, onlyLinear }: { value: ProfileType; onChange: (v: ProfileType) => void; id?: string; onlyLinear?: boolean }) {
  return (
    <Select id={id} value={value} onChange={onChange}
      options={PROFILES.filter((p) => !onlyLinear || p.cuttable).map((p) => ({ value: p.type, label: p.label }))} />
  );
}

/** Medidas de un perfil. Internamente todo se guarda en mm; la pantalla puede mostrar pulgadas o calibres. */
export function ProfileDimsForm({ type, dims, onChange, secUnit, thickUnit, setSecUnit, setThickUnit }:
  { type: ProfileType; dims: ProfileDims; onChange: (d: ProfileDims) => void; secUnit: SecUnit; thickUnit: ThickUnit; setSecUnit: (u: SecUnit) => void; setThickUnit: (u: ThickUnit) => void }) {
  const def = PROFILE_MAP[type];
  const isThick = (k: keyof ProfileDims) => k === 't' || k === 'tw';
  const hasThick = def.fields.some((f) => isThick(f.key));
  const hasSec = def.fields.some((f) => !isThick(f.key) && f.unit === 'mm');
  const set = (k: keyof ProfileDims, v: number | null) => onChange({ ...dims, [k]: v ?? undefined });

  return (
    <div className="space-y-3">
      {(hasSec || hasThick) && (
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {hasSec && (
            <div className="flex items-center gap-2 text-xs text-mute">Medidas
              <Segmented value={secUnit} onChange={setSecUnit} options={[{ value: 'mm', label: 'mm' }, { value: 'in', label: 'pulg' }]} />
            </div>
          )}
          {hasThick && (
            <div className="flex items-center gap-2 text-xs text-mute">Espesor
              <Segmented value={thickUnit} onChange={setThickUnit} options={[{ value: 'mm', label: 'mm' }, { value: 'in', label: 'pulg' }, { value: 'cal', label: 'calibre' }]} />
            </div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {def.fields.map((f) => {
          if (f.unit === 'kg/m') {
            return <Field key={f.key} label={f.label} unit="kg/m" hint={f.hint} className="col-span-2">{(id) => <NumberInput id={id} value={dims.kgm ?? null} onChange={(v) => set('kgm', v)} min={0} />}</Field>;
          }
          const thick = isThick(f.key);
          if (thick && thickUnit === 'cal') {
            const cur = GAUGES.find((g) => dims[f.key] !== undefined && Math.abs(g.mm - (dims[f.key] as number)) < 0.002);
            return (
              <Field key={f.key} label={f.label} unit={cur ? `${cur.mm} mm` : 'calibre'}>
                {(id) => (
                  <Select id={id} value={cur ? String(cur.cal) : ''} onChange={(v) => set(f.key, v ? GAUGES.find((g) => String(g.cal) === v)!.mm : null)}
                    options={[{ value: '', label: dims[f.key] ? `${dims[f.key]} mm (no estándar)` : 'Elige calibre' }, ...GAUGES.map((g) => ({ value: String(g.cal), label: `Cal. ${g.cal} — ${g.mm} mm` }))]} />
                )}
              </Field>
            );
          }
          const inch = thick ? thickUnit === 'in' : secUnit === 'in';
          const v = dims[f.key];
          return (
            <Field key={f.key} label={f.label} unit={inch ? 'pulg' : 'mm'} hint={f.hint ?? (inch && v ? `${round(v, 2)} mm` : undefined)}>
              {(id) => (
                <NumberInput id={id} value={v == null ? null : inch ? round(v / INCH_MM) : v} min={0}
                  onChange={(n) => set(f.key, n == null ? null : inch ? round(n * INCH_MM, 4) : n)} />
              )}
            </Field>
          );
        })}
      </div>
      {def.note && <p className="text-xs text-mute">{def.note}</p>}
    </div>
  );
}
