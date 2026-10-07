import type {
  MissingParam,
  Param,
  ParamUnit,
  Provenance,
  SourceKind,
} from './types.ts';

const VERIFIED_KINDS: ReadonlySet<SourceKind> = new Set(['pack', 'measured']);

export function param(
  value: number,
  unit: ParamUnit,
  source: Provenance,
): Param {
  if (!Number.isFinite(value))
    throw new Error(`参数不是有限数值：${source.ref}`);
  return { value, unit, source, verified: VERIFIED_KINDS.has(source.kind) };
}

export function describeParam(p: Param): string {
  const unit =
    p.unit === 'percent'
      ? '%'
      : p.unit === 'seconds'
        ? '秒'
        : p.unit === 'meters'
          ? '米'
          : p.unit === 'frames'
            ? '帧'
            : '';
  const flag = p.verified ? '' : `（${p.source.kind}，未核实）`;
  return `${p.value}${unit}${flag} ← ${p.source.ref}`;
}

export function assumptionOf(p: Param): string | null {
  return p.verified ? null : describeParam(p);
}

// Collects missing parameters while building or running a simulation, so a
// result can say exactly which numbers it could not use.
export class MissingLog {
  readonly items: MissingParam[] = [];
  readonly #keys = new Set<string>();

  add(item: MissingParam) {
    if (this.#keys.has(item.key)) return;
    this.#keys.add(item.key);
    this.items.push(item);
  }

  addAll(items: readonly MissingParam[]) {
    for (const item of items) this.add(item);
  }

  get empty() {
    return this.items.length === 0;
  }
}

// Returns the param, or records it as missing and returns null.
export function need(
  p: Param | undefined,
  missing: MissingLog,
  item: MissingParam,
): Param | null {
  if (p) return p;
  missing.add(item);
  return null;
}
