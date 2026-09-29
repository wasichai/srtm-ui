import { cn } from '@wasichai/ui'
import type { ComponentProps } from 'react'
import { selectClass } from '../forms/styles'

// the native select the portal draws itself, looking like @wasichai/ui's Input (selectClass). it wears the library's
// select-trigger slot, so a theme styles it as the library's selects. buttons and fields come from @wasichai/ui,
// which puts their data-slot hooks itself
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="select-trigger" className={cn(selectClass, className)} {...props} />
}
