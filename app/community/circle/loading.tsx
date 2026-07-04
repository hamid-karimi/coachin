export default function CircleLoading() {
  return (
    <div className='animate-pulse space-y-3'>
      <div className='bg-secondary h-11 rounded-md' />
      <div className='bg-secondary h-16 rounded-xl' />
      <div className='bg-secondary h-16 rounded-xl' />
      <div className='bg-secondary h-16 rounded-xl opacity-60' />
    </div>
  );
}
