import test from "node:test";
import assert from "node:assert/strict";
import {
  filterCheckedItems,
  getPackingItemIds,
} from "../../src/frontend/src/utils/checklist.js";

const packingList = {
  categories: [
    {
      name: "Clothing",
      items: [{ name: "Jacket" }, { name: "Socks" }],
    },
    {
      name: "Gear",
      items: [{ name: "Stroller" }],
    },
  ],
};

test("getPackingItemIds returns deterministic IDs for all list items", () => {
  const ids = getPackingItemIds(packingList);

  assert.equal(ids.has("Clothing-0-0"), true);
  assert.equal(ids.has("Clothing-0-1"), true);
  assert.equal(ids.has("Gear-1-0"), true);
  assert.equal(ids.size, 3);
});

test("filterCheckedItems removes stale IDs after list changes", () => {
  const validIds = new Set(["Clothing-0-0", "Gear-1-0"]);
  const savedChecked = ["Clothing-0-0", "Legacy-9-9", "Gear-1-0"];

  const filtered = filterCheckedItems(savedChecked, validIds);

  assert.deepEqual(filtered, ["Clothing-0-0", "Gear-1-0"]);
});
