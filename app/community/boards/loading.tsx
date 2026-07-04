export default function BoardsLoading() {
  return (
    <div className='animate-pulse space-y-4'>
      <div className='flex gap-2'>
        <div className='bg-secondary h-9 w-24 rounded-full' />
        <div className='bg-secondary h-9 w-24 rounded-full' />
        <div className='bg-secondary h-9 w-24 rounded-full' />
      </div>
      <div className='bg-secondary h-11 rounded-md' />
      <div className='bg-secondary h-16 rounded-xl' />
      <div className='bg-secondary h-16 rounded-xl' />
      <div className='bg-secondary h-16 rounded-xl opacity-60' />
    </div>
  );
}
