export default function TrainingLoading() {
  return (
    <div className='mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8'>
      <div className='animate-pulse space-y-8'>
        {/* Header: title + description + action buttons */}
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-2'>
            <div className='bg-secondary h-7 w-44 rounded-md' />
            <div className='bg-secondary h-4 w-72 rounded-md' />
          </div>
          <div className='flex gap-2'>
            <div className='bg-secondary h-8 w-28 rounded-md' />
            <div className='bg-secondary h-8 w-28 rounded-md' />
          </div>
        </div>
        {/* A plan section: title, week nav, day items */}
        <div className='space-y-5'>
          <div className='space-y-2'>
            <div className='bg-secondary h-6 w-56 rounded-md' />
            <div className='bg-secondary h-4 w-48 rounded-md' />
          </div>
          <div className='flex items-center justify-between'>
            <div className='bg-secondary h-8 w-24 rounded-md' />
            <div className='bg-secondary h-4 w-32 rounded-md' />
            <div className='bg-secondary h-8 w-24 rounded-md' />
          </div>
          <div className='space-y-3'>
            <div className='bg-secondary h-16 rounded-xl' />
            <div className='bg-secondary h-16 rounded-xl' />
            <div className='bg-secondary h-16 rounded-xl opacity-60' />
          </div>
        </div>
      </div>
    </div>
  );
}
