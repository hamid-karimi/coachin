import { NextResponse, type NextRequest } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";

export type FoodResult = {
  id: string | null;
  name: string;
  kcal_per_100g: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  fiber_g: number;
  sodium_mg: number;
  source: string;
};

/**
 * Food autocomplete: local-first (?q=), explicit USDA fallback (?q=&remote=1).
 * USDA FoodData Central: free key, 1000 req/hr — only hit on user request,
 * never per keystroke (roadmap anti-pattern).
 */
export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (query.length < 2) {
    return NextResponse.json({ foods: [] });
  }

  if (req.nextUrl.searchParams.get("remote") === "1") {
    const apiKey = process.env.USDA_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "USDA search is not configured" },
        { status: 501 },
      );
    }
    try {
      const response = await fetch(
        `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}` +
          `&query=${encodeURIComponent(query)}&pageSize=6` +
          `&dataType=Foundation,SR%20Legacy`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(`FDC ${response.status}`);
      const payload = (await response.json()) as {
        foods?: {
          description?: string;
          foodNutrients?: { nutrientNumber?: string; value?: number }[];
        }[];
      };
      const nutrient = (
        food: NonNullable<typeof payload.foods>[number],
        number: string,
      ) =>
        food.foodNutrients?.find(
          (entry) => entry.nutrientNumber === number,
        )?.value ?? 0;
      const foods: FoodResult[] = (payload.foods ?? [])
        .map((food) => ({
          id: null,
          name: String(food.description ?? "").slice(0, 200),
          kcal_per_100g: Math.round(nutrient(food, "208")),
          protein_g: Math.round(nutrient(food, "203") * 10) / 10,
          carbs_g: Math.round(nutrient(food, "205") * 10) / 10,
          fat_g: Math.round(nutrient(food, "204") * 10) / 10,
          sugar_g: Math.round(nutrient(food, "269") * 10) / 10,
          fiber_g: Math.round(nutrient(food, "291") * 10) / 10,
          sodium_mg: Math.round(nutrient(food, "307")),
          source: "usda",
        }))
        .filter((food) => food.name && food.kcal_per_100g > 0);
      return NextResponse.json({ foods });
    } catch (error) {
      console.error("USDA search failed:", error);
      return NextResponse.json(
        { error: "USDA search failed — try again later" },
        { status: 502 },
      );
    }
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("foods")
    .select(
      "id, name, kcal_per_100g, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg, source",
    )
    .ilike("name", `%${query}%`)
    .order("source")
    .limit(8);

  // sugar/fiber/sodium are nullable on foods; normalise to 0 for the client.
  const foods: FoodResult[] = (data ?? []).map((food) => ({
    ...food,
    sugar_g: Number(food.sugar_g) || 0,
    fiber_g: Number(food.fiber_g) || 0,
    sodium_mg: Number(food.sodium_mg) || 0,
  })) as FoodResult[];

  return NextResponse.json({ foods });
}
