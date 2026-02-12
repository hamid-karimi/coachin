interface PageHeaderProps {
  title: string;
  description: string;
}

export function PageHeader({ title, description }: PageHeaderProps) {
  return (
    <div className='text-center mb-8'>
      <h1 className='text-3xl font-bold text-slate-900 dark:text-white'>
        {title}
      </h1>
      <p className='text-slate-600 dark:text-slate-400 mt-2'>{description}</p>
    </div>
  );
}
