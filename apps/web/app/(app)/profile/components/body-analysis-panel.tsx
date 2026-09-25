"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAnalyzePhotos, usePhotos } from "../hooks/use-profile";

/** Consent-gated AI read of the body photos, and the latest result. */
export function BodyAnalysisPanel() {
  const { bodyPhotos, analysis, consented } = usePhotos();
  const [consent, setConsent] = useState(consented);
  const analyze = useAnalyzePhotos();
  if (bodyPhotos.length === 0 && !analysis) return null;

  return (
    <>
      {bodyPhotos.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            analyze.mutate({ body: { consent } });
          }}
          className='bg-card border-border space-y-3 rounded-xl border p-4'>
          <label className='flex items-start gap-2.5 text-sm'>
            <input
              type='checkbox'
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className='accent-brand mt-0.5 size-4'
            />
            <span className='text-muted-foreground'>
              I consent to AI analysis of my photos to personalize my training program and diet.{" "}
              <span className='text-foreground font-medium'>Not medical advice.</span>
            </span>
          </label>
          <Button type='submit' variant='brand' disabled={analyze.isPending}>
            {analyze.isPending ? <Loader2 className='animate-spin' aria-hidden /> : <Sparkles aria-hidden />}
            {analyze.isPending ? "Analyzing…" : "Analyze my photos"}
          </Button>
        </form>
      )}
      {analysis && (
        <div className='bg-card border-border space-y-2 rounded-xl border p-4'>
          <p className='text-foreground inline-flex items-center gap-2 text-sm font-semibold'>
            <Sparkles className='text-brand size-4' aria-hidden />
            Body analysis
          </p>
          <p className='text-muted-foreground text-sm'>{analysis.buildNotes}</p>
          <p className='text-muted-foreground text-sm'>{analysis.postureNotes}</p>
          <ul className='text-muted-foreground list-disc space-y-1 pl-5 text-sm'>
            {analysis.trainingConsiderations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className='text-muted-foreground text-xs'>
            AI observations, not medical advice. Used to personalize your program and diet.
          </p>
        </div>
      )}
    </>
  );
}
