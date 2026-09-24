interface AuthHeadingProps {
  title: string;
  subtitle: string;
}

export function AuthHeading({ title, subtitle }: AuthHeadingProps) {
  return (
    <div>
      <h1 className='text-foreground font-display text-3xl font-bold tracking-tight'>{title}</h1>
      <p className='text-muted-foreground mt-1.5'>{subtitle}</p>
    </div>
  );
}
