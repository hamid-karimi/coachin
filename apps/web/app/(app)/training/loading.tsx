export default function TrainingLoading() {
  return (
    <div className='mx-auto w-full max-w-3xl'>
      <div className='animate-pulse space-y-6'>
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
        {/* Compact program cards */}
        <div className='space-y-4'>
          <div className='bg-secondary h-28 rounded-2xl' />
          <div className='bg-secondary h-28 rounded-2xl opacity-60' />
        </div>
      </div>
    </div>
  );
}
