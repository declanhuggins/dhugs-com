export function sanitizePathSegment(segment: string): string {
  const regex = /^[a-zA-Z0-9-_]+$/;
  return regex.test(segment) ? segment : '';
}
