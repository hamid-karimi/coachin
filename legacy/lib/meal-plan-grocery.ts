/**
 * Build a de-duplicated grocery list from a meal plan's items. Pure and
 * framework-free. Ingredients are matched case-insensitively by name; the
 * `count` is how many meals across the week use that ingredient.
 */

export interface PlanIngredient {
  name: string;
  qty?: string;
}

export interface GroceryLine {
  name: string;
  count: number;
}

export function buildGroceryList(
  items: { ingredients?: PlanIngredient[] | null }[],
): GroceryLine[] {
  const byKey = new Map<string, GroceryLine>();

  for (const item of items) {
    for (const ingredient of item.ingredients ?? []) {
      const name = (ingredient?.name ?? "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      const existing = byKey.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        byKey.set(key, { name, count: 1 });
      }
    }
  }

  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name));
}
