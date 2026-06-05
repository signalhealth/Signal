import { HealthData, AppState, FuelCtx, UserProfile, LabResult, MACRO_TARGETS, WaterEntry } from "../types/health";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";

function localDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function timeOfDay(): "morning" | "midday" | "evening" {
  const h = new Date().getHours();
  if (h < 11) return "morning";
  if (h < 16) return "midday";
  return "evening";
}

const PANTRY = `PANTRY (the ONLY foods you may recommend — never suggest anything not on this list):
[PANTRY LIST NOT SET — the user has not provided their pantry yet]`;


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

export async function analyzeLab(
  apiKey: string,
  lab: LabResult,
  allLabs: LabResult[],
  profile: UserProfile
): Promise<AnthropicResult> {
  const direction =
    lab.status === "red"
      ? lab.direction === "low"
        ? "below range (LOW)"
        : "above range (HIGH)"
      : "borderline (MONITOR)";

  const otherFlagged = allLabs
    .filter((l) => (l.status === "red" || l.status === "amber") && l.id !== lab.id)
    .map((l) => `- ${l.name}: ${l.value} (ref ${l.reference}) [${l.direction === "low" ? "LOW" : l.status === "red" ? "HIGH" : "MONITOR"}]`)
    .join("\n");

  const profileSection = buildProfileSection(profile);

  const prompt = `You are Signal, a precision health intelligence advisor. Explain this lab result clearly and give actionable guidance.
${profileSection ? "\n" + profileSection + "\n" : ""}
SELECTED MARKER:
- Name: ${lab.name}
- Value: ${lab.value}
- Reference range: ${lab.reference}
- Status: ${direction}
- Draw date: ${lab.date}

OTHER FLAGGED / MONITOR MARKERS (context):
${otherFlagged || "None"}

Respond with exactly these four sections:
1. WHAT IT MEASURES — one sentence, plain language
2. WHAT THIS MEANS — why this result is flagged and what it signals about health
3. TOP LEVERS — 3 specific, actionable items (foods, supplements with doses, or lifestyle changes)
4. WORTH ASKING — one follow-up test or question for the doctor (skip if not relevant)

Under 200 words. Be direct and specific. No excessive medical disclaimers.`;

  return callAnthropic(apiKey, prompt, 500);
}

export async function analyzeFuel(
  apiKey: string,
  data: HealthData,
  fuelCtx: FuelCtx,
  appState: AppState,
  profile: UserProfile
): Promise<AnthropicResult> {
  const today = localDate();
  const tod = timeOfDay();
  const todayNutrition = data.nutrition.find((n) => n.date === today) ?? null;

  const cals = todayNutrition?.cals ?? 0;
  const protein = todayNutrition?.protein ?? 0;
  const carbs = todayNutrition?.carbs ?? 0;
  const fat = todayNutrition?.fat ?? 0;

  const calTarget = profile.calorieTarget ? parseInt(profile.calorieTarget, 10) : MACRO_TARGETS.calories;
  const proteinTarget = profile.proteinTarget ? parseInt(profile.proteinTarget, 10) : MACRO_TARGETS.protein;
  const carbTarget = profile.carbTarget ? parseInt(profile.carbTarget, 10) : MACRO_TARGETS.carbs;
  const fatTarget = profile.fatTarget ? parseInt(profile.fatTarget, 10) : MACRO_TARGETS.fat;

  const weightSorted = [...data.weight].sort((a, b) => a.date.localeCompare(b.date));
  const latestWeight = weightSorted[weightSorted.length - 1]?.value ?? null;

  const bfSorted = [...data.bodyFat].sort((a, b) => a.date.localeCompare(b.date));
  const latestBF = bfSorted[bfSorted.length - 1]?.value ?? appState.dexa[appState.dexa.length - 1]?.bodyFat ?? null;

  const lmSorted = [...data.leanMass].sort((a, b) => a.date.localeCompare(b.date));
  const latestLM = lmSorted[lmSorted.length - 1]?.value ?? appState.dexa[appState.dexa.length - 1]?.leanMass ?? null;

  const hrvSorted = [...data.hrv].sort((a, b) => a.date.localeCompare(b.date));
  const latestHRV = hrvSorted[hrvSorted.length - 1]?.value ?? null;

  const sleepSorted = [...data.sleep].sort((a, b) => a.date.localeCompare(b.date));
  const latestSleep = sleepSorted[sleepSorted.length - 1]?.value ?? null;

  const recentTraining = data.exercise
    .slice(0, 3)
    .map((e) => `${e.title} (${e.duration}min)`)
    .join(", ");

  const todayWaterOz = (appState.water as WaterEntry[]).find((w) => w.date === today)?.oz ?? 0;

  const profileSection = buildProfileSection(profile);

  const mealWindow = tod === "morning"
    ? "breakfast or morning meal"
    : tod === "midday"
    ? "lunch or midday meal"
    : "dinner or evening meal";

  const prompt = `You are Signal, a precision health intelligence advisor. Give a specific, actionable nutrition recommendation.
${profileSection ? "\n" + profileSection + "\n" : ""}
TIME OF DAY: ${tod.toUpperCase()} — recommend ${mealWindow} options.

TODAY'S DATA:
- Weight: ${latestWeight !== null ? latestWeight + " lbs" : "unavailable"}
${latestBF !== null ? `- Body fat: ${latestBF}%` : ""}
${latestLM !== null ? `- Lean mass: ${latestLM} lbs` : ""}
- Calories consumed: ${cals} kcal (remaining: ${calTarget - cals} kcal of ${calTarget} target)
- Protein: ${protein}g (remaining: ${Math.max(0, proteinTarget - protein)}g of ${proteinTarget}g target)
- Carbs: ${carbs}g (target: ${carbTarget}g)
- Fat: ${fat}g (target: ${fatTarget}g)
- Water: ${todayWaterOz} oz today
- Trained today: ${fuelCtx.trained ?? "unknown"}
- Sleep last night: ${latestSleep !== null ? latestSleep + "h" : "unavailable"} (${fuelCtx.sleep ?? "unknown"} quality)
- HRV: ${latestHRV !== null ? latestHRV + " ms" : "unavailable"}
- Recent workouts: ${recentTraining || "none logged"}
- Goal priority today: ${fuelCtx.goal}

${PANTRY}

RULES:
- ONLY recommend foods from the pantry list above. Never suggest foods not on that list.
- Tailor the recommendation to the time of day (${tod}: ${mealWindow}).
- Use markdown formatting: bold the food names, use a short numbered or bulleted list.
- Keep it under 150 words. Be direct. No generic advice.`;

  return callAnthropic(apiKey, prompt, 400);
}
