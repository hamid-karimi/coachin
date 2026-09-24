import { redirect } from "next/navigation";

/** Legacy /marathon URLs — the route is /training now that plans cover
 *  more than races. Preserves subpaths and query params. */
export default async function LegacyMarathonRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") query.set(key, value);
  }
  const suffix = slug?.length ? `/${slug.join("/")}` : "";
  const queryString = query.toString();
  redirect(`/training${suffix}${queryString ? `?${queryString}` : ""}`);
}
