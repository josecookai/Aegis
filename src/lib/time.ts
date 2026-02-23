export function nowIso(): string {
  return new Date().toISOString();
}

export function addMinutesIso(baseIso: string, minutes: number): string {
  const d = new Date(baseIso);
  d.setMinutes(d.getMinutes() + minutes);
  return d.toISOString();
}

export function isPast(iso: string, ref = new Date()): boolean {
  return new Date(iso).getTime() <= ref.getTime();
}

export function unixTsSeconds(date = new Date()): number {
  return Math.floor(date.getTime() / 1000);
}
