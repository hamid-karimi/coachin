export default function CoachingLoading() {
  return (
    <div className='mx-auto w-full max-w-4xl px-4 py-6 md:px-8 md:py-8'>
      <div className='animate-pulse space-y-4'>
        <div className='bg-secondary h-8 w-40 rounded-md' />
        <div className='bg-secondary h-4 w-56 rounded-md' />
        <div className='bg-secondary h-11 rounded-md' />
        <div className='bg-secondary h-16 rounded-xl' />
        <div className='bg-secondary h-16 rounded-xl' />
        <div className='bg-secondary h-16 rounded-xl opacity-60' />
      </div>
    </div>
  );
}
