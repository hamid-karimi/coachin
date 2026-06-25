interface LoadingScreenProps {
  message?: string;
}

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <div className='flex min-h-screen items-center justify-center bg-background'>
      <p className='text-muted-foreground'>{message}</p>
    </div>
  );
}
