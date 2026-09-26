import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'

// types freely, reports 300 ms after the last key: one request per pause, not per letter
export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  const [text, setText] = useState(value)
  useEffect(() => setText(value), [value])
  useEffect(() => {
    if (text === value) return
    const timer = setTimeout(() => onChange(text), 300)
    return () => clearTimeout(timer)
  }, [text, value, onChange])

  return (
    <div className="relative w-full max-w-lg">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
      <input
        type="search"
        aria-label={label}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="h-10 w-full rounded-md border border-border bg-surface pr-3 pl-9 text-sm placeholder:text-ink-muted/70"
      />
    </div>
  )
}
