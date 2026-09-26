export function documentEffectiveFrom(entries) {
  const dates = new Set(entries.map((entry) => entry.effectiveFrom ?? null));
  return dates.size === 1 ? dates.values().next().value : null;
}
