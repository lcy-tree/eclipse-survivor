import { describe, it, expect } from "vitest";
import { distance, clamp, rand, pick, dayKey, escapeHtml, validateUsername, validatePassword, checkRateLimit } from "./utils.js";

describe("utils", () => {
  describe("distance", () => {
    it("calculates Euclidean distance", () => {
      expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    });
    it("returns 0 for same point", () => {
      expect(distance({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0);
    });
  });

  describe("clamp", () => {
    it("clamps to min", () => expect(clamp(-5, 0, 10)).toBe(0));
    it("clamps to max", () => expect(clamp(15, 0, 10)).toBe(10));
    it("returns value in range", () => expect(clamp(5, 0, 10)).toBe(5));
  });

  describe("rand", () => {
    it("returns value within range", () => {
      for (let i = 0; i < 100; i++) {
        const v = rand(5, 10);
        expect(v).toBeGreaterThanOrEqual(5);
        expect(v).toBeLessThanOrEqual(10);
      }
    });
  });

  describe("pick", () => {
    it("returns an element from the array", () => {
      const arr = [1, 2, 3];
      for (let i = 0; i < 50; i++) {
        expect(arr).toContain(pick(arr));
      }
    });
  });

  describe("escapeHtml", () => {
    it("escapes special characters", () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe("&lt;script&gt;alert(&#34;xss&#34;)&lt;/script&gt;");
    });
  });

  describe("validateUsername", () => {
    it("accepts valid usernames", () => {
      expect(validateUsername("玩家123")).toBe(true);
      expect(validateUsername("test_user")).toBe(true);
      expect(validateUsername("abc")).toBe(true);
    });
    it("rejects invalid usernames", () => {
      expect(validateUsername("ab")).toBe(false);
      expect(validateUsername("")).toBe(false);
    });
  });

  describe("validatePassword", () => {
    it("accepts valid passwords", () => expect(validatePassword("pass1234")).toBe(true));
    it("rejects short passwords", () => expect(validatePassword("123")).toBe(false));
  });

  describe("dayKey", () => {
    it("returns a date string", () => {
      const key = dayKey();
      expect(key).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("checkRateLimit", () => {
    it("allows first request", () => {
      const key = `test-${Date.now()}`;
      expect(checkRateLimit(key, 3, 1000)).toBe(true);
    });
  });
});
