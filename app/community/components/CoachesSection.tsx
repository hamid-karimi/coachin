import type { CoachRelationship } from "../types";
import { AddCoachByCodeForm } from "./AddCoachByCodeForm";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface CoachesSectionProps {
  coaches: CoachRelationship[];
  canManage: boolean;
}

export function CoachesSection({ coaches, canManage }: CoachesSectionProps) {
  const hasCoaches = coaches.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg font-bold'>My Coaches</CardTitle>
      </CardHeader>

      <CardContent className='space-y-4'>
        {canManage && <AddCoachByCodeForm />}

        {hasCoaches ? (
          <ul className='space-y-3'>
            {coaches.map((relationship) => {
              const { coach } = relationship;
              const initials = coach.email?.[0]?.toUpperCase() ?? "?";

              return (
                <li
                  key={coach.id}
                  className='flex items-center gap-3 rounded-xl bg-secondary p-3'>
                  <Avatar className='size-10'>
                    {coach.avatar_url ? (
                      <AvatarImage
                        src={coach.avatar_url}
                        alt={coach.full_name ?? coach.email ?? "Coach"}
                      />
                    ) : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-semibold text-foreground'>
                      {coach.full_name || coach.email || "Unknown coach"}
                    </p>
                    <Badge variant='secondary' className='mt-1'>
                      {relationship.sport_type?.name || "General coaching"}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className='text-sm text-muted-foreground'>
            You don’t have a coach yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
