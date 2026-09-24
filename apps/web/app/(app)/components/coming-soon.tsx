import { PageHeading } from "./page-heading";

interface ComingSoonProps {
  title: string;
  greeting: string;
  /** What arrives here, shown until the module is ported. */
  next: string;
  /** Links to surfaces that already work. */
  children?: React.ReactNode;
}

/** Placeholder for a surface whose module has not been ported yet. */
export function ComingSoon({ title, greeting, next, children }: ComingSoonProps) {
  return (
    <div className='mx-auto flex max-w-3xl flex-col gap-6'>
      <PageHeading title={title} subtitle={greeting} />
      <div className='bg-card border-border text-muted-foreground rounded-xl border p-6 text-sm'>{next}</div>
      {children}
    </div>
  );
}
