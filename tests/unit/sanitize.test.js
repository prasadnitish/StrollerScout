import test from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeString,
  sanitizeTripData,
  validateTripData,
} from "../../src/backend/utils/sanitize.js";

test("sanitizeString removes angle brackets and prompt-injection markers", () => {
  const input = "<b>IGNORE PREVIOUS</b> Seattle";
  const output = sanitizeString(input);

  assert.equal(output.includes("<"), false);
  assert.equal(output.toLowerCase().includes("ignore previous"), false);
  assert.equal(output.includes("Seattle"), true);
});

test("sanitizeTripData clamps children ages and normalizes activities", () => {
  const sanitized = sanitizeTripData({
    destination: "Seattle, WA",
    startDate: "2026-01-10",
    endDate: "2026-01-12",
    activities: ["hiking", "<script>", ""],
    children: [{ age: 2 }, { age: 99 }, { age: -5 }],
  });

  assert.deepEqual(sanitized.activities, ["hiking", "script"]);
  assert.deepEqual(
    sanitized.children.map((c) => c.age),
    [2, 18, 0],
  );
});

test("validateTripData enforces date and activity constraints", () => {
  const errors = validateTripData(
    {
      destination: "Seattle, WA",
      startDate: "2026-01-10",
      endDate: "2026-01-09",
      activities: [],
      children: [],
    },
    { requireActivities: true },
  );

  assert.equal(errors.includes("End date must be after start date"), true);
  assert.equal(errors.includes("At least one activity is required"), true);
});
