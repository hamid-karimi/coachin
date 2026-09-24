import Link from "next/link";

interface AuthLinkProps {
  prompt?: string;
  href: string;
  children: React.ReactNode;
}

/** "New here? Create an account"-style footer link. */
export function AuthLink({ prompt, href, children }: AuthLinkProps) {
  return (
    <p className='text-muted-foreground text-center text-sm'>
      {prompt && <>{prompt} </>}
      <Link href={href} className='text-brand-ink font-semibold hover:underline'>
        {children}
      </Link>
    </p>
  );
}
