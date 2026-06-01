import { HealthData, AppState, FuelCtx, MACRO_TARGETS } from "../types/health";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

function localDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export interface AnthropicResult {
  success: boolean;
  text?: string;
  error?: string;
  authError?: boolean;
}

async function callAnthropic(
  apiKey: string,
  prompt: string,
  maxTokens: number
): Promise<AnthropicResult> {
  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, authError: true, error: "Invalid API key" };
      }
      const errType = data.error?.type ? `[${data.error.type}] ` : "";
      return {
        success: false,
        error: `Error ${response.status}: ${errType}${data.error?.message || "Unknown error"}`,
      };
    }

    const text =
      (data.content as Array<{ text?: string }>)
        ?.map((c) => c.text || "")
        .join("") || "";
    return { success: true, text };
  } catch {
    return {
      success: false,
      error: "Unable to connect. Check your network and try again.",
    };
  }
}

export async function getInsight(
  apiKey: string,
  data: HealthData,
  appState: AppState
): Promise<AnthropicResult> {
  const today = localDate();
  const latestWeight = data.weight[0]?.value || null;
  const latestHRV = data.hrv[0]?.value || null;
  const latestSleep = data.sleep[0]?.value || null;
  const latestSteps = data.steps[0]?.value || null;
  const todayNutrition = data.nutrition.find((n) => n.date === today) || null;

  // Deduplicate RHR
  const seenRhr = new Map<string, number>();
  for (const pt of data.rhr) {
    if (!seenRhr.has(pt.date)) seenRhr.set(pt.date, pt.value);
  }
  const rhrVals = Array.from(seenRhr.values());
  const latestRHR = rhrVals[0] || null;

  const recoveryNotes = appState.recovery
    .slice(-5)
    .reverse()
    .map((r) => `- ${r.date}: ${r.note}`)
    .join("\n");

  const prompt = `You are Signal, a precision health intelligence advisor for Paul. Deliver one sharp, personalized coaching insight based on his current data.

PAUL'S PROFILE:
- Goal: Body recomp — reach 155 lbs / 15% body fat by May 2027
- Started ~177 lbs in February 2026, cutting with lean mass preserved on TRT (started May 15, 2026)
- Daily targets: 1,800 kcal, 180g protein, 160g carbs, 60g fat, ~4 days/week lifting (C1 program)

TODAY'S DATA:
- Weight: ${latestWeight ? latestWeight + " lbs" : "unavailable"}
- Calories: ${todayNutrition ? todayNutrition.cals + " kcal" : "unavailable"}
- Protein: ${todayNutrition ? todayNutrition.protein + "g" : "unavailable"}
- Sleep: ${latestSleep ? latestSleep + "h" : "unavailable"}
- Steps: ${latestSteps ? latestSteps.toLocaleString() : "unavailable"}
- RHR: ${latestRHR ? latestRHR + " bpm" : "unavailable"}
- HRV: ${latestHRV ? latestHRV + " ms" : "unavailable"}

RECOVERY NOTES (most recent first):
${recoveryNotes || "None logged"}

Give a 2–3 sentence coaching insight. Be specific, direct, grounded in the numbers. No generic advice. Focus on what matters most right now.`;

  return callAnthropic(apiKey, prompt, 200);
}

export async function analyzeFuel(
  apiKey: string,
  data: HealthData,
  fuelCtx: FuelCtx
): Promise<AnthropicResult> {
  const today = localDate();
  const todayNutrition = data.nutrition.find((n) => n.date === today) || null;

  const cals = todayNutrition?.cals || 0;
  const protein = todayNutrition?.protein || 0;
  const carbs = todayNutrition?.carbs || 0;
  const fat = todayNutrition?.fat || 0;

  const latestWeight = data.weight[0]?.value || 162.8;
  const latestHRV = data.hrv[0]?.value || 65;
  const latestSleep = data.sleep[0]?.value || 7.5;

  const recentTraining = data.exercise
    .slice(0, 3)
    .map((e) => `${e.title} (${e.duration}min)`)
    .join(", ");

  const remaining = {
    cals: MACRO_TARGETS.calories - cals,
    protein: Math.max(0, MACRO_TARGETS.protein - protein),
  };

  const prompt = `You are Signal, a precision health intelligence advisor. Give a specific, actionable nutrition recommendation.

PAUL'S PROFILE:
- Goal: Body recomp — reach 155 lbs / 15% body fat by May 2027
- Current: ${latestWeight} lbs, ~26% body fat, 116.9 lbs lean mass
- Daily targets: 1,800 kcal, 180g protein, 160g carbs, 60g fat, maintain lean mass on TRT (started May 15, 2026)

TODAY SO FAR:
- Calories consumed: ${cals} kcal (remaining: ${remaining.cals} kcal)
- Protein: ${protein}g (remaining: ${remaining.protein}g)
- Carbs: ${carbs}g
- Fat: ${fat}g
- Trained today: ${fuelCtx.trained || "unknown"}
- Sleep last night: ${latestSleep}h (${fuelCtx.sleep || "unknown"} quality)
- HRV: ${latestHRV}ms
- Recent workouts: ${recentTraining || "none logged"}
- Today's goal priority: ${fuelCtx.goal}

YOUR TASK:
Give Paul a specific recommendation for his NEXT meal or eating window. Include:
1. What to eat (specific foods or meal type)
2. Approximate macros to hit
3. When to eat it
4. One sentence of reasoning based on his data

Keep it under 100 words. Be direct and specific. No generic advice.`;

  return callAnthropic(apiKey, prompt, 1000);
}
