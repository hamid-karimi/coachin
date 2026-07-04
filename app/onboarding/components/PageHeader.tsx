interface PageHeaderProps {
  title: string;
  description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className='mb-6'>
      <p className='text-overline'>Your training week</p>
      <h1 className='text-foreground font-display mt-1 text-[26px] font-bold tracking-tight'>
        {title}
      </h1>
      <p className='text-muted-foreground mt-1 text-sm'>{description}</p>
    </div>
  );
}
