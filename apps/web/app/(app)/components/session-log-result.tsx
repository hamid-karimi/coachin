import { ShareButton } from "@/components/design-system/share-button";
import type { components } from "@/lib/api/schema";
import { FEEDBACK_TONE } from "@/lib/session-log";
import type { ShareCardData } from "@/lib/share-card";
import { cn } from "@/lib/utils";
import { equivalenceSuffix, formatKg } from "@/lib/workout-sets";

type SessionLogged = components["schemas"]["SessionLoggedBody"];

/** What the athlete sees after logging: the volume stat, the coach's comment, and "Share it" once weights were logged. */
export function SessionLogResult({ result, share }: { result: SessionLogged; share: ShareCardData }) {
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
      {volume > 0 && <ShareButton data={share} label='Share it' />}
    </div>
  );
}
