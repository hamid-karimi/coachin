"use client";

import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SportIcon } from "@/components/design-system/sport-chip";
import { sportFromName } from "@/lib/sports";
import { cn } from "@/lib/utils";
import { WEEK_DAYS } from "@/lib/week-days";
import { useAddSession } from "../hooks";

export interface SportType {
  id: string | number;
  name: string;
  [key: string]: unknown;
}

interface DaySportPickerProps {
  /** Weekday id (0-6) this picker was opened for; pre-selected in "also on". */
  entryDay: number;
  sports: SportType[];
  /** Dispatches the `addScheduleSessions` server action with the built form. */
  addAction: (formData: FormData) => void;
  onClose: () => void;
  isPending?: boolean;
}

const FOCUS_RING =
  "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40";

/**
 * Inline day-first session composer rendered beneath a day row in the agenda
 * (one code path on every screen size). Pick a sport, optionally fan it out to
 * other days via "also on", tuck time + repeat-until behind "More options",
 * then Add — all without leaving the week. Never surfaces an XP multiplier.
 */
export function DaySportPicker({
  entryDay,
  sports,
  addAction,
  onClose,
  isPending = false,
}: DaySportPickerProps) {
  const {
    sportId,
    days,
    moreOptionsOpen,
    canAdd,
    selectSport,
    toggleDay,
    toggleMoreOptions,
  } = useAddSession(entryDay);

  // useActionState dispatches must run inside a transition (same pattern as
  // ConfirmDialog wrapping onConfirm).
  const [, startAdd] = useTransition();

  function handleSubmit(formData: FormData) {
    if (!canAdd) return;
    startAdd(() => addAction(formData));
    onClose();
  }

  if (sports.length === 0) {
    return (
      <div className="border-border bg-card rounded-lg border border-dashed p-4">
        <p className="text-muted-foreground text-sm">
          No sports available yet. Ask your coach to add sports before planning
          your week.
        </p>
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="border-border bg-card flex flex-col gap-4 rounded-lg border p-4"
    >
      {[...days].map((day) => (
        <input key={day} type="hidden" name="day_of_week" value={day} readOnly />
      ))}
      <input type="hidden" name="sport_type_id" value={sportId} readOnly />

      {/* Sport grid — icon + name only, never a multiplier. */}
      <div className="flex flex-col gap-2">
        <Label>Sport</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {sports.map((sport) => {
            const value = String(sport.id);
            const active = sportId === value;
            return (
              <button
                key={sport.id}
                type="button"
                onClick={() => selectSport(value)}
                disabled={isPending}
                aria-pressed={active}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors disabled:opacity-50",
                  FOCUS_RING,
                  active
                    ? "border-brand bg-brand-tint"
                    : "border-border bg-background hover:border-muted-foreground/40",
                )}
              >
                <SportIcon
                  sport={sportFromName(sport.name)}
                  className="size-9 shrink-0 rounded-md"
                />
                <span className="text-foreground truncate text-sm font-semibold">
                  {sport.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* "Also on" — fan the sport out to other days. */}
      <div className="flex flex-col gap-2">
        <Label>Also on</Label>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_DAYS.map((day) => {
            const active = days.has(day.id);
            return (
              <button
                key={day.id}
                type="button"
                onClick={() => toggleDay(day.id)}
                disabled={isPending}
                aria-pressed={active}
                aria-label={day.name}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50",
                  FOCUS_RING,
                  active
                    ? "border-brand bg-brand text-brand-foreground"
                    : "border-border bg-background text-muted-foreground hover:border-muted-foreground/40",
                )}
              >
                {day.short}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsed time + repeat-until. */}
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={toggleMoreOptions}
          aria-expanded={moreOptionsOpen}
          className={cn(
            "text-muted-foreground hover:text-foreground w-fit rounded-md text-xs font-semibold",
            FOCUS_RING,
          )}
        >
          {moreOptionsOpen ? "Hide options" : "More options"}
        </button>

        {moreOptionsOpen && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="picker-time">Time (optional)</Label>
              <Input
                id="picker-time"
                type="time"
                name="time"
                className="w-36"
                disabled={isPending}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="picker-ends">Repeat until (optional)</Label>
              <Input
                id="picker-ends"
                type="date"
                name="ends_on"
                className="w-44"
                disabled={isPending}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          variant="brand"
          size="sm"
          disabled={isPending || !canAdd}
        >
          {isPending ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  );
}
