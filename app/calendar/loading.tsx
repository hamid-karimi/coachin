export default function CalendarLoading() {
  return (
    <div className='mx-auto w-full max-w-3xl px-4 py-6 md:px-8 md:py-8'>
      <div className='animate-pulse space-y-5'>
        {/* Header: title + description + action buttons */}
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-2'>
            <div className='bg-secondary h-7 w-40 rounded-md' />
            <div className='bg-secondary h-4 w-64 rounded-md' />
          </div>
          <div className='flex gap-2'>
            <div className='bg-secondary h-8 w-28 rounded-md' />
            <div className='bg-secondary h-8 w-36 rounded-md' />
          </div>
        </div>
        {/* Week navigation */}
        <div className='flex items-center justify-between'>
          <div className='bg-secondary h-8 w-20 rounded-md' />
          <div className='bg-secondary h-4 w-32 rounded-md' />
          <div className='bg-secondary h-8 w-20 rounded-md' />
        </div>
        {/* Seven day cells */}
        <div className='space-y-3'>
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className='bg-secondary h-20 rounded-xl' />
          ))}
        </div>
      </div>
    </div>
  );
}
