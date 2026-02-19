import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../../src/backend/server.js";

const ORIGINAL_API_KEY = process.env.ANTHROPIC_API_KEY;

function createMockRes() {
  return {
    statusCode: 200,
    body: undefined,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function invokeRoute(app, method, path, body) {
  const routeStack = app._router?.stack || [];
  const routeLayer = routeStack.find(
    (layer) =>
      layer.route &&
      layer.route.path === path &&
      layer.route.methods[method.toLowerCase()],
  );

  if (!routeLayer) {
    throw new Error(`Route not found: ${method} ${path}`);
  }

  // Route stack is [rateLimiter, handler]. We invoke the route handler directly
  // to avoid binding sockets in restricted environments.
  const handler = routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;
  const req = { method, path, body, headers: {}, ip: "127.0.0.1" };
  const res = createMockRes();

  await handler(req, res);
  return res;
}

test.afterEach(() => {
  process.env.ANTHROPIC_API_KEY = ORIGINAL_API_KEY;
});

test("POST /api/resolve-destination returns suggestions from resolver", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";

  const app = createApp({
    enableRequestLogging: false,
    resolveDestinationQueryFn: async () => ({
      mode: "suggestions",
      origin: "Seattle, WA",
      suggestions: [
        { name: "Tacoma", displayName: "Tacoma, WA", distanceMiles: 32 },
        { name: "Bellevue", displayName: "Bellevue, WA", distanceMiles: 10 },
      ],
    }),
  });

  const res = await invokeRoute(app, "POST", "/api/resolve-destination", {
    query: "2 hour drive from Seattle",
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.mode, "suggestions");
  assert.equal(res.body.suggestions.length, 2);
});

test("POST /api/trip-plan applies default activities when none are provided", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";

  let receivedTripInput = null;
  const app = createApp({
    enableRequestLogging: false,
    geocodeLocationFn: async () => ({
      lat: 47.6062,
      lon: -122.3321,
      displayName: "Seattle, WA",
    }),
    getWeatherForecastFn: async () => ({
      summary: "Mild weather",
      forecast: [],
    }),
    generateTripPlanFn: async (tripInput) => {
      receivedTripInput = tripInput;
      return {
        overview: "Plan",
        suggestedActivities: [],
        dailyItinerary: [],
        tips: [],
      };
    },
  });

  const res = await invokeRoute(app, "POST", "/api/trip-plan", {
    destination: "Seattle, WA",
    startDate: "2026-05-01",
    endDate: "2026-05-04",
    activities: [],
    children: [{ age: 2 }],
  });

  assert.equal(res.statusCode, 200);
  assert.deepEqual(receivedTripInput.activities, [
    "family-friendly",
    "parks",
    "city",
  ]);
  assert.deepEqual(res.body.trip.activities, ["family-friendly", "parks", "city"]);
});

test("POST /api/generate rejects requests with no activities", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";

  const app = createApp({ enableRequestLogging: false });
  const res = await invokeRoute(app, "POST", "/api/generate", {
    destination: "Seattle, WA",
    startDate: "2026-05-01",
    endDate: "2026-05-02",
    activities: [],
    children: [{ age: 4 }],
  });

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error.includes("At least one activity is required"), true);
});

test("POST /api/generate returns trip, weather, and packing list", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";

  const app = createApp({
    enableRequestLogging: false,
    geocodeLocationFn: async () => ({
      lat: 47.6062,
      lon: -122.3321,
      displayName: "Seattle, WA",
    }),
    getWeatherForecastFn: async () => ({
      summary: "Cool and cloudy",
      forecast: [{ name: "Monday", high: 60, low: 50, precipitation: 30 }],
    }),
    generatePackingListFn: async () => ({
      categories: [
        {
          name: "Clothing",
          items: [{ name: "Jacket", quantity: "1", reason: "Cool weather" }],
        },
      ],
    }),
  });

  const res = await invokeRoute(app, "POST", "/api/generate", {
    destination: "Seattle, WA",
    startDate: "2026-05-01",
    endDate: "2026-05-03",
    activities: ["parks"],
    children: [{ age: 2 }],
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.trip.destination, "Seattle, WA");
  assert.equal(res.body.weather.summary, "Cool and cloudy");
  assert.equal(res.body.packingList.categories.length, 1);
});

test("POST /api/safety/car-seat-check returns guidance from safety service", async () => {
  process.env.ANTHROPIC_API_KEY = "test-key";

  const app = createApp({
    enableRequestLogging: false,
    getCarSeatGuidanceFn: ({ jurisdictionCode, destination, children }) => ({
      status: "Needs review",
      jurisdictionCode: jurisdictionCode || "WA",
      jurisdictionName: "Washington",
      message: "Verify official source before travel.",
      sourceUrl: "https://example.org",
      effectiveDate: "Not found in repo",
      lastUpdated: "2026-02-15",
      results: children.map((child, index) => ({
        childId: child.id || `child-${index + 1}`,
        status: "Needs review",
        requiredRestraint: "booster",
        requiredRestraintLabel: "Booster seat",
        rationale: `Destination ${destination}`,
      })),
    }),
  });

  const res = await invokeRoute(app, "POST", "/api/safety/car-seat-check", {
    destination: "Seattle, WA",
    children: [{ age: 5, weightLb: 44, heightIn: 43 }],
  });

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.status, "Needs review");
  assert.equal(res.body.results[0].requiredRestraint, "booster");
});
