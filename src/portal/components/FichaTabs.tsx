import { cn } from '@wasichai/ui'
import { ChevronDown, type LucideIcon } from 'lucide-react'
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useVarianteTema } from '../../themes'

export interface FichaTab {
  id: string
  label: string
  icon?: LucideIcon
  // the srtm's greyed tabs: reachable only once the record exists
  disabled?: boolean
  render: () => ReactNode
}

interface PestanasProps {
  tabs: FichaTab[]
  label: string
  active: string
  onChange: (id: string) => void
}

// the ficha's tabs, controlled (the active one lives in the url, so a link can open a given tab).
// a panel mounts the first time it is opened and then stays, hidden: its list or its half-typed form survive.
// light and dark: icons and a strip that scrolls. portal-tributario: no icons, and what does not fit goes into "Más"
export function FichaTabs({ tabs, label, active, onChange }: PestanasProps) {
  const variante = useVarianteTema()
  const current = tabs.find((t) => t.id === active && !t.disabled) ?? tabs[0]
  const [opened, setOpened] = useState<string[]>([current.id])
  useEffect(() => setOpened((ids) => (ids.includes(current.id) ? ids : [...ids, current.id])), [current.id])
  // the tab just picked shows in this render, before the effect records it
  const mounted = opened.includes(current.id) ? opened : [...opened, current.id]

  return (
    <div data-slot="tabs">
      {variante === 'portal' ? (
        <TiraPortal tabs={tabs} label={label} active={current.id} onChange={onChange} />
      ) : (
        <div role="tablist" data-slot="tabs-list" aria-label={label} className="flex gap-1 overflow-x-auto border-b border-border px-4">
          {tabs.map((tab) => (
            <Pestana key={tab.id} tab={tab} selected={tab.id === current.id} onChange={onChange} icono />
          ))}
        </div>
      )}
      {tabs
        .filter((tab) => mounted.includes(tab.id))
        .map((tab) => (
          <div key={tab.id} role="tabpanel" data-slot="tabs-content" id={`panel-${tab.id}`} aria-labelledby={`tab-${tab.id}`} hidden={tab.id !== current.id}>
            {tab.render()}
          </div>
        ))}
    </div>
  )
}

interface PestanaProps {
  tab: FichaTab
  selected: boolean
  onChange: (id: string) => void
  icono?: boolean
  // in "Más": out of the strip (measured all the same)
  oculta?: boolean
  boton?: (el: HTMLButtonElement | null) => void
}

function Pestana({ tab, selected, onChange, icono = false, oculta, boton }: PestanaProps) {
  const Icon = icono ? tab.icon : undefined
  return (
    <button
      ref={boton}
      type="button"
      role="tab"
      data-slot="tabs-trigger"
      id={`tab-${tab.id}`}
      aria-selected={selected}
      aria-controls={`panel-${tab.id}`}
      aria-disabled={tab.disabled || undefined}
      disabled={tab.disabled}
      hidden={oculta}
      tabIndex={selected ? 0 : -1}
      onClick={() => onChange(tab.id)}
      className={cn(
        'flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors',
        selected ? 'border-brand text-brand-strong' : 'border-transparent text-ink-muted hover:text-ink',
        tab.disabled && 'cursor-not-allowed opacity-40 hover:text-ink-muted',
        // measured at its full width
        !icono && 'shrink-0'
      )}
    >
      {Icon && <Icon className="size-4" />}
      {tab.label}
    </button>
  )
}

// what the strip measures: its width, each tab's, "Más"'s and the gaps (the theme's 2px)
interface Medidas {
  tira: number
  anchos: Record<string, number>
  mas: number
  hueco: number
  huecoMas: number
}

// the tabs the strip shows, in their order (priority+): all of them when they fit; otherwise the first ones that fit
// beside "Más", the selected one always among them, taking the last slot when it would be in "Más"
function repartir(ids: string[], actual: string, m: Medidas | null): string[] {
  if (!m) return ids
  const largo = (lista: string[]) => lista.reduce((suma, id) => suma + (m.anchos[id] ?? 0), 0) + m.hueco * Math.max(lista.length - 1, 0)
  if (largo(ids) <= m.tira) return ids
  const sitio = m.tira - m.mas - m.huecoMas
  const visibles: string[] = []
  for (const id of ids) {
    if (largo([...visibles, id]) > sitio) break
    visibles.push(id)
  }
  if (visibles.includes(actual)) return visibles
  while (visibles.length > 0 && largo([...visibles, actual]) > sitio) visibles.pop()
  return [...visibles, actual]
}

const ancho = (el: HTMLElement) => el.getBoundingClientRect().width
// jsdom computes no gap: 0
const hueco = (el: HTMLElement) => parseFloat(getComputedStyle(el).columnGap) || 0
const iguales = (a: Medidas, b: Medidas) =>
  a.tira === b.tira && a.mas === b.mas && a.hueco === b.hueco && a.huecoMas === b.huecoMas && Object.keys(b.anchos).every((id) => a.anchos[id] === b.anchos[id])

const MENU_ITEM =
  'block w-full px-4 py-[9px] text-left text-[15px] leading-[1.35] whitespace-nowrap text-link hover:bg-brand-soft focus-visible:bg-brand-soft focus-visible:-outline-offset-2'

// the portal's strip: the tabs with no icons and, when they do not all fit, a last folder tab "Más (n)" with a menu of
// the rest (tabs.css paints it). measured on the strip with a ResizeObserver; jsdom has no widths, so there all fit.
// the menu is a menu button like MenuSesion: arrows, home and end walk it, escape gives focus back to "Más", a pick
// or a press anywhere else closes it
function TiraPortal({ tabs, label, active, onChange }: PestanasProps) {
  const tira = useRef<HTMLDivElement>(null)
  const caja = useRef<HTMLDivElement>(null)
  const boton = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const botones = useRef(new Map<string, HTMLButtonElement>())
  const enfocar = useRef<string | null>(null)
  const menuId = useId()
  const [medidas, setMedidas] = useState<Medidas | null>(null)
  const [abierto, setAbierto] = useState(false)

  const ids = tabs.map((tab) => tab.id)
  const visibles = repartir(ids, active, medidas)
  const ocultas = tabs.filter((tab) => !visibles.includes(tab.id))

  const medir = useCallback(() => {
    if (!tira.current) return
    // the tabs in "Más" are measured shown, before the paint: the theme's container queries resize every tab
    const enMas = [...botones.current.values()].filter((el) => el.hidden)
    enMas.forEach((el) => (el.hidden = false))
    const anchos = Object.fromEntries([...botones.current].map(([id, el]) => [id, ancho(el)]))
    enMas.forEach((el) => (el.hidden = true))
    const medida = {
      tira: ancho(tira.current),
      anchos,
      mas: boton.current ? ancho(boton.current) : undefined,
      hueco: hueco(tira.current.firstElementChild as HTMLElement),
      huecoMas: hueco(tira.current)
    }
    setMedidas((antes) => {
      // "Más" not drawn: its last width (none yet: the next measure, once it shows, corrects it)
      const nuevas = { ...medida, mas: medida.mas ?? antes?.mas ?? 0 }
      return antes && iguales(antes, nuevas) ? antes : nuevas
    })
  }, [])

  // after every render (a tab picked, "Más" drawn or gone) and on every resize of the strip
  useLayoutEffect(medir)
  useEffect(() => {
    if (!tira.current || typeof ResizeObserver === 'undefined') return
    const observador = new ResizeObserver(medir)
    observador.observe(tira.current)
    return () => observador.disconnect()
  }, [medir])

  // a tab picked in the menu shows in the strip: focus goes to it
  useEffect(() => {
    if (enfocar.current !== active) return
    enfocar.current = null
    botones.current.get(active)?.focus()
  }, [active])

  // nothing left in "Más" (a wider strip): no menu to come back to
  const hayMas = ocultas.length > 0
  useEffect(() => {
    if (!hayMas) setAbierto(false)
  }, [hayMas])

  const items = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])

  // opened: focus on the first option, and a press anywhere else closes it
  useEffect(() => {
    if (!abierto) return
    items()[0]?.focus()
    const fuera = (event: PointerEvent) => {
      if (!caja.current?.contains(event.target as Node)) setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  const cerrar = () => {
    setAbierto(false)
    boton.current?.focus()
  }

  const elegir = (tab: FichaTab) => {
    if (tab.disabled) return
    setAbierto(false)
    enfocar.current = tab.id
    onChange(tab.id)
  }

  const onMenuKey = (event: KeyboardEvent) => {
    const lista = items()
    const at = lista.indexOf(document.activeElement as HTMLElement)
    const focus = (index: number) => {
      event.preventDefault()
      lista[(index + lista.length) % lista.length]?.focus()
    }
    if (event.key === 'ArrowDown') focus(at + 1)
    else if (event.key === 'ArrowUp') focus(at < 0 ? -1 : at - 1)
    else if (event.key === 'Home') focus(0)
    else if (event.key === 'End') focus(-1)
    else if (event.key === 'Escape') {
      event.preventDefault()
      cerrar()
    } else if (event.key === 'Tab') setAbierto(false)
  }

  const onBotonKey = (event: KeyboardEvent) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    setAbierto(true)
  }

  return (
    <div ref={tira} data-ui="pestanas-tira" className="flex items-end gap-0.5">
      <div role="tablist" data-slot="tabs-list" aria-label={label} className="flex min-w-0 flex-1 gap-1 overflow-x-auto border-b border-border px-4">
        {tabs.map((tab) => (
          <Pestana
            key={tab.id}
            tab={tab}
            selected={tab.id === active}
            onChange={onChange}
            oculta={!visibles.includes(tab.id)}
            boton={(el) => {
              if (el) botones.current.set(tab.id, el)
              else botones.current.delete(tab.id)
            }}
          />
        ))}
      </div>
      {hayMas && (
        <div ref={caja} className="relative shrink-0">
          <button
            ref={boton}
            type="button"
            data-ui="pestanas-mas"
            aria-haspopup="menu"
            aria-expanded={abierto}
            aria-controls={abierto ? menuId : undefined}
            onClick={() => setAbierto((was) => !was)}
            onKeyDown={onBotonKey}
            className="flex items-center gap-1.5 whitespace-nowrap"
          >
            Más ({ocultas.length})
            <ChevronDown aria-hidden className="size-4" />
          </button>
          {abierto && (
            <div
              ref={menu}
              id={menuId}
              role="menu"
              aria-label="Más secciones"
              data-ui="pestanas-menu"
              onKeyDown={onMenuKey}
              className="absolute top-full right-0 z-30 mt-1 min-w-55 overflow-hidden rounded-md border border-border bg-surface py-1 text-ink shadow-lg"
            >
              {ocultas.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  aria-disabled={tab.disabled || undefined}
                  onClick={() => elegir(tab)}
                  className={cn(MENU_ITEM, tab.disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent')}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
