/* ==========================================================================
   TAXONOMY — domains, workout types, meal names
   ========================================================================== */

export const DOMAINS = {
  overview: { label: "Overview", color: "var(--accent)" },
  activity: { label: "Activity", color: "var(--c-activity)", soft: "var(--c-activity-soft)" },
  recovery: { label: "Recovery", color: "var(--c-recovery)", soft: "var(--c-recovery-soft)" },
  sleep: { label: "Sleep", color: "var(--c-sleep)", soft: "var(--c-sleep-soft)" },
  nutrition: { label: "Nutrition", color: "var(--c-nutrition)", soft: "var(--c-nutrition-soft)" },
  body: { label: "Body", color: "var(--c-body)", soft: "var(--c-body-soft)" },
  mind: { label: "Mind", color: "var(--c-mind)", soft: "var(--c-mind-soft)" },
  trends: { label: "Trends", color: "var(--accent)" },
};

export const WORKOUT_TYPES = {
  run: { label: "Run", icon: "run" },
  strength: { label: "Strength", icon: "strength" },
  cycle: { label: "Cycling", icon: "cycle" },
  swim: { label: "Swimming", icon: "swim" },
  walk: { label: "Walk", icon: "walk" },
  yoga: { label: "Mobility", icon: "yoga" },
  hiit: { label: "HIIT", icon: "hiit" },
};

export const MEALS = ["Breakfast", "Lunch", "Dinner", "Snacks"];

export const MEAL_FOODS = {
  Breakfast: ["Oats, berries & whey", "Eggs, sourdough, avocado", "Greek yoghurt & granola", "Porridge & banana", "Smoked salmon bagel"],
  Lunch: ["Chicken grain bowl", "Tuna salad & rye", "Turkey wrap & fruit", "Lentil soup & bread", "Soba, edamame & greens", "Leftovers plate"],
  Dinner: ["Salmon, rice & greens", "Lean beef & potatoes", "Chicken stir-fry", "Pesto pasta & salad", "Tofu curry & quinoa", "Trout, greens & beans"],
  Snacks: ["Whey shake & almonds", "Apple & peanut butter", "Cottage cheese", "Protein bar", "Dark chocolate & walnuts", "Rice cakes & hummus"],
};
