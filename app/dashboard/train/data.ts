// ─────────────────────────────────────────────────────────────
// Training & Fuel — program data
// Ported verbatim from the trey-training-app.html prototype, then
// extended: Block 2 accessory variants (gated), guided runs, and
// an expanded meal bank (+6 per category).
// ─────────────────────────────────────────────────────────────

export type Month = {
  name: string;
  block: string;
  scheme: string;
  weeks: string[]; // W1..W4 loading strings
  accessoryBlock: 1 | 2;
};

export const MONTHS: Month[] = [
  { name: "July", block: "Block 1 — Accumulation", scheme: "4×6", weeks: ["4×6 @ 70%", "4×6 @ 72.5%", "4×6 @ 75%", "Deload 3×5 @ 65%"], accessoryBlock: 1 },
  { name: "August", block: "Block 1 — Overload", scheme: "5×5", weeks: ["5×5 @ 75%", "5×5 @ 77.5%", "5×5 @ 80%", "Deload 3×5 @ 67.5%"], accessoryBlock: 1 },
  { name: "September", block: "Block 1 — Peak", scheme: "triples", weeks: ["5×3 @ 82.5%", "4×3 @ 85%", "Top 3 @ 87.5%", "Test 1–3RM → deload"], accessoryBlock: 1 },
  { name: "October", block: "Block 2 — Accumulation", scheme: "4×6", weeks: ["4×6 @ 72.5%", "4×6 @ 75%", "4×6 @ 77.5%", "Deload 3×5 @ 67.5%"], accessoryBlock: 2 },
  { name: "November", block: "Block 2 — Overload", scheme: "5×5", weeks: ["5×5 @ 77.5%", "5×5 @ 80%", "5×5 @ 82.5%", "Deload 3×5 @ 70%"], accessoryBlock: 2 },
  { name: "December", block: "Block 2 — Peak / Test", scheme: "top sets", weeks: ["4×4 @ 85%", "3×3 @ 87.5%", "Top 1–2 @ 90%", "Deload + year-end test"], accessoryBlock: 2 },
];

export const NUTRITION_MONTHS = [
  { name: "July", kcal: 3350, protein: 185, fat: 85, carbs: 455 },
  { name: "August", kcal: 3450, protein: 185, fat: 90, carbs: 480 },
  { name: "September", kcal: 3600, protein: 190, fat: 95, carbs: 500 },
  { name: "October", kcal: 3500, protein: 190, fat: 90, carbs: 490 },
  { name: "November", kcal: 3650, protein: 190, fat: 95, carbs: 515 },
  { name: "December", kcal: 3800, protein: 195, fat: 100, carbs: 540 },
];

export type Exercise = {
  name: string;
  setsreps: string;
  cue: string;
  sets: number;
  rest: number; // seconds
  isWarm?: boolean;
  isMain?: boolean;
  logWeight?: boolean;
};

export type Workout = { label: string; short: string; mainLift: MainLift; exercises: Exercise[] };
export type MainLift = "squat" | "bench" | "deadlift";

// Block 1 — verbatim from the prototype
export const WORKOUTS_B1: Record<"A" | "B" | "C", Workout> = {
  A: {
    label: "Day A — Mon — Lower (Squat priority)", short: "Lower (Squat)", mainLift: "squat",
    exercises: [
      { name: "Warm-up + squat ramp sets", setsreps: "—", cue: "5 min bike, hips/ankles, ramp to first work weight", sets: 1, rest: 0, isWarm: true },
      { name: "Back Squat", setsreps: "MAIN", cue: "Main lift — clean reps, 2 in the tank", sets: 4, rest: 210, isMain: true, logWeight: true },
      { name: "Power Clean", setsreps: "5×3", cue: "Explosive pull, reset each rep — bar speed over load", sets: 5, rest: 150, logWeight: true },
      { name: "Front Squat", setsreps: "3×8", cue: "Straight sets — upright torso, RPE 7", sets: 3, rest: 120, logWeight: true },
      { name: "Lying Leg Curl", setsreps: "3×12", cue: "Straight sets — RPE 7–8, control the negative", sets: 3, rest: 90, logWeight: true },
      { name: "B1 DB Walking Lunge / B2 Heel-Elevated Goblet Squat", setsreps: "3×10/leg / 3×12", cue: "DB-only superset, one spot — RPE 7–8", sets: 3, rest: 75 },
      { name: "C1 Standing Calf Raise / C2 Ab Wheel", setsreps: "4×15 / 4×12", cue: "Superset — full stretch, brace hard", sets: 4, rest: 60 },
      { name: "Finisher: Bike or sled intervals", setsreps: "5 min", cue: "Easy–moderate, flush the legs", sets: 1, rest: 0, isWarm: true },
      { name: "Stretch — Routine A", setsreps: "15 min", cue: "Hips, quads, glutes, low back — long passive holds", sets: 1, rest: 0, isWarm: true },
    ],
  },
  B: {
    label: "Day B — Thu — Upper (Bench priority)", short: "Upper (Bench)", mainLift: "bench",
    exercises: [
      { name: "Warm-up + bench ramp sets", setsreps: "—", cue: "5 min upper mobility, ramp to first work weight", sets: 1, rest: 0, isWarm: true },
      { name: "Bench Press", setsreps: "MAIN", cue: "Main lift — clean reps, 2 in the tank", sets: 4, rest: 210, isMain: true, logWeight: true },
      { name: "Incline DB Press", setsreps: "4×8–10", cue: "RPE 8 · controlled, full ROM", sets: 4, rest: 150, logWeight: true },
      { name: "A1 Barbell Row / A2 Lat Pulldown", setsreps: "4×10 / 4×12", cue: "Superset — chest up, pull to lower ribs", sets: 4, rest: 90, logWeight: true },
      { name: "B1 Weighted Dip / B2 Cable Fly", setsreps: "3×8–10 / 3×15", cue: "Superset — RPE 7–8", sets: 3, rest: 75 },
      { name: "C1 Lateral Raise / C2 Rope Pressdown", setsreps: "4×15 / 4×12", cue: "Superset — RPE 7–8", sets: 4, rest: 60 },
      { name: "Finisher: Standing Barbell Curl / Face Pull", setsreps: "3×12 / 3×20", cue: "Strict curls, high-rep rear delts", sets: 3, rest: 45 },
    ],
  },
  C: {
    label: "Day C — Fri — Deadlift + Vertical", short: "Deadlift + Vertical", mainLift: "deadlift",
    exercises: [
      { name: "Warm-up + deadlift ramp sets", setsreps: "—", cue: "5 min posterior-chain prep, ramp to first work weight", sets: 1, rest: 0, isWarm: true },
      { name: "Deadlift", setsreps: "MAIN", cue: "Main lift — clean reps, 2 in the tank", sets: 4, rest: 210, isMain: true, logWeight: true },
      { name: "Standing Barbell OHP", setsreps: "5×5", cue: "Hard top 5 — add 5 lb/week when clean", sets: 5, rest: 150, logWeight: true },
      { name: "A1 Weighted Pull-Up / A2 Chest-Supported DB Row", setsreps: "4×6–10 / 4×12", cue: "Superset — RPE 7–8", sets: 4, rest: 90, logWeight: true },
      { name: "B1 Lateral Raise / B2 Rear-Delt Fly", setsreps: "4×15 / 4×15", cue: "Superset — RPE 7–8", sets: 4, rest: 75 },
      { name: "C1 Hammer Curl / C2 Hanging Knee Raise", setsreps: "3×12 / 3×12", cue: "Superset — RPE 7–8", sets: 3, rest: 60 },
      { name: "Finisher: Suitcase Carry", setsreps: "3×40m/side", cue: "Tall posture, resist the lean", sets: 3, rest: 60 },
      { name: "Stretch — Routine C", setsreps: "15 min", cue: "Hamstrings, glutes, spine, grip", sets: 1, rest: 0, isWarm: true },
    ],
  },
};

// Block 2 (Oct–Dec) accessory rotation — main lifts identical.
// GATED: only used when block2Confirmed is on (Week tab). Confirm or
// tweak these before October.
export const WORKOUTS_B2: Record<"A" | "B" | "C", Workout> = {
  A: {
    label: "Day A — Mon — Lower (Squat priority)", short: "Lower (Squat)", mainLift: "squat",
    exercises: [
      { name: "Warm-up + squat ramp sets", setsreps: "—", cue: "5 min bike, hips/ankles, ramp to first work weight", sets: 1, rest: 0, isWarm: true },
      { name: "Back Squat", setsreps: "MAIN", cue: "Main lift — clean reps, 2 in the tank", sets: 4, rest: 210, isMain: true, logWeight: true },
      { name: "Power Clean", setsreps: "5×3", cue: "Explosive pull, reset each rep — bar speed over load", sets: 5, rest: 150, logWeight: true },
      { name: "Hack Squat", setsreps: "3×8", cue: "Straight sets — control depth, RPE 7", sets: 3, rest: 120, logWeight: true },
      { name: "Nordic Curl / GHR", setsreps: "3×8", cue: "Straight sets — slow negative, assist as needed", sets: 3, rest: 90, logWeight: true },
      { name: "B1 Bulgarian Split Squat / B2 Hip Thrust", setsreps: "3×10/leg / 3×10", cue: "Superset — RPE 7–8", sets: 3, rest: 75 },
      { name: "C1 Seated Calf Raise / C2 Hanging Leg Raise", setsreps: "4×15 / 4×12", cue: "Superset — full stretch, strict reps", sets: 4, rest: 60 },
      { name: "Finisher: Bike or sled intervals", setsreps: "5 min", cue: "Easy–moderate, flush the legs", sets: 1, rest: 0, isWarm: true },
      { name: "Stretch — Routine A", setsreps: "15 min", cue: "Hips, quads, glutes, low back — long passive holds", sets: 1, rest: 0, isWarm: true },
    ],
  },
  B: {
    label: "Day B — Thu — Upper (Bench priority)", short: "Upper (Bench)", mainLift: "bench",
    exercises: [
      { name: "Warm-up + bench ramp sets", setsreps: "—", cue: "5 min upper mobility, ramp to first work weight", sets: 1, rest: 0, isWarm: true },
      { name: "Bench Press", setsreps: "MAIN", cue: "Main lift — clean reps, 2 in the tank", sets: 4, rest: 210, isMain: true, logWeight: true },
      { name: "Close-Grip Bench Press", setsreps: "4×8", cue: "RPE 8 — elbows tucked, full lockout", sets: 4, rest: 150, logWeight: true },
      { name: "A1 Pendlay Row / A2 Single-Arm DB Row", setsreps: "4×8 / 4×12", cue: "Superset — strict off the floor, then stretch and pull", sets: 4, rest: 90, logWeight: true },
      { name: "B1 Machine Press / B2 Pec Deck", setsreps: "3×10 / 3×15", cue: "Superset — RPE 7–8", sets: 3, rest: 75 },
      { name: "C1 Lateral Raise / C2 Overhead Rope Extension", setsreps: "4×15 / 4×12", cue: "Superset — RPE 7–8", sets: 4, rest: 60 },
      { name: "Finisher: Incline DB Curl / Band Pull-Apart", setsreps: "3×12 / 3×20", cue: "Full stretch curls, high-rep rear delts", sets: 3, rest: 45 },
    ],
  },
  C: {
    label: "Day C — Fri — Deadlift + Vertical", short: "Deadlift + Vertical", mainLift: "deadlift",
    exercises: [
      { name: "Warm-up + deadlift ramp sets", setsreps: "—", cue: "5 min posterior-chain prep, ramp to first work weight", sets: 1, rest: 0, isWarm: true },
      { name: "Deadlift", setsreps: "MAIN", cue: "Main lift — clean reps, 2 in the tank", sets: 4, rest: 210, isMain: true, logWeight: true },
      { name: "Push Press", setsreps: "5×5", cue: "Drive from the legs, strict lockout — add when clean", sets: 5, rest: 150, logWeight: true },
      { name: "A1 Weighted Chin-Up / A2 Meadows Row", setsreps: "4×6–10 / 4×12", cue: "Superset — RPE 7–8", sets: 4, rest: 90, logWeight: true },
      { name: "B1 Lateral Raise / B2 Face Pull", setsreps: "4×15 / 4×20", cue: "Superset — RPE 7–8", sets: 4, rest: 75 },
      { name: "C1 Reverse Curl / C2 Cable Crunch", setsreps: "3×12 / 3×15", cue: "Superset — RPE 7–8", sets: 3, rest: 60 },
      { name: "Finisher: Suitcase Carry (heavy)", setsreps: "3×25m/side", cue: "Heavier, shorter — tall posture, resist the lean", sets: 3, rest: 60 },
      { name: "Stretch — Routine C", setsreps: "15 min", cue: "Hamstrings, glutes, spine, grip", sets: 1, rest: 0, isWarm: true },
    ],
  },
};

// ── Guided runs ───────────────────────────────────────────────
export type RunSegment = { label: string; minutes: number; kind: "easy" | "steady" | "tempo" | "hard" | "z2" };
export type RunPlan = { name: string; desc: string; segments: RunSegment[] };

// Wed evening run, progressing monthly (index matches MONTHS)
export const WED_RUNS: RunPlan[] = [
  { name: "Aerobic base — 38 min", desc: "Conversational pace throughout. Building the base.", segments: [
    { label: "Warm-up jog", minutes: 8, kind: "easy" }, { label: "Steady aerobic", minutes: 25, kind: "steady" }, { label: "Cool-down", minutes: 5, kind: "easy" } ] },
  { name: "Aerobic base+ — 43 min", desc: "Same effort, five more minutes. Still conversational.", segments: [
    { label: "Warm-up jog", minutes: 8, kind: "easy" }, { label: "Steady aerobic", minutes: 30, kind: "steady" }, { label: "Cool-down", minutes: 5, kind: "easy" } ] },
  { name: "Tempo intro — 43 min", desc: "3 × 6 min at comfortably-hard tempo, 2 min jog between.", segments: [
    { label: "Warm-up jog", minutes: 10, kind: "easy" },
    { label: "Tempo 1 of 3", minutes: 6, kind: "tempo" }, { label: "Easy jog", minutes: 2, kind: "easy" },
    { label: "Tempo 2 of 3", minutes: 6, kind: "tempo" }, { label: "Easy jog", minutes: 2, kind: "easy" },
    { label: "Tempo 3 of 3", minutes: 6, kind: "tempo" },
    { label: "Cool-down", minutes: 5, kind: "easy" } ] },
  { name: "Intervals — 6×3 min", desc: "3 min hard (not sprinting), 2 min jog. Six rounds.", segments: [
    { label: "Warm-up jog", minutes: 10, kind: "easy" },
    ...Array.from({ length: 6 }).flatMap((_, i) => ([
      { label: `Interval ${i + 1} of 6`, minutes: 3, kind: "hard" as const },
      { label: "Recovery jog", minutes: 2, kind: "easy" as const },
    ])),
    { label: "Cool-down", minutes: 5, kind: "easy" } ] },
  { name: "Tempo + strides — 42 min", desc: "One 8-min tempo, then 6 × 1 min quick with 1 min jog.", segments: [
    { label: "Warm-up jog", minutes: 10, kind: "easy" },
    { label: "Tempo", minutes: 8, kind: "tempo" }, { label: "Easy jog", minutes: 3, kind: "easy" },
    ...Array.from({ length: 6 }).flatMap((_, i) => ([
      { label: `Stride ${i + 1} of 6`, minutes: 1, kind: "hard" as const },
      { label: "Easy jog", minutes: 1, kind: "easy" as const },
    ])),
    { label: "Cool-down", minutes: 5, kind: "easy" } ] },
  { name: "Maintain — 38 min", desc: "Steady aerobic. Optional: swap for a 5K time trial once this month.", segments: [
    { label: "Warm-up jog", minutes: 8, kind: "easy" }, { label: "Steady aerobic", minutes: 25, kind: "steady" }, { label: "Cool-down", minutes: 5, kind: "easy" } ] },
];

export const SAT_RUN: RunPlan = {
  name: "Zone 2 — 75 min", desc: "Nasal-breathing easy. If you can't talk, slow down.",
  segments: [
    { label: "Warm-up jog", minutes: 5, kind: "easy" },
    { label: "Zone 2", minutes: 65, kind: "z2" },
    { label: "Cool-down", minutes: 5, kind: "easy" },
  ],
};

// ── Meal bank ─────────────────────────────────────────────────
export type Ingredient = { n: string; q: number; u: string; cat: string };
export type Meal = { name: string; kcal: number; p: number; c: number; f: number; ing: Ingredient[] };

export const MEALS: Record<"breakfast" | "lunch" | "dinner" | "snack", Meal[]> = {
  breakfast: [
    { name: "Greek Yogurt Power Bowl", kcal: 590, p: 50, c: 75, f: 10, ing: [ { n: "Nonfat Greek yogurt", q: 1.75, u: "cup", cat: "Dairy & Eggs" }, { n: "Granola", q: 0.5, u: "cup", cat: "Pantry" }, { n: "Berries", q: 1, u: "cup", cat: "Produce" }, { n: "Honey", q: 1, u: "tbsp", cat: "Pantry" } ] },
    { name: "Egg Bites + Bagel", kcal: 580, p: 40, c: 60, f: 20, ing: [ { n: "Refrigerated egg bites", q: 2, u: "pack", cat: "Dairy & Eggs" }, { n: "Whole-grain bagel", q: 1, u: "ea", cat: "Bakery" }, { n: "Cream cheese / jam", q: 1, u: "tbsp", cat: "Dairy & Eggs" } ] },
    { name: "PB-Banana Protein Oats", kcal: 606, p: 45, c: 75, f: 14, ing: [ { n: "Instant oats", q: 0.75, u: "cup", cat: "Pantry" }, { n: "Whey protein", q: 1, u: "scoop", cat: "Supplements" }, { n: "Banana", q: 1, u: "ea", cat: "Produce" }, { n: "Peanut butter", q: 1, u: "tbsp", cat: "Pantry" } ] },
    { name: "Cottage Cheese Pineapple Crunch", kcal: 540, p: 46, c: 65, f: 10, ing: [ { n: "Cottage cheese", q: 1.5, u: "cup", cat: "Dairy & Eggs" }, { n: "Pineapple chunks", q: 1, u: "cup", cat: "Produce" }, { n: "Granola", q: 0.33, u: "cup", cat: "Pantry" } ] },
    { name: "Berry Whey Smoothie + Oats", kcal: 640, p: 52, c: 80, f: 12, ing: [ { n: "Whey protein", q: 1.5, u: "scoop", cat: "Supplements" }, { n: "Instant oats", q: 0.5, u: "cup", cat: "Pantry" }, { n: "Banana", q: 1, u: "ea", cat: "Produce" }, { n: "Frozen berries", q: 1, u: "cup", cat: "Produce" }, { n: "Whole milk", q: 1, u: "cup", cat: "Dairy & Eggs" } ] },
    { name: "Smoked Salmon Bagel", kcal: 530, p: 35, c: 60, f: 13, ing: [ { n: "Whole-grain bagel", q: 1, u: "ea", cat: "Bakery" }, { n: "Smoked salmon", q: 4, u: "oz", cat: "Protein" }, { n: "Cream cheese / jam", q: 2, u: "tbsp", cat: "Dairy & Eggs" } ] },
    { name: "Overnight Oats Cup + Whey", kcal: 550, p: 40, c: 70, f: 9, ing: [ { n: "Overnight oats cup", q: 1, u: "ea", cat: "Pantry" }, { n: "Whey protein", q: 1, u: "scoop", cat: "Supplements" }, { n: "Banana", q: 1, u: "ea", cat: "Produce" } ] },
    { name: "Breakfast Sandwich + Yogurt", kcal: 550, p: 46, c: 50, f: 18, ing: [ { n: "High-protein breakfast sandwich (frozen)", q: 1, u: "ea", cat: "Protein" }, { n: "Nonfat Greek yogurt", q: 1, u: "cup", cat: "Dairy & Eggs" } ] },
    { name: "Hard-Boiled Eggs + Toast + Banana", kcal: 560, p: 32, c: 60, f: 22, ing: [ { n: "Hard-boiled eggs", q: 4, u: "ea", cat: "Dairy & Eggs" }, { n: "Whole-grain bread", q: 2, u: "slice", cat: "Bakery" }, { n: "Banana", q: 1, u: "ea", cat: "Produce" } ] },
  ],
  lunch: [
    { name: "Rotisserie Chicken Rice Bowl", kcal: 702, p: 55, c: 80, f: 18, ing: [ { n: "Rotisserie chicken", q: 6.5, u: "oz", cat: "Protein" }, { n: "Microwave rice pouch", q: 1, u: "pouch", cat: "Pantry" }, { n: "Steam-in-bag veg", q: 1, u: "bag", cat: "Produce" }, { n: "Salsa or teriyaki", q: 2, u: "tbsp", cat: "Pantry" } ] },
    { name: "Chicken Burrito Bowl", kcal: 778, p: 55, c: 90, f: 22, ing: [ { n: "Grilled chicken strips", q: 6, u: "oz", cat: "Protein" }, { n: "Rice", q: 1, u: "cup", cat: "Pantry" }, { n: "Black beans (canned)", q: 0.5, u: "cup", cat: "Pantry" }, { n: "Shredded cheese", q: 0.25, u: "cup", cat: "Dairy & Eggs" }, { n: "Avocado", q: 0.25, u: "ea", cat: "Produce" }, { n: "Salsa", q: 2, u: "tbsp", cat: "Pantry" } ] },
    { name: "Turkey, Cheese & Avocado Wrap", kcal: 658, p: 50, c: 65, f: 22, ing: [ { n: "Deli turkey", q: 5, u: "oz", cat: "Protein" }, { n: "Sliced cheese", q: 1, u: "slice", cat: "Dairy & Eggs" }, { n: "Avocado", q: 0.25, u: "ea", cat: "Produce" }, { n: "Large tortilla", q: 1, u: "ea", cat: "Bakery" }, { n: "Tomato/greens", q: 1, u: "handful", cat: "Produce" } ] },
    { name: "Sushi Roll Combo + Edamame", kcal: 600, p: 36, c: 92, f: 10, ing: [ { n: "Sushi roll combo (12 pc)", q: 1, u: "ea", cat: "Protein" }, { n: "Edamame cup", q: 1, u: "ea", cat: "Produce" } ] },
    { name: "Tuna & Rice Power Bowl", kcal: 600, p: 36, c: 70, f: 20, ing: [ { n: "Tuna pouch", q: 2, u: "ea", cat: "Protein" }, { n: "Microwave rice pouch", q: 1, u: "pouch", cat: "Pantry" }, { n: "Avocado", q: 0.5, u: "ea", cat: "Produce" }, { n: "Mayo packet", q: 1, u: "ea", cat: "Pantry" } ] },
    { name: "Chicken Caesar Wrap", kcal: 575, p: 48, c: 55, f: 18, ing: [ { n: "Grilled chicken strips", q: 5, u: "oz", cat: "Protein" }, { n: "Large tortilla", q: 1, u: "ea", cat: "Bakery" }, { n: "Caesar dressing + parmesan", q: 2, u: "tbsp", cat: "Dairy & Eggs" }, { n: "Romaine", q: 1, u: "handful", cat: "Produce" }, { n: "Croutons", q: 0.25, u: "cup", cat: "Pantry" } ] },
    { name: "Roast Beef Sandwich + Chocolate Milk", kcal: 675, p: 50, c: 78, f: 18, ing: [ { n: "Deli roast beef", q: 5, u: "oz", cat: "Protein" }, { n: "Whole-grain bread", q: 2, u: "slice", cat: "Bakery" }, { n: "Cheddar slice", q: 1, u: "slice", cat: "Dairy & Eggs" }, { n: "Chocolate milk", q: 1, u: "cup", cat: "Dairy & Eggs" } ] },
    { name: "Deli Pasta Salad + Grilled Chicken", kcal: 560, p: 48, c: 52, f: 18, ing: [ { n: "Deli pasta salad", q: 1.5, u: "cup", cat: "Pantry" }, { n: "Grilled chicken strips", q: 5, u: "oz", cat: "Protein" } ] },
    { name: "Ahi Poke Bowl", kcal: 580, p: 42, c: 80, f: 10, ing: [ { n: "Poke-grade ahi", q: 5, u: "oz", cat: "Protein" }, { n: "Microwave rice pouch", q: 1, u: "pouch", cat: "Pantry" }, { n: "Edamame cup", q: 0.5, u: "ea", cat: "Produce" }, { n: "Poke sauce", q: 1, u: "tbsp", cat: "Pantry" } ] },
  ],
  dinner: [
    { name: "Pre-Marinated Salmon + Rice", kcal: 732, p: 50, c: 70, f: 28, ing: [ { n: "Marinated salmon fillet", q: 6, u: "oz", cat: "Protein" }, { n: "Microwave rice pouch", q: 1, u: "pouch", cat: "Pantry" }, { n: "Steam-in-bag veg", q: 1, u: "bag", cat: "Produce" } ] },
    { name: "Quick Beef Taco Bowl", kcal: 785, p: 55, c: 85, f: 25, ing: [ { n: "Ground beef 93/7", q: 8, u: "oz", cat: "Protein" }, { n: "Taco seasoning", q: 1, u: "packet", cat: "Pantry" }, { n: "Rice or tortillas", q: 1, u: "serving", cat: "Pantry" }, { n: "Shredded cheese", q: 0.25, u: "cup", cat: "Dairy & Eggs" }, { n: "Salsa", q: 2, u: "tbsp", cat: "Pantry" } ] },
    { name: "Turkey Meatball Marinara + Pasta", kcal: 758, p: 50, c: 90, f: 22, ing: [ { n: "Pre-cooked turkey meatballs", q: 6, u: "ea", cat: "Protein" }, { n: "Jar marinara", q: 0.5, u: "jar", cat: "Pantry" }, { n: "Pasta", q: 3, u: "oz", cat: "Pantry" }, { n: "Parmesan", q: 2, u: "tbsp", cat: "Dairy & Eggs" } ] },
    { name: "Shrimp Stir-Fry + Rice", kcal: 640, p: 48, c: 85, f: 12, ing: [ { n: "Peeled shrimp", q: 8, u: "oz", cat: "Protein" }, { n: "Stir-fry veg bag", q: 1, u: "bag", cat: "Produce" }, { n: "Microwave rice pouch", q: 1, u: "pouch", cat: "Pantry" }, { n: "Teriyaki sauce", q: 2, u: "tbsp", cat: "Pantry" } ] },
    { name: "Chicken Sausage + Sweet Potato", kcal: 630, p: 44, c: 55, f: 26, ing: [ { n: "Chicken sausage links", q: 3, u: "ea", cat: "Protein" }, { n: "Microwave sweet potato", q: 2, u: "ea", cat: "Produce" }, { n: "Steam-in-bag broccoli", q: 1, u: "bag", cat: "Produce" } ] },
    { name: "Thin-Cut Sirloin + Mash + Salad", kcal: 670, p: 60, c: 45, f: 28, ing: [ { n: "Thin-cut sirloin", q: 8, u: "oz", cat: "Protein" }, { n: "Microwave mashed potatoes", q: 1, u: "pack", cat: "Pantry" }, { n: "Salad kit", q: 0.5, u: "bag", cat: "Produce" } ] },
    { name: "Rotisserie Chicken Quesadillas", kcal: 665, p: 52, c: 60, f: 24, ing: [ { n: "Rotisserie chicken", q: 5, u: "oz", cat: "Protein" }, { n: "Large tortilla", q: 2, u: "ea", cat: "Bakery" }, { n: "Shredded cheese", q: 0.5, u: "cup", cat: "Dairy & Eggs" }, { n: "Salsa", q: 2, u: "tbsp", cat: "Pantry" } ] },
    { name: "Pulled Pork + Mac Bowl", kcal: 685, p: 48, c: 60, f: 28, ing: [ { n: "Heat-and-eat pulled pork", q: 6, u: "oz", cat: "Protein" }, { n: "Prepared mac & cheese side", q: 1, u: "ea", cat: "Pantry" }, { n: "Coleslaw kit", q: 0.5, u: "bag", cat: "Produce" } ] },
    { name: "High-Protein Frozen Bowl + Yogurt", kcal: 640, p: 55, c: 65, f: 18, ing: [ { n: "High-protein frozen bowl", q: 1, u: "ea", cat: "Protein" }, { n: "Nonfat Greek yogurt", q: 1, u: "cup", cat: "Dairy & Eggs" } ] },
  ],
  snack: [
    { name: "Whey Shake + Fruit", kcal: 220, p: 26, c: 22, f: 3, ing: [ { n: "Whey protein", q: 1, u: "scoop", cat: "Supplements" }, { n: "Banana", q: 1, u: "ea", cat: "Produce" } ] },
    { name: "Greek Yogurt Cup", kcal: 150, p: 20, c: 12, f: 2, ing: [ { n: "Nonfat Greek yogurt", q: 1, u: "cup", cat: "Dairy & Eggs" } ] },
    { name: "Trail Mix Handful", kcal: 210, p: 7, c: 18, f: 14, ing: [ { n: "Trail mix", q: 0.33, u: "cup", cat: "Pantry" } ] },
    { name: "Beef Jerky + Apple", kcal: 250, p: 23, c: 30, f: 4, ing: [ { n: "Beef jerky", q: 1.5, u: "oz", cat: "Protein" }, { n: "Apple", q: 1, u: "ea", cat: "Produce" } ] },
    { name: "Cottage Cheese Cup", kcal: 165, p: 22, c: 8, f: 5, ing: [ { n: "Cottage cheese cup", q: 1, u: "ea", cat: "Dairy & Eggs" } ] },
    { name: "Protein Bar", kcal: 250, p: 20, c: 24, f: 8, ing: [ { n: "Protein bar", q: 1, u: "ea", cat: "Supplements" } ] },
    { name: "Chocolate Milk (16 oz)", kcal: 350, p: 16, c: 52, f: 9, ing: [ { n: "Chocolate milk", q: 2, u: "cup", cat: "Dairy & Eggs" } ] },
    { name: "Rice Cakes + Peanut Butter", kcal: 310, p: 9, c: 30, f: 17, ing: [ { n: "Rice cakes", q: 2, u: "ea", cat: "Pantry" }, { n: "Peanut butter", q: 1.5, u: "tbsp", cat: "Pantry" } ] },
    { name: "Hummus + Pretzels + Cheese Stick", kcal: 320, p: 14, c: 34, f: 14, ing: [ { n: "Hummus cup", q: 1, u: "ea", cat: "Pantry" }, { n: "Pretzels", q: 1, u: "oz", cat: "Pantry" }, { n: "String cheese", q: 1, u: "ea", cat: "Dairy & Eggs" } ] },
  ],
};

export const GROCERY_ORDER = ["Protein", "Produce", "Dairy & Eggs", "Bakery", "Pantry", "Supplements"];

// ── Loading math ──────────────────────────────────────────────
export function weekPct(weekStr: string): number | null {
  const m = weekStr.match(/@ ([\d.]+)%/);
  return m ? parseFloat(m[1]) : null;
}
export function isTestWeek(weekStr: string): boolean {
  return /test/i.test(weekStr);
}
export function isDeloadWeek(weekStr: string): boolean {
  return /deload/i.test(weekStr);
}
// TM = 90% of 1RM; working weight rounded to 5 lb
export function workingWeight(oneRM: number, pct: number): number {
  return Math.round((oneRM * 0.9 * pct) / 100 / 5) * 5;
}
export const MAIN_LIFT_NAMES: Record<MainLift, string> = {
  squat: "Back Squat",
  bench: "Bench Press",
  deadlift: "Deadlift",
};

// Bodyweight goal line: 165 lb on Jul 1 2026 → 185 lb on Dec 31 2026
export const GOAL = {
  start: { date: "2026-07-01", lb: 165 },
  end: { date: "2026-12-31", lb: 185 },
  weeklyPace: 0.75,
};
