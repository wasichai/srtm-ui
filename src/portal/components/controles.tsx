import { Button as UiButton, cn, Input as UiInput, Textarea as UiTextarea } from '@wasichai/ui'
import type { ComponentProps } from 'react'
import { selectClass } from '../forms/styles'

// @wasichai/ui's controls with the hooks a theme styles them by (data-ui, data-variant, data-size), which the library
// does not put yet (wasichai/wasichai-ui#12 proposes data-slot). light and dark only get the attributes

type UiButtonProps = ComponentProps<typeof UiButton>

// round: an icon button, grey disc under portal-tributario (the shell's and the instruction bar's tools), a round
// ghost in the other themes. it needs an aria-label, as any icon button
export type ButtonVariant = NonNullable<UiButtonProps['variant']> | 'round'

export function Button({ variant, size, className, ...props }: Omit<UiButtonProps, 'variant'> & { variant?: ButtonVariant }) {
  const shown = variant ?? 'primary'
  const round = shown === 'round'
  const sized = round ? 'icon' : (size ?? 'md')
  return (
    <UiButton
      data-ui="button"
      data-variant={shown}
      data-size={sized}
      variant={shown === 'round' ? 'ghost' : shown}
      size={sized}
      className={cn(round && 'rounded-full', className)}
      {...props}
    />
  )
}

export function Input(props: ComponentProps<typeof UiInput>) {
  return <UiInput data-ui="input" {...props} />
}

export function Textarea(props: ComponentProps<typeof UiTextarea>) {
  return <UiTextarea data-ui="textarea" {...props} />
}

// the native select the portal draws itself, looking like Input (selectClass)
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-ui="select" className={cn(selectClass, className)} {...props} />
}
