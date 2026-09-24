interface PageHeadingProps {
  title: string;
  subtitle?: string;
}

export function PageHeading({ title, subtitle }: PageHeadingProps) {
  return (
    <div>
      <h1 className='text-foreground font-display text-2xl font-bold tracking-tight md:text-3xl'>{title}</h1>
      {subtitle && <p className='text-muted-foreground mt-1 truncate text-sm'>{subtitle}</p>}
    </div>
  );
}
