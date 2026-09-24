import type {
  TraineeSupplementRow,
  TraineeSupplementsData,
} from "../lib/trainee-supplements-data";
import { scheduleLabel } from "@/lib/supplement-schedule";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function takenRateLabel(row: TraineeSupplementRow): string {
  if (row.totalDueDays === 0) return "No due days in the last week";
  return `${row.takenDueDays}/${row.totalDueDays} due days`;
}

function SupplementRow({ row }: { row: TraineeSupplementRow }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <p className="text-foreground min-w-0 truncate">
        {row.name}
        {row.dose ? (
          <span className="text-muted-foreground"> · {row.dose}</span>
        ) : null}
        <span className="text-muted-foreground"> · {scheduleLabel(row)}</span>
      </p>
      <span className="text-muted-foreground shrink-0 text-xs">
        {takenRateLabel(row)}
      </span>
    </div>
  );
}

/** Read-only, coach-facing view of a trainee's daily supplement stack. */
export function TraineeSupplementsSection({
  data,
}: {
  data: TraineeSupplementsData;
}) {
  if (!data.sharingEnabled) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            {data.trainee.name} hasn&apos;t shared their nutrition with you.
            Their supplement stack appears here once they turn on Profile →
            Settings → &quot;Share nutrition with my coach&quot;.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (data.supplements.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm">
            {data.trainee.name} isn&apos;t tracking any supplements yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[15px] font-bold">Daily stack</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {data.supplements.map((row) => (
          <SupplementRow key={row.id} row={row} />
        ))}
      </CardContent>
    </Card>
  );
}
