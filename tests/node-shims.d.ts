declare module "node:crypto" {
  export function createHash(algorithm: string): { update(value: string): { digest(encoding: "hex"): string } };
  export function randomUUID(): string;
}
declare module "node:test" {
  type TestFn = (name: string, fn: () => void | Promise<void>) => void;
  const test: TestFn;
  export default test;
}
declare module "node:assert/strict" {
  const assert: {
    equal(actual: unknown, expected: unknown, message?: string): void;
    ok(value: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    rejects(fn: () => Promise<unknown>, expected?: RegExp | ((error: unknown) => boolean)): Promise<void>;
  };
  export default assert;
}
