import { LabResult } from "../types/health";

// Seeded from lab report (Access Medical Laboratories).
// Date approximate — update entries if you know the exact draw date.
export const LABS_SEED: LabResult[] = [
  // Complete Blood Count
  { id: "seed-wbc",  date: "2025-05-15", name: "White Blood Cell",       value: "5.2",   reference: "3.9–11.4 K/ul",    status: "green" },
  { id: "seed-rbc",  date: "2025-05-15", name: "Red Blood Cell",          value: "5.13",  reference: "4.20–6.00 M/ul",   status: "green" },
  { id: "seed-hgb",  date: "2025-05-15", name: "Hemoglobin",              value: "15.9",  reference: "13.2–18.0 g/dl",   status: "green" },
  { id: "seed-hct",  date: "2025-05-15", name: "Hematocrit",              value: "48.3",  reference: "42.0–56.0 %",      status: "green" },
  { id: "seed-mcv",  date: "2025-05-15", name: "MCV",                     value: "94",    reference: "83–102 fl",        status: "green" },
  { id: "seed-mch",  date: "2025-05-15", name: "MCH",                     value: "31.0",  reference: "26.0–34.0 pg",     status: "green" },
  { id: "seed-mchc", date: "2025-05-15", name: "MCHC",                    value: "32.9",  reference: "29.5–35.5 g/dl",   status: "green" },
  { id: "seed-rdw",  date: "2025-05-15", name: "RDW",                     value: "12.5",  reference: "11.0–15.5 %",      status: "green" },
  { id: "seed-plt",  date: "2025-05-15", name: "Platelet Count",          value: "267",   reference: "140–400 K/ul",     status: "green" },
  { id: "seed-mpv",  date: "2025-05-15", name: "MPV",                     value: "10.2",  reference: "7.5–11.6 fl",      status: "green" },

  // General Chemistry
  { id: "seed-glc",  date: "2025-05-15", name: "Glucose",                 value: "91",    reference: "74–109 mg/dl",     status: "green" },
  { id: "seed-bun",  date: "2025-05-15", name: "BUN",                     value: "27",    reference: "6–20 mg/dl",       status: "red"   },
  { id: "seed-cre",  date: "2025-05-15", name: "Creatinine",              value: "1.1",   reference: "0.7–1.2 mg/dl",   status: "green" },
  { id: "seed-bunr", date: "2025-05-15", name: "BUN/Creat Ratio",         value: "25",    reference: "7.3–21.7",         status: "red"   },
  { id: "seed-na",   date: "2025-05-15", name: "Sodium",                  value: "143",   reference: "136–145 mmol/L",   status: "green" },
  { id: "seed-k",    date: "2025-05-15", name: "Potassium",               value: "4.9",   reference: "3.5–5.1 mmol/L",  status: "green" },
  { id: "seed-cl",   date: "2025-05-15", name: "Chloride",                value: "106",   reference: "98–107 mmol/L",    status: "green" },
  { id: "seed-co2",  date: "2025-05-15", name: "CO2",                     value: "22",    reference: "22–29 mmol/L",     status: "green" },
  { id: "seed-ca",   date: "2025-05-15", name: "Calcium",                 value: "9.5",   reference: "8.6–10 mg/dl",    status: "green" },
  { id: "seed-mg",   date: "2025-05-15", name: "Magnesium",               value: "1.9",   reference: "1.6–2.6 mg/dl",   status: "green" },
  { id: "seed-tp",   date: "2025-05-15", name: "Total Protein",           value: "6.1",   reference: "6.4–8.3 g/dl",    status: "red"   },
  { id: "seed-alb",  date: "2025-05-15", name: "Albumin",                 value: "4.3",   reference: "3.5–5.2 g/dl",    status: "green" },
  { id: "seed-glob", date: "2025-05-15", name: "Globulin",                value: "1.8",   reference: "2.1–3.6 g/dl",    status: "red"   },
  { id: "seed-agr",  date: "2025-05-15", name: "Alb/Glob Ratio",         value: "2.4",   reference: "0.8–2.0",          status: "red"   },
  { id: "seed-bili", date: "2025-05-15", name: "Bilirubin, Total",        value: "0.7",   reference: "0–1.2 mg/dl",      status: "green" },
  { id: "seed-alp",  date: "2025-05-15", name: "Alkaline Phosphatase",    value: "73",    reference: "40–129 U/L",       status: "green" },
  { id: "seed-alt",  date: "2025-05-15", name: "ALT",                     value: "20",    reference: "0–41 U/L",         status: "green" },
  { id: "seed-ast",  date: "2025-05-15", name: "AST",                     value: "18",    reference: "0–40 U/L",         status: "green" },
  { id: "seed-gfr",  date: "2025-05-15", name: "GFR (estimated)",         value: "75",    reference: ">60 ml/min",       status: "green" },

  // Diabetes Evaluation
  { id: "seed-a1c",  date: "2025-05-15", name: "Hemoglobin A1C",          value: "5.2",   reference: "<5.7 %",           status: "green" },
  { id: "seed-ins",  date: "2025-05-15", name: "Insulin",                 value: "5.9",   reference: "2.6–24.9 uIU/ml", status: "green" },

  // Iron / Anemia
  { id: "seed-fer",  date: "2025-05-15", name: "Ferritin",                value: "158.0", reference: "30–400 ng/ml",     status: "green" },
  { id: "seed-b12",  date: "2025-05-15", name: "Vitamin B12",             value: "1201",  reference: "232–1245 pg/ml",   status: "green" },
  { id: "seed-fol",  date: "2025-05-15", name: "Folate",                  value: "5.0",   reference: "4.6–34.8 ng/ml",  status: "amber" },

  // Coronary Risk
  { id: "seed-trig", date: "2025-05-15", name: "Triglycerides",           value: "76",    reference: "0–150 mg/dl",      status: "green" },
  { id: "seed-chol", date: "2025-05-15", name: "Total Cholesterol",       value: "265",   reference: "0–200 mg/dl",      status: "red"   },
  { id: "seed-hdl",  date: "2025-05-15", name: "HDL Cholesterol",         value: "63",    reference: ">60 mg/dl",        status: "green" },
  { id: "seed-ratio",date: "2025-05-15", name: "Chol/HDL Ratio",          value: "4",     reference: "<5.0",             status: "green" },
  { id: "seed-ldl",  date: "2025-05-15", name: "LDL Cholesterol",         value: "189",   reference: "<100 mg/dl",       status: "red"   },
  { id: "seed-hcy",  date: "2025-05-15", name: "Homocysteine",            value: "9.8",   reference: "0–15 umol/L",      status: "green" },
  { id: "seed-lpa",  date: "2025-05-15", name: "Lipoprotein(a)",          value: "108.6", reference: "0–30 mg/dl",       status: "red"   },
  { id: "seed-plac", date: "2025-05-15", name: "Lp-PLA2",                 value: "234",   reference: "<225 U/L",         status: "red"   },
  { id: "seed-apoa", date: "2025-05-15", name: "ApoA-1",                  value: "169",   reference: "104–202 mg/dl",    status: "green" },
  { id: "seed-apob", date: "2025-05-15", name: "ApoB",                    value: "123",   reference: "66–133 mg/dl",     status: "amber" },

  // Thyroid Testing
  { id: "seed-t3",   date: "2025-05-15", name: "T3, Free",                value: "2.8",   reference: "2–4.4 pg/ml",      status: "green" },
  { id: "seed-t4",   date: "2025-05-15", name: "T4, Free",                value: "1.26",  reference: "0.92–1.68 ng/dl",  status: "green" },
  { id: "seed-tsh",  date: "2025-05-15", name: "TSH",                     value: "2.450", reference: "0.27–4.2 uIU/ml",  status: "green" },

  // Tumor Markers
  { id: "seed-psa",  date: "2025-05-15", name: "PSA, Total",              value: "0.423", reference: "0–4 ng/ml",        status: "green" },

  // Endocrine Evaluation
  { id: "seed-fsh",  date: "2025-05-15", name: "FSH",                     value: "4.5",   reference: "1.5–12.4 mIU/ml", status: "green" },
  { id: "seed-lh",   date: "2025-05-15", name: "LH",                      value: "2.4",   reference: "1.7–8.6 mIU/ml",  status: "green" },
  { id: "seed-prl",  date: "2025-05-15", name: "Prolactin",               value: "5.7",   reference: "3.9–22.7 ng/ml",  status: "green" },
  { id: "seed-e2",   date: "2025-05-15", name: "Estradiol (E2)",          value: "<5",    reference: "11.3–43.2 pg/mL", status: "red"   },
  { id: "seed-dhea", date: "2025-05-15", name: "DHEA-Sulfate",            value: "118.0", reference: "88.9–427 ug/dl",   status: "green" },
  { id: "seed-test", date: "2025-05-15", name: "Testosterone, Total",     value: "446",   reference: "238–1048 ng/dl",   status: "green" },
  { id: "seed-shbg", date: "2025-05-15", name: "SHBG",                    value: "34",    reference: "16.5–55.9 nmol/L", status: "green" },
  { id: "seed-free", date: "2025-05-15", name: "Testosterone, Free",      value: "9.1",   reference: "5.7–17.9 ng/dl",   status: "green" },
  { id: "seed-cort", date: "2025-05-15", name: "Cortisol",                value: "16.2",  reference: "6.02–18.4 ug/dl",  status: "green" },

  // Other Tests
  { id: "seed-vitd", date: "2025-05-15", name: "Vitamin D",               value: "35",    reference: "30–100 ng/ml",     status: "amber" },
  { id: "seed-crp",  date: "2025-05-15", name: "CRP",                     value: "<3",    reference: "<5 mg/L",          status: "green" },
];
