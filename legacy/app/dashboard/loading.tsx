export default function DashboardLoading() {
  return (
    <div className='mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8'>
      <div className='animate-pulse space-y-5'>
        {/* Header: greeting + avatar */}
        <div className='flex items-center justify-between'>
          <div className='space-y-2'>
            <div className='bg-secondary h-3 w-32 rounded-md' />
            <div className='bg-secondary h-7 w-40 rounded-md' />
          </div>
          <div className='bg-secondary size-10 rounded-full' />
        </div>
        {/* Level card */}
        <div className='bg-secondary h-24 rounded-2xl' />
        {/* Hearts strip */}
        <div className='bg-secondary h-4 w-56 rounded-md' />
        {/* Stat row */}
        <div className='hidden gap-3 sm:grid sm:grid-cols-4'>
          <div className='bg-secondary h-20 rounded-xl' />
          <div className='bg-secondary h-20 rounded-xl' />
          <div className='bg-secondary h-20 rounded-xl' />
          <div className='bg-secondary h-20 rounded-xl' />
        </div>
        {/* Entry cards */}
        <div className='bg-secondary h-20 rounded-2xl' />
        <div className='bg-secondary h-20 rounded-2xl' />
        <div className='bg-secondary h-20 rounded-2xl opacity-60' />
        {/* Today's plan */}
        <div className='bg-secondary h-5 w-32 rounded-md' />
        <div className='bg-secondary h-16 rounded-xl' />
        <div className='bg-secondary h-16 rounded-xl opacity-60' />
      </div>
    </div>
  );
}
