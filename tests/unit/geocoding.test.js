import test from "node:test";
import assert from "node:assert/strict";
import {
  __resetGeocodingCachesForTests,
  geocodeLocation,
  resolveDestinationQuery,
} from "../../src/backend/services/geocoding.js";

const originalFetch = global.fetch;

test.afterEach(() => {
  global.fetch = originalFetch;
  __resetGeocodingCachesForTests();
});

test("geocodeLocation caches repeated lookups", async () => {
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return new Response(
      JSON.stringify([
        { lat: "47.6062", lon: "-122.3321", display_name: "Seattle, WA" },
      ]),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  await geocodeLocation("Seattle, WA");
  await geocodeLocation("Seattle, WA");

  assert.equal(calls, 1);
});

test("resolveDestinationQuery falls back to direct mode when nearby lookup fails", async () => {
  global.fetch = async (url) => {
    if (String(url).includes("nominatim.openstreetmap.org")) {
      return new Response(
        JSON.stringify([
          { lat: "47.6062", lon: "-122.3321", display_name: "Seattle, WA" },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    throw new Error("overpass unavailable");
  };

  const result = await resolveDestinationQuery("2 hour drive from Seattle");

  assert.equal(result.mode, "direct");
  assert.equal(result.destination, "Seattle, WA");
});

test("resolveDestinationQuery returns max three nearby suggestions", async () => {
  global.fetch = async (url) => {
    if (String(url).includes("nominatim.openstreetmap.org")) {
      return new Response(
        JSON.stringify([
          { lat: "47.6062", lon: "-122.3321", display_name: "Seattle, WA" },
        ]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        elements: [
          { lat: 47.62, lon: -122.33, tags: { name: "Tacoma", state: "WA" } },
          { lat: 47.59, lon: -122.28, tags: { name: "Bellevue", state: "WA" } },
          { lat: 47.67, lon: -122.12, tags: { name: "Redmond", state: "WA" } },
          { lat: 47.70, lon: -122.20, tags: { name: "Everett", state: "WA" } },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };

  const result = await resolveDestinationQuery("near Seattle");

  assert.equal(result.mode, "suggestions");
  assert.equal(result.suggestions.length, 3);
});
