import { QueryState } from '@wasichai/core'
import { Ban, CalendarClock, FileCheck2, Gavel, Send } from 'lucide-react'
import { useState } from 'react'
import { currentYear, formatDate } from '../components/format'
import { StatCard } from '../components/StatCard'
import { YearSelect } from '../components/YearSelect'
import { usePanelInfracciones } from '../queries'

// a year's infracciones at a glance: actas levantadas, resoluciones de sanción (RIS) dictadas, notificadas and the
// notificaciones previas that fall due this week, every figure the backend's and with the day it holds at (al_dia).
// «en coactiva» is not srtm's (it does not collect): it says so with the backend's nota, never a 0
const cifra = (n: number) => n.toLocaleString('es-PE')

export function PanelInfracciones() {
  const [anio, setAnio] = useState(currentYear)
  const query = usePanelInfracciones(anio)
  return (
    <section aria-label="Panel de infracciones" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-ink">Ejercicio {anio}</h2>
        <YearSelect value={anio} onChange={setAnio} />
      </div>
      <QueryState query={query}>
        {(p) => (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <StatCard icon={FileCheck2} label="Actas levantadas" value={cifra(p.actas)} fecha={p.al_dia} />
            <StatCard icon={Gavel} label="Resoluciones de sanción (RIS)" value={cifra(p.resoluciones)} fecha={p.al_dia} />
            <StatCard icon={Send} label="Notificadas" value={cifra(p.notificadas)} fecha={p.al_dia} />
            <StatCard
              icon={CalendarClock}
              label="Vencen esta semana"
              value={cifra(p.vencen_esta_semana)}
              fecha={p.al_dia}
              nota={`del ${formatDate(p.semana.desde)} al ${formatDate(p.semana.hasta)}`}
            />
            <StatCard icon={Ban} label="En coactiva" value="No aplica" nota={p.nota} />
          </div>
        )}
      </QueryState>
    </section>
  )
}
