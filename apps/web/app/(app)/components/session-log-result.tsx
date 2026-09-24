import type { components } from "@/lib/api/schema";
import { FEEDBACK_TONE } from "@/lib/session-log";
import { cn } from "@/lib/utils";
import { equivalenceSuffix, formatKg } from "@/lib/workout-sets";

type SessionLogged = components["schemas"]["SessionLoggedBody"];

/** What the athlete sees after logging: the volume stat and the coach's comment. */
export function SessionLogResult({ result }: { result: SessionLogged }) {
  const volume = result.totalVolumeKg;
  return (
    <div className='space-y-1 pl-11'>
      <p className='text-muted-foreground text-xs'>Session logged — nice work.</p>
      {volume > 0 && (
        <p className='text-foreground text-xs font-medium'>
          You lifted {formatKg(volume)} kg total{equivalenceSuffix(volume)}
        </p>
      )}
      {result.feedback && (
        <p className={cn("text-xs", FEEDBACK_TONE[result.feedback.flag])}>{result.feedback.message}</p>
      )}
    </div>
  );
}
