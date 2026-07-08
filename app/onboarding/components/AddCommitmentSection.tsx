import { AddCommitmentSheet } from "./AddCommitmentSheet";
import type { SportOption } from "./SportPicker";

interface AddCommitmentSectionProps {
  sports: SportOption[];
  /** Days (0-6) that already have a fixed session, for the day-strip dots. */
  plannedDays: number[];
}

/**
 * Entry point for adding commitments on the "My week" page: a single
 * prominent trigger that opens the stepwise add sheet (sport first, then
 * details) instead of rendering both inline forms on the page.
 */
export function AddCommitmentSection({
  sports,
  plannedDays,
}: AddCommitmentSectionProps) {
  return (
    <section className='mb-6'>
      <AddCommitmentSheet sports={sports} plannedDays={plannedDays} />
    </section>
  );
}
