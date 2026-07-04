/** Skeleton rows, never spinners-in-page. */
export function LoadingScreen({ message }: { message?: string }) {
  return (
    <div
      className='bg-background flex min-h-screen flex-col gap-4 p-6 md:p-10'
      aria-busy='true'
      aria-label={message ?? "Loading"}>
      <div className='bg-secondary h-8 w-52 animate-pulse rounded-md' />
      <div className='bg-secondary h-4 w-72 animate-pulse rounded-sm' />
      <div className='mt-4 flex gap-1.5'>
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={index}
            className='bg-secondary h-14 flex-1 animate-pulse rounded-md'
          />
        ))}
      </div>
      <div className='bg-secondary h-24 w-full animate-pulse rounded-xl' />
      <div className='bg-secondary h-24 w-full animate-pulse rounded-xl opacity-60' />
    </div>
  );
}
