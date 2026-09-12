export function toDbJson(value: unknown) {
  return JSON.parse(JSON.stringify(value));
}
