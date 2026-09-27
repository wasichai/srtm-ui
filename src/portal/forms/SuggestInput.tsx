import { useQuery } from '@tanstack/react-query'
import { useEffect, useId, useState, type ComponentProps } from 'react'
import { Input } from '../components/controles'

// free text with catalog suggestions (a native datalist): a vía missing from the catalog can still be typed
export function SuggestInput({
  value,
  fetch,
  queryKey,
  ...props
}: ComponentProps<typeof Input> & { value: string; fetch: (q: string) => Promise<string[]>; queryKey: unknown[] }) {
  const listId = useId()
  const [q, setQ] = useState(value)
  // one request per pause, not per letter
  useEffect(() => {
    const timer = setTimeout(() => setQ(value), 250)
    return () => clearTimeout(timer)
  }, [value])
  const suggestions = useQuery({ queryKey: ['sugerencias', ...queryKey, q], queryFn: () => fetch(q), staleTime: 60_000 })
  return (
    <>
      <Input {...props} value={value} list={listId} autoComplete="off" />
      <datalist id={listId}>
        {(suggestions.data ?? []).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </>
  )
}
