// Calls Claude to generate a structured packing list in JSON.
import Anthropic from "@anthropic-ai/sdk";

const MODEL_ID = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 4096;
const REPAIR_INPUT_MAX_CHARS = 24000;

function parsePackingListResponse(responseText) {
  // Attempts multiple parse strategies because LLM output may include wrappers/fences.
  const candidates = [];

  if (typeof responseText === "string" && responseText.trim()) {
    candidates.push(responseText.trim());

    const blockMatch =
      responseText.match(/```json\s*([\s\S]*?)\s*```/i) ||
      responseText.match(/```\s*([\s\S]*?)\s*```/i);

    if (blockMatch?.[1]) {
      candidates.push(blockMatch[1].trim());
    }

    const jsonStart = responseText.indexOf("{");
    const jsonEnd = responseText.lastIndexOf("}");
    if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
      candidates.push(responseText.slice(jsonStart, jsonEnd + 1));
    }
  }

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && Array.isArray(parsed.categories)) {
        return parsed;
      }
      lastError = new Error("Missing categories array");
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("AI returned invalid format. Please try again.");
}

function getTextContent(message) {
  // Anthropic can return structured content blocks; this extracts only text blocks.
  if (!message?.content || !Array.isArray(message.content)) {
    return "";
  }

  return message.content
    .filter((item) => item.type === "text")
    .map((item) => item.text || "")
    .join("\n")
    .trim();
}

async function requestPackingList(anthropic, prompt) {
  // Single model call wrapper so retries share the same invocation settings.
  const message = await anthropic.messages.create({
    model: MODEL_ID,
    temperature: 0,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return {
    responseText: getTextContent(message),
    stopReason: message.stop_reason || null,
  };
}

function buildRepairPrompt(brokenText) {
  // Dedicated repair prompt improves recovery when first/second responses are malformed.
  const text = (brokenText || "").slice(0, REPAIR_INPUT_MAX_CHARS);
  return `You are a JSON repair tool.

Fix the malformed JSON below and return ONLY valid JSON with this shape:
{
  "categories": [
    {
      "name": "string",
      "items": [
        {
          "name": "string",
          "quantity": "string",
          "reason": "string"
        }
      ]
    }
  ]
}

Rules:
- Preserve existing meaning as much as possible.
- Do not add markdown fences or commentary.
- If a field is missing, use a sensible short string value.
- Output valid minified or pretty JSON only.

Malformed JSON:
${text}`;
}

async function repairPackingListJson(anthropic, brokenText) {
  // Third-stage fallback: ask model to repair invalid JSON instead of regenerating content.
  const message = await anthropic.messages.create({
    model: MODEL_ID,
    temperature: 0,
    max_tokens: MAX_TOKENS,
    messages: [
      {
        role: "user",
        content: buildRepairPrompt(brokenText),
      },
    ],
  });

  return {
    responseText: getTextContent(message),
    stopReason: message.stop_reason || null,
  };
}

export async function generatePackingList(tripData, weatherForecast) {
  // Orchestrates resilient generation: full prompt -> compact retry -> JSON repair fallback.
  const { destination, startDate, endDate, activities, children } = tripData;

  const primaryPrompt = buildPrompt(
    destination,
    startDate,
    endDate,
    activities,
    children,
    weatherForecast,
    { compact: false },
  );

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const firstAttempt = await requestPackingList(anthropic, primaryPrompt);

    try {
      return parsePackingListResponse(firstAttempt.responseText);
    } catch (firstParseError) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          "Packing list parse failed on first attempt; retrying with compact prompt:",
          firstParseError.message,
        );
      }

      const retryPrompt = buildPrompt(
        destination,
        startDate,
        endDate,
        activities,
        children,
        weatherForecast,
        { compact: true },
      );

      const secondAttempt = await requestPackingList(anthropic, retryPrompt);

      try {
        return parsePackingListResponse(secondAttempt.responseText);
      } catch (secondParseError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "Packing list parse failed after retry; attempting JSON repair:",
            secondParseError.message,
          );
        }

        const repairSource = secondAttempt.responseText || firstAttempt.responseText;
        const repairAttempt = await repairPackingListJson(anthropic, repairSource);

        try {
          return parsePackingListResponse(repairAttempt.responseText);
        } catch (repairParseError) {
          console.error(
            "Packing list parse failed after retry and repair:",
            repairParseError,
          );
          console.error(
            "Stop reasons:",
            JSON.stringify({
              firstAttempt: firstAttempt.stopReason || "unknown",
              secondAttempt: secondAttempt.stopReason || "unknown",
              repairAttempt: repairAttempt.stopReason || "unknown",
            }),
          );
          throw new Error(
            "AI returned invalid packing-list JSON after retry and repair. Please try again.",
          );
        }
      }
    }
  } catch (error) {
    console.error("Claude API error:", error);
    if (error.message.includes("invalid packing-list JSON")) {
      throw error;
    }
    throw new Error("Failed to generate packing list: " + error.message);
  }
}

function buildPrompt(
  destination,
  startDate,
  endDate,
  activities,
  children,
  weatherForecast,
  options = {},
) {
  // Prompt builder supports a compact mode to reduce truncation and parse failures.
  const { compact = false } = options;
  const childrenInfo =
    children.length > 0 ? children.map((c) => `age ${c.age}`).join(", ") : "no children";

  const sizeGuardrail = compact
    ? `
**Output Size Limits (strict):**
- Include exactly 6-8 categories.
- Include 3-5 items per category.
- Keep total items <= 30.
- Keep each reason <= 90 characters.
`
    : `
**Output Size Limits:**
- Include 6-8 categories.
- Include 3-6 items per category.
- Keep total items <= 36.
- Keep each reason concise.
`;

  return `You are a helpful travel planning assistant for parents. Generate a comprehensive packing list for a family trip.

**Trip Details:**
- Destination: ${destination}
- Dates: ${startDate} to ${endDate}
- Activities: ${activities.join(", ")}
- Children: ${children.length} child(ren) - ${childrenInfo}

**Weather Forecast:**
${weatherForecast.summary}

${weatherForecast.forecast
  .slice(0, 7)
  .map(
    (f) =>
      `${f.name}: ${f.high}°F, ${f.condition}, ${f.precipitation}% rain chance`,
  )
  .join("\n")}

Generate a detailed packing list in JSON format with the following structure:

{
  "categories": [
    {
      "name": "Category Name (e.g., Clothing, Toiletries, Gear)",
      "items": [
        {
          "name": "Item name",
          "quantity": "number or range like '2-3'",
          "reason": "Brief explanation (weather-based, activity-based, or child age-based)"
        }
      ]
    }
  ]
}

**Requirements:**
1. Include categories: Clothing, Toiletries, Gear/Equipment, Documents, Medications, Entertainment, Snacks, Baby/Toddler Items (if applicable)
2. Base clothing recommendations on weather forecast (rain gear if >40% rain, layers if cool, sun protection if hot)
3. Include age-appropriate items for children (diapers for toddlers, activities for older kids)
4. Add activity-specific gear (beach toys, hiking boots, etc.)
5. Each item should have a practical quantity and a brief reason
6. Be specific and helpful but concise
${sizeGuardrail}
Return ONLY the JSON, no additional text.`;
}
