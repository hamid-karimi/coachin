"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/components/hooks/use-debounced-value";
import { usePeople } from "../hooks/use-community";
import { FollowButton } from "./follow-button";
import { PersonRow } from "./person-row";

/** Find people by name (or an exact email), 10 at a time. */
export function PeopleSearch() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(query.trim(), 300);
  const { data, isFetching } = usePeople(q, page);

  return (
    <section className='bg-card border-border space-y-3 rounded-xl border p-4'>
      <h2 className='text-[15px] font-bold'>Find people</h2>
      <Input
        aria-label='Search people'
        placeholder='Search by name, or an exact email'
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
      />
      {data && data.people.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No one matches “{q}”.</p>
      ) : (
        <ul className={isFetching ? "space-y-2 opacity-70" : "space-y-2"}>
          {data?.people.map((person) => (
            <PersonRow
              key={person.userId}
              name={person.name}
              avatarUrl={person.avatarUrl}
              tier={person.tier}
              subtitle={`Level ${person.level} · ${person.xp.toLocaleString("en-US")} XP`}>
              <FollowButton userId={person.userId} following={person.following} />
            </PersonRow>
          ))}
        </ul>
      )}
      {data && (data.page > 1 || data.hasNext) && (
        <div className='flex justify-between'>
          <Button type='button' size='sm' variant='ghost' disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            disabled={!data.hasNext}
            onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
