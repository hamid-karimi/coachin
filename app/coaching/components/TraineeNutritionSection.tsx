import type {
  TraineeNutritionData,
  TraineeNutritionDay,
} from "../lib/trainee-nutrition-data";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MEAL_TYPE_LABELS: Record<string, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
};

function formatDay(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

function DayCard({
  day,
  kcalTarget,
}: {
  day: TraineeNutritionDay;
  kcalTarget: number | null;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle className="text-[15px] font-bold">
          {formatDay(day.date)}
        </CardTitle>
        <Badge variant={kcalTarget && day.totalKcal > kcalTarget ? "flame" : "xp"}>
          {Math.round(day.totalKcal).toLocaleString()} kcal
          {kcalTarget ? ` / ${Math.round(kcalTarget).toLocaleString()}` : ""}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {day.meals.map((meal) => (
          <div
            key={meal.id}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <p className="text-foreground min-w-0 truncate">
              <span className="text-muted-foreground">
                {MEAL_TYPE_LABELS[meal.meal_type] ?? "Meal"} ·{" "}
              </span>
              {meal.label}
            </p>
            <span className="text-muted-foreground shrink-0 text-xs">
              {Math.round(meal.kcal)} kcal · {Math.round(meal.protein_g)}g
              protein
            </span>
          </div>
        ))}
        <p className="text-muted-foreground pt-1 text-xs">
          Day total: {Math.round(day.totalKcal).toLocaleString()} kcal ·{" "}
          {Math.round(day.totalProteinG)}g protein
        </p>
      </CardContent>
    </Card>
  );
}

/** Read-only, coach-facing view of a trainee's last week of nutrition. */
export function TraineeNutritionSection({
  data,
}: {
  data: TraineeNutritionData;
}) {
  if (!data.sharingEnabled) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            {data.trainee.name} hasn&apos;t shared their nutrition with you.
            They can turn it on under Profile → Settings → &quot;Share
            nutrition with my coach&quot;.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.days.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            No meals logged in the last 7 days.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {data.targets && (data.targets.kcal || data.targets.proteinG) ? (
        <p className="text-muted-foreground text-sm">
          Meal plan targets:{" "}
          {data.targets.kcal
            ? `${Math.round(data.targets.kcal).toLocaleString()} kcal`
            : ""}
          {data.targets.kcal && data.targets.proteinG ? " · " : ""}
          {data.targets.proteinG
            ? `${Math.round(data.targets.proteinG)}g protein`
            : ""}
        </p>
      ) : null}
      {data.days.map((day) => (
        <DayCard
          key={day.date}
          day={day}
          kcalTarget={data.targets?.kcal ?? null}
        />
      ))}
    </div>
  );
}
