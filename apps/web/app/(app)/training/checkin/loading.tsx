export default function CheckinLoading() {
  return (
    <div className='mx-auto w-full max-w-2xl'>
      <div className='animate-pulse space-y-5'>
        <div className='space-y-2'>
          <div className='bg-secondary h-7 w-48 rounded-md' />
          <p className='text-muted-foreground text-sm'>Reviewing your week and preparing next week…</p>
        </div>
        <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className='bg-secondary h-20 rounded-xl' />
          ))}
        </div>
        <div className='bg-secondary h-32 rounded-xl' />
        <div className='bg-secondary h-24 rounded-xl opacity-60' />
      </div>
    </div>
  );
}
