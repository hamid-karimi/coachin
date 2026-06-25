import { CommunityLayout } from "./components/CommunityLayout";

export default function CommunityLoading() {
  return (
    <CommunityLayout>
      <div className='space-y-4 animate-pulse'>
        <div className='h-5 w-40 rounded bg-secondary' />
        <div className='h-10 w-64 rounded bg-secondary' />
        <div className='h-4 w-80 rounded bg-secondary' />
      </div>

      <div className='flex gap-2'>
        <div className='h-10 w-36 rounded-xl bg-secondary animate-pulse' />
        <div className='h-10 w-36 rounded-xl bg-secondary animate-pulse' />
      </div>

      <div className='space-y-3'>
        <div className='h-12 rounded-xl bg-secondary animate-pulse' />
        <div className='h-24 rounded-xl bg-secondary animate-pulse' />
        <div className='h-24 rounded-xl bg-secondary animate-pulse' />
      </div>
    </CommunityLayout>
  );
}
