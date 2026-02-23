export function pickApiErrorMessage(data: any, fallback: string): string {
  return String(data?.reason || data?.message || fallback);
}
