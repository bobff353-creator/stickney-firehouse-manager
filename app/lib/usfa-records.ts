// The public USFA API can include explicitly marked security-test records.
// Match those markers, never ordinary names such as Testa or Tester.
const testMarker = /\bcisatest[\w-]*\b|\bdisregard[-_ ](?:poc\d*|securitytest|valinj)\b/i;

export function isMarkedUsfaTestRecord(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return ['name', 'firstName', 'lastName', 'department', 'fdName', 'location', 'fdCity']
    .some(key => typeof record[key] === 'string' && testMarker.test(record[key]));
}
