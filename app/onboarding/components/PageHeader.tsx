interface PageHeaderProps {
  title: string;
  description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className='mb-8 text-center'>
      <h1 className='text-3xl font-bold text-card-foreground'>{title}</h1>
      <p className='mt-2 text-muted-foreground'>{description}</p>
    </div>
  );
}
