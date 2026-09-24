import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "../components/coming-soon";

export const metadata: Metadata = { title: "Training · CoachIn" };

export default function TrainingPage() {
  return (
    <ComingSoon
      title='Training'
      greeting='Your programs and weekly routine'
      next='AI training plans (create, check in, archive) arrive here with the training module.'>
      <Button asChild variant='outline' className='self-start'>
        <Link href='/onboarding'>Edit my week</Link>
      </Button>
    </ComingSoon>
  );
}
