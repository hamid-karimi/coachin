import { CommunityLayout } from "./components/CommunityLayout";

export default function CommunityLoading() {
  return (
    <CommunityLayout>
      <div className='animate-pulse space-y-4'>
        <div className='bg-secondary h-8 w-44 rounded-md' />
        <div className='bg-secondary h-10 w-full max-w-md rounded-full' />
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
    </CommunityLayout>
  );
}
