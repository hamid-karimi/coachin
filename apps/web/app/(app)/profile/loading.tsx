export default function ProfileLoading() {
  return (
    <div className='mx-auto w-full max-w-4xl'>
      <div className='animate-pulse space-y-6'>
        <div className='flex items-center gap-4'>
          <div className='bg-secondary size-19 shrink-0 rounded-full md:size-22' />
          <div className='flex-1 space-y-2'>
            <div className='bg-secondary h-7 w-48 rounded-md' />
            <div className='bg-secondary h-4 w-64 rounded-md' />
            <div className='bg-secondary h-5 w-40 rounded-full' />
          </div>
        </div>
        <div className='bg-secondary h-10 w-full max-w-md rounded-full' />
        <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className='bg-secondary h-20 rounded-xl' />
          ))}
        </div>
        <div className='bg-secondary h-40 rounded-xl' />
      </div>
    </div>
  );
}
