export default function NutritionLoading() {
  return (
    <div className='mx-auto w-full max-w-2xl'>
      <div className='animate-pulse space-y-5'>
        <div className='space-y-2'>
          <div className='bg-secondary h-7 w-36 rounded-md' />
          <div className='bg-secondary h-4 w-80 rounded-md' />
        </div>
        <div className='bg-secondary h-32 rounded-2xl' />
        <div className='bg-secondary h-28 rounded-xl' />
        <div className='bg-secondary h-24 rounded-xl opacity-60' />
      </div>
    </div>
  );
}
