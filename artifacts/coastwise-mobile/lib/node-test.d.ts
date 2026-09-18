declare module 'node:assert/strict' {
  type Assert = {
    equal(actual: unknown, expected: unknown): void;
    deepEqual(actual: unknown, expected: unknown): void;
    ok(value: unknown): asserts value;
  };
  const assert: Assert;
  export default assert;
}

declare module 'node:test' {
  type TestBody = () => void | Promise<void>;
  export default function test(name: string, body: TestBody): void;
}