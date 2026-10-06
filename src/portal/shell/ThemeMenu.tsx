import { SYSTEM_THEME, useTheme } from '@wasichai/core'
import { cn } from '@wasichai/ui'
import { Check, Monitor, Moon, Palette, Sun, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMenuButton } from './useMenuButton'

// core's own choices have their icon; a theme the app adds (config.themes) gets the palette
const ICONS: Record<string, LucideIcon> = { [SYSTEM_THEME]: Monitor, light: Sun, dark: Moon }

// opened, focus goes to the theme in use
const elegido = (items: HTMLElement[]) => items.find((item) => item.getAttribute('aria-checked') === 'true')

// the shell's theme picker, a menu button: system plus every theme core knows, srtm's included, nothing listed here.
// core's ThemeProvider applies the pick and stores it for the user, so the admin follows. `className` styles the
// button for the header it sits in
export function ThemeMenu({ className }: { className?: string }) {
  const { t } = useTranslation()
  const { preference, themes, setPreference } = useTheme()
  const { open, close, rootProps, buttonProps, menuProps } = useMenuButton({ rol: 'menuitemradio', primero: elegido })
  const [error, setError] = useState<string | null>(null)

  const options = [{ id: SYSTEM_THEME, label: t('theme.system') }, ...themes.map((theme) => ({ id: theme.id, label: t(theme.label) }))]
  // an id core does not know (an old build, another app's theme) falls to the os setting: shown as system, as core does
  const current = options.find((option) => option.id === preference) ?? options[0]
  const Icon = ICONS[current.id] ?? Palette

  const choose = (id: string) => {
    close()
    if (id === preference) return
    setError(null)
    setPreference(id).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
  }

  return (
    <div {...rootProps} className="relative">
      <button
        {...buttonProps}
        type="button"
        aria-label={`Tema: ${current.label}. Elegir tema`}
        title={error ?? `Tema: ${current.label}`}
        className={cn('rounded p-1.5 hover:bg-surface-muted hover:text-ink', error ? 'text-danger' : 'text-ink-muted', className)}
      >
        <Icon className="size-4" />
      </button>
      {open && (
        <div
          {...menuProps}
          aria-label="Tema"
          className="absolute top-full right-0 z-30 mt-1 min-w-44 rounded-md border border-border bg-surface py-1 shadow-lg"
        >
          {options.map((option) => {
            const OptionIcon = ICONS[option.id] ?? Palette
            const checked = option.id === current.id
            return (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={checked}
                tabIndex={-1}
                onClick={() => choose(option.id)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-ink hover:bg-surface-muted focus-visible:bg-surface-muted focus-visible:-outline-offset-2"
              >
                <OptionIcon className="size-4 text-ink-muted" />
                <span className="flex-1">{option.label}</span>
                <Check className={cn('size-4 text-brand', !checked && 'invisible')} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
