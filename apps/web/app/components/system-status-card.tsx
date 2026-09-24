import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ServiceCheck, SystemStatus } from "@/lib/api/system-status";

const STATE_META = {
  healthy: { icon: CheckCircle2, tone: "text-success", badge: "success", label: "All systems go" },
  degraded: { icon: XCircle, tone: "text-destructive", badge: "destructive", label: "Degraded" },
} as const;

function CheckRow({ check }: { check: ServiceCheck }) {
  const meta = STATE_META[check.healthy ? "healthy" : "degraded"];
  const Icon = meta.icon;
  return (
    <li className='flex items-center justify-between gap-4 py-2'>
      <span className='flex items-center gap-2 font-medium capitalize'>
        <Icon className={`size-4 ${meta.tone}`} aria-hidden />
        {check.name}
      </span>
      <span className='truncate text-sm text-muted-foreground'>
        {check.detail}
      </span>
    </li>
  );
}

export function SystemStatusCard({ status }: { status: SystemStatus }) {
  const meta = STATE_META[status.healthy ? "healthy" : "degraded"];
  return (
    <Card className='w-full max-w-md'>
      <CardHeader>
        <p className='text-overline'>Rewrite · Phase 0</p>
        <CardTitle className='font-display text-2xl'>CoachIn</CardTitle>
        <CardDescription>
          Go API + Next.js on the local Docker stack.
        </CardDescription>
        <Badge variant={meta.badge}>{meta.label}</Badge>
      </CardHeader>
      <CardContent>
        <ul className='divide-y divide-border'>
          {status.checks.map((check) => (
            <CheckRow key={check.name} check={check} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
