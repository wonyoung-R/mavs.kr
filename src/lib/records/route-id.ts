// Route params can retain URL escapes when requests pass through the proxy.
// Decode at the route boundary so reads, existence checks and canonical URLs
// all use the same ID. Never recursively decode a second encoded path.
export function decodeRecordRouteId(value: string): string | null {
  try {
    const id = decodeURIComponent(value);
    return id && !/[/\\?#%\u0000-\u0020\u007f]/.test(id) ? id : null;
  } catch {
    return null;
  }
}
