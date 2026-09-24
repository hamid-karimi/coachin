import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface UseRedirectProps {
  redirectUrl?: string;
}

export function useRedirect({ redirectUrl }: UseRedirectProps): void {
  const router = useRouter();

  useEffect(() => {
    if (redirectUrl) {
      router.push(redirectUrl);
    }
  }, [redirectUrl, router]);
}
