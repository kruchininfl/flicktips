// Joins class names, skipping empty ones: cx('btn', active && 'm-active').
export function cx(...names: (string | false | null | undefined)[]): string {
  return names.filter(Boolean).join(' ');
}
