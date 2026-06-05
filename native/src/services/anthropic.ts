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

const PANTRY = `PANTRY — the ONLY foods you may recommend. Never suggest anything not on this list.

PROTEINS:
- Egg Whites (Kirkland) — 110g: 60 cal, 12P, 0F, 0C
- Free Range Eggs (Happy Egg) — 1 egg (50g): 70 cal, 6P, 5F, 0C
- Chicken Sausage (ButcherBox) — 3 links (60g): 110 cal, 11P, 7F, 1C
- Raw Chicken (Costco) — 112g: 110 cal, 26P, 0F, 0C
- Ground Turkey 93/7 Cooked — 4oz (113g): 242 cal, 31P, 13F, 0C
- Ground Beef Cooked — 3.2oz (91g): 191 cal, 16P, 13F, 2C
- Sprouts Beef — 100g: 143 cal, 21P, 7F, 0C
- Blackened Salmon (Kirkland) — 5.5oz (156g): 308 cal, 30P, 21F, 0C
- Steak Bites (Fresh Additions) — 1 serving (91g): 120 cal, 20P, 3F, 1C

DAIRY:
- Oikos Triple Zero Yogurt (Dannon) — 1 container (150g): 100 cal, 15P, 0F, 10C
- Cottage Cheese (Kroger) — 100g: 71 cal, 12P, 0F, 5C
- Cottage Cheese Probiotic (Nancy's) — 1 serving (110g): 60 cal, 14P, 1F, 3C
- Almond Milk Vanilla Unsweetened (Blue Diamond) — 4oz: 14 cal, 1P, 1F, 0C
- Reddi Wip Zero — 2 tbsp (5g): 15 cal, 0P, 2F, 0C

PROTEIN SHAKES & BARS:
- Orgain 30g Protein Shake — 1 carton (330g): 160 cal, 30P, 3F, 7C
- Orgain Chocolate Protein Milk Shake — 1 carton (330g): 160 cal, 30P, 3F, 5C
- Cbum Vanilla Oatmeal Cookie (protein powder) — 1 scoop (33g): 120 cal, 25P, 1F, 3C
- Strawberry Bumcake (Bum protein powder) — 1 scoop (32g): 110 cal, 25P, 0F, 1C
- Built Bar — 1 bar (40g): 140 cal, 17P, 2F, 12C
- G2G Bar — 1 bar (70g): 300 cal, 18P, 14F, 25C
- Quest Mint Chocolate Chunk — 1 bar (60g): 170 cal, 20P, 6F, 24C
- Quest Chocolate Chip Cookie Dough — 1 bar (60g): 190 cal, 21P, 9F, 22C
- Built Sour Puff Blue Razz — 1 bar (41g): 150 cal, 16P, 3F, 15C
- Built Sour Puff Sweet Peach — 1 bar (41g): 150 cal, 16P, 2F, 15C

BREADS & CARBS:
- Big Bread Wolf Sourdough (Inked Bread) — 2 slices (54g): 60 cal, 8P, 2F, 22C
- Multigrain Keto Bread (Sara Lee) — 2 slices (44g): 90 cal, 6P, 1F, 18C
- Soft White Keto Bread (Nature's Own Life Keto): low-carb bread option
- Red Idaho Potatoes (Grown In Idaho) — 200g: 149 cal, 4P, 0F, 35C
- Apple Slices — 0.5 apple (90g): 47 cal, 0P, 0F, 12C
- PB2 Powdered Peanut Butter — 1 serving (13g): 60 cal, 6P, 2F, 5C

CONDIMENTS & EXTRAS:
- Good Good Sweet Jam (stevia) — 1oz: 6 cal, 0P, 0F, 6C
- Dates Syrup (Just) — 1 serving (7g): 20 cal, 0P, 0F, 5C
- SALTT Electrolytes — 0 cal
- Groovy Grapefruit Electrolyte (Saltt) — 1 stick: 1 cal

PREPARED MEALS:
- Mo Bettahs Lean Protein Plate — 1 plate: 652 cal, 76P, 8F, 67C`;



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
