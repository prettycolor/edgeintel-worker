import { describe, expect, it } from "vitest";
import { withRetry } from "../src/lib/utils";

describe("withRetry", () => {
  it("retries until the operation succeeds", async () => {
    let attempts = 0;

    const result = await withRetry(
      async () => {
        attempts += 1;
        if (attempts < 2) {
          throw new Error("not yet");
        }
        return "ok";
      },
      {
        attempts: 3,
        delayMs: 1,
      },
    );

    expect(result.value).toBe("ok");
    expect(result.attempts).toBe(2);
  });
});
