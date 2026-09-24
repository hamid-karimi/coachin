import { redirect } from "next/navigation";
import { getMe } from "@/app/lib/me-data";
import { homeFor } from "@/lib/roles";

/** Entry point: sends the viewer to their home, or to sign in. */
export default async function RootPage() {
  const me = await getMe();
  redirect(me ? homeFor(me.role) : "/auth/login");
}
