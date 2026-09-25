export default function CommunityLoading() {
  return (
    <div className='mx-auto w-full max-w-3xl'>
      <div className='animate-pulse space-y-5'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-2'>
            <div className='bg-secondary h-7 w-36 rounded-md' />
            <div className='bg-secondary h-4 w-72 rounded-md' />
          </div>
          <div className='flex gap-2'>
            <div className='bg-secondary h-8 w-28 rounded-md' />
            <div className='bg-secondary h-8 w-32 rounded-md' />
          </div>
        </div>
        <div className='flex items-center justify-between'>
          <div className='bg-secondary h-8 w-20 rounded-md' />
          <div className='bg-secondary h-4 w-32 rounded-md' />
          <div className='bg-secondary h-8 w-20 rounded-md' />
        </div>
        <div className='space-y-3'>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className='bg-secondary h-20 rounded-xl' />
          ))}
        </div>
      </div>
    </div>
  );
}
