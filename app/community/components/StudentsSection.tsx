import type { StudentRelationship } from "../types";
import type { CoachInviteCodeSummary, SportTypeSummary } from "../types";
import { GenerateInviteCodeForm } from "./GenerateInviteCodeForm";
import { AssignPlanButton } from "./AssignPlanButton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface StudentsSectionProps {
  students: StudentRelationship[];
  sportTypes: SportTypeSummary[];
  inviteCodes: CoachInviteCodeSummary[];
  canManage: boolean;
}

export function StudentsSection({
  students,
  sportTypes,
  inviteCodes,
  canManage,
}: StudentsSectionProps) {
  const hasStudents = students.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-lg font-bold'>My Students</CardTitle>
      </CardHeader>

      <CardContent className='space-y-4'>
        {canManage && (
          <GenerateInviteCodeForm
            sportTypes={sportTypes}
            inviteCodes={inviteCodes}
          />
        )}

        {hasStudents ? (
          <ul className='space-y-3'>
            {students.map((relationship) => {
              const { student } = relationship;
              const initials = student.email?.[0]?.toUpperCase() ?? "?";

              return (
                <li
                  key={student.id}
                  className='flex items-center justify-between gap-3 rounded-xl bg-secondary p-3'>
                  <div className='flex min-w-0 items-center gap-3'>
                    <Avatar className='size-10'>
                      {student.avatar_url ? (
                        <AvatarImage
                          src={student.avatar_url}
                          alt={student.full_name ?? student.email ?? "Student"}
                        />
                      ) : null}
                      <AvatarFallback>{initials}</AvatarFallback>
                    </Avatar>
                    <div className='min-w-0'>
                      <p className='truncate text-sm font-semibold text-foreground'>
                        {student.full_name ||
                          student.email ||
                          "Unknown student"}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {relationship.sport_type?.name || "General coaching"} ·
                        Level {student.level ?? 1}
                      </p>
                    </div>
                  </div>
                  <div className='flex flex-col items-end gap-1'>
                    <Badge variant='xp'>
                      {student.xp?.toLocaleString() ?? 0} XP
                    </Badge>
                    {canManage && <AssignPlanButton studentId={student.id} />}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className='text-sm text-muted-foreground'>
            You don’t have students yet. Share your invite code.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
