import { HealthData, AppState, FuelCtx, UserProfile, MACRO_TARGETS } from "../types/health";

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

function buildProfileSection(profile: UserProfile): string {
  const lines: string[] = [];
  if (profile.goal) lines.push(`Goal: ${profile.goal}`);
  const targets: string[] = [];
  if (profile.targetWeight) targets.push(`${profile.targetWeight} lbs`);
  if (profile.targetBodyFat) targets.push(`${profile.targetBodyFat}% body fat`);
  if (profile.targetDate) targets.push(`by ${profile.targetDate}`);
  if (targets.length) lines.push(`Target: ${targets.join(" / ")}`);
  if (profile.startingWeight && profile.startingDate) {
    lines.push(`Started: ${profile.startingWeight} lbs (${profile.startingDate})`);
  }
  if (profile.onTRT) {
    lines.push(`Protocol: TRT${profile.trtStartDate ? ` (started ${profile.trtStartDate})` : ""}`);
  }
  const training: string[] = [];
  if (profile.trainingDaysPerWeek) training.push(`${profile.trainingDaysPerWeek}x/week`);
  if (profile.trainingProgram) training.push(profile.trainingProgram);
  if (training.length) lines.push(`Training: ${training.join(", ")}`);
  if (profile.additionalContext) lines.push(`Note: ${profile.additionalContext}`);

  if (!lines.length) return "";
  return "USER PROFILE:\n" + lines.map((l) => `- ${l}`).join("\n");
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
  appState: AppState,
  profile: UserProfile
): Promise<AnthropicResult> {
  const today = localDate();
  const weightSorted = [...data.weight].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = weightSorted[weightSorted.length - 1]?.value ?? null;

  const hrvSorted = [...data.hrv].sort((a, b) => a.date.localeCompare(b.date));
  const latestHRV = hrvSorted[hrvSorted.length - 1]?.value ?? null;

  const sleepSorted = [...data.sleep].sort((a, b) => a.date.localeCompare(b.date));
  const latestSleep = sleepSorted[sleepSorted.length - 1]?.value ?? null;

  const stepsSorted = [...data.steps].sort((a, b) => a.date.localeCompare(b.date));
  const latestSteps = stepsSorted.find((s) => s.date === today)?.value ?? null;

  const todayNutrition = data.nutrition.find((n) => n.date === today) ?? null;

  const seenRhr = new Map<string, number>();
  for (const pt of data.rhr) {
    if (!seenRhr.has(pt.date)) seenRhr.set(pt.date, pt.value);
  }
  const rhrSorted = Array.from(seenRhr.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const latestRHR = rhrSorted[rhrSorted.length - 1]?.[1] ?? null;

  const latestDexa = appState.dexa[appState.dexa.length - 1] ?? null;

  const recoveryNotes = appState.recovery
    .slice(-5)
    .reverse()
    .map((r) => `- ${r.date}: ${r.note}`)
    .join("\n");

  const profileSection = buildProfileSection(profile);
  const userName = profile.name ? profile.name : "the user";

  const prompt = `You are Signal, a precision health intelligence advisor${profile.name ? ` for ${profile.name}` : ""}. Deliver one sharp, personalized coaching insight based on current data.
${profileSection ? "\n" + profileSection + "\n" : ""}
TODAY'S DATA:
- Weight: ${latestWeight !== null ? latestWeight + " lbs" : "unavailable"}
${latestDexa ? `- Body composition: ${latestDexa.bodyFat}% body fat, ${latestDexa.leanMass} lbs lean mass (DEXA ${latestDexa.date})` : ""}
- Calories: ${todayNutrition ? todayNutrition.cals + " kcal (target: " + MACRO_TARGETS.calories + ")" : "unavailable"}
- Protein: ${todayNutrition ? todayNutrition.protein + "g (target: " + MACRO_TARGETS.protein + "g)" : "unavailable"}
- Sleep: ${latestSleep !== null ? latestSleep + "h" : "unavailable"}
- Steps: ${latestSteps !== null ? latestSteps.toLocaleString() : "unavailable"}
- RHR: ${latestRHR !== null ? latestRHR + " bpm" : "unavailable"}
- HRV: ${latestHRV !== null ? latestHRV + " ms" : "unavailable"}

RECOVERY NOTES (most recent first):
${recoveryNotes || "None logged"}

Give a 2–3 sentence coaching insight. Be specific, direct, grounded in the numbers. No generic advice. Focus on what matters most right now.`;

  return callAnthropic(apiKey, prompt, 200);
}

export async function analyzeFuel(
  apiKey: string,
  data: HealthData,
  fuelCtx: FuelCtx,
  appState: AppState,
  profile: UserProfile
): Promise<AnthropicResult> {
  const today = localDate();
  const todayNutrition = data.nutrition.find((n) => n.date === today) ?? null;

  const cals = todayNutrition?.cals ?? 0;
  const protein = todayNutrition?.protein ?? 0;
  const carbs = todayNutrition?.carbs ?? 0;
  const fat = todayNutrition?.fat ?? 0;

  const weightSorted = [...data.weight].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = weightSorted[weightSorted.length - 1]?.value ?? null;

  const hrvSorted = [...data.hrv].sort((a, b) => a.date.localeCompare(b.date));
  const latestHRV = hrvSorted[hrvSorted.length - 1]?.value ?? null;

  const sleepSorted = [...data.sleep].sort((a, b) => a.date.localeCompare(b.date));
  const latestSleep = sleepSorted[sleepSorted.length - 1]?.value ?? null;

  const latestDexa = appState.dexa[appState.dexa.length - 1] ?? null;

  const recentTraining = data.exercise
    .slice(0, 3)
    .map((e) => `${e.title} (${e.duration}min)`)
    .join(", ");

  const remaining = {
    cals: MACRO_TARGETS.calories - cals,
    protein: Math.max(0, MACRO_TARGETS.protein - protein),
  };

  const profileSection = buildProfileSection(profile);

  const prompt = `You are Signal, a precision health intelligence advisor. Give a specific, actionable nutrition recommendation.
${profileSection ? "\n" + profileSection + "\n" : ""}
TODAY'S DATA:
- Weight: ${latestWeight !== null ? latestWeight + " lbs" : "unavailable"}
${latestDexa ? `- Body composition: ${latestDexa.bodyFat}% body fat, ${latestDexa.leanMass} lbs lean mass (DEXA ${latestDexa.date})` : ""}
- Calories consumed: ${cals} kcal (remaining: ${remaining.cals} kcal of ${MACRO_TARGETS.calories} target)
- Protein: ${protein}g (remaining: ${remaining.protein}g of ${MACRO_TARGETS.protein}g target)
- Carbs: ${carbs}g (target: ${MACRO_TARGETS.carbs}g)
- Fat: ${fat}g (target: ${MACRO_TARGETS.fat}g)
- Trained today: ${fuelCtx.trained ?? "unknown"}
- Sleep last night: ${latestSleep !== null ? latestSleep + "h" : "unavailable"} (${fuelCtx.sleep ?? "unknown"} quality)
- HRV: ${latestHRV !== null ? latestHRV + " ms" : "unavailable"}
- Recent workouts: ${recentTraining || "none logged"}
- Goal priority today: ${fuelCtx.goal}

Give a specific recommendation for the next meal or eating window. Include:
1. What to eat (specific foods or meal type)
2. Approximate macros to hit
3. When to eat it
4. One sentence of reasoning based on the data

Keep it under 100 words. Be direct and specific. No generic advice.`;

  return callAnthropic(apiKey, prompt, 300);
}
