import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { data, error } = await supabase.from("sport_types").select("*");

  if (error) {
    return <div>Error: {error.message}</div>;
  }

  return (
    <main className='flex min-h-screen flex-col items-center p-24'>
      <h1 className='text-4xl font-bold mb-8'>Coachin 🏃‍♂️</h1>

      <div className='w-full max-w-md space-y-4'>
        {data?.map((sport) => (
          <div
            key={sport.id}
            className='flex justify-between p-4 border rounded'>
            <span>{sport.name}</span>
            <span>x{sport.xp_multiplier}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
