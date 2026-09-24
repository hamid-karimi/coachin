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
        <CardTitle className='text-[15px] font-bold'>My coaches</CardTitle>
      </CardHeader>

      <CardContent className='space-y-4'>
        {canManage && <AddCoachByCodeForm />}

        {hasCoaches ? (
          <ul className='space-y-2'>
            {coaches.map((relationship) => {
              const { coach } = relationship;
              const initials = coach.email?.[0]?.toUpperCase() ?? "?";

              return (
                <li
                  key={coach.id}
                  className='bg-secondary flex items-center gap-3 rounded-lg p-3'>
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
                    <p className='text-foreground truncate text-sm font-semibold'>
                      {coach.full_name || coach.email || "Unknown coach"}
                    </p>
                    <Badge variant='outline' className='mt-1'>
                      {relationship.sport_type?.name || "General coaching"}
                    </Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className='text-muted-foreground text-sm'>
            No coach yet — got a code? Connect above.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
