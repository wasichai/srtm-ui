import { Card, CardBody } from '@wasichai/ui'
import { Barras } from '../reportes/Barras'
import { COLOR_CATEGORIA, COLOR_ESTADO, GRIS, colorConfianza, colorDeSigno, etiquetaCategoria, etiquetaConfianza, etiquetaEstado } from './colores'
import { cantidad, plural, soles } from './formato'
import type { PanelVisor } from './tipos'

function Kpi({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <Card role="group" aria-label={etiqueta}>
      <CardBody className="space-y-1">
        <p className="text-sm text-ink-muted">{etiqueta}</p>
        {/* on one line: the grid gives each card room for it */}
        <p className="text-2xl font-semibold whitespace-nowrap text-ink tabular-nums">{valor}</p>
        {detalle && <p className="text-xs text-ink-muted">{detalle}</p>}
      </CardBody>
    </Card>
  )
}

// «10 · +S/ 500.00», which may break only after the «·»
const fichasYDelta = (fichas: number, delta: unknown) => `${cantidad(fichas)} · ${soles(delta as number | null, { signo: true })}`

// the head of the corrida: catastro-ui's 6 KPIs and 4 panels of bars, over every row of the corrida (the backend's)
export function Indicadores({ panel }: { panel: PanelVisor }) {
  const { kpis } = panel
  return (
    <section aria-label="Indicadores de la corrida" className="@container space-y-3">
      {/* columns by the width of the section, not of the screen: a KPI card needs ~15rem for «+S/ 1,234,567.89» */}
      <div className="grid grid-cols-1 gap-3 @min-[32rem]:grid-cols-2 @min-[48rem]:grid-cols-3 @min-[96rem]:grid-cols-6">
        <Kpi
          etiqueta="Diferencia de impuesto"
          valor={soles(kpis.delta_impuesto, { signo: true })}
          detalle={`Catastro − declarado, en ${plural(kpis.fichas, 'predio', 'predios')}`}
        />
        <Kpi etiqueta="Diferencia confiable" valor={soles(kpis.delta_impuesto_confiable, { signo: true })} detalle="Solo los predios confiables" />
        <Kpi etiqueta="Omisos estimados" valor={soles(kpis.omisos_estimado, { signo: true })} />
        <Kpi etiqueta="Superan 5 UIT" valor={cantidad(kpis.supera_5_uit)} detalle="Diferencia de autoavalúo" />
        <Kpi
          etiqueta="Pendientes de decidir"
          valor={cantidad(kpis.pendientes)}
          detalle={kpis.pendientes === null ? 'Sin datos de catastro' : `de ${cantidad(kpis.fichas)}, según catastro`}
        />
        <Kpi etiqueta="Con geometría" valor={cantidad(kpis.con_geometria)} detalle={`de ${cantidad(kpis.fichas)}`} />
      </div>
      <div className="grid gap-3 @min-[43rem]:grid-cols-2 @min-[87rem]:grid-cols-4">
        <Barras
          titulo="Por categoría"
          testid="categoria"
          barras={panel.por_categoria.map((c) => ({
            clave: c.clave,
            etiqueta: etiquetaCategoria(c.clave),
            valor: c.fichas,
            texto: fichasYDelta(c.fichas, c.delta_impuesto),
            color: COLOR_CATEGORIA[c.clave] ?? GRIS
          }))}
        />
        <Barras
          titulo="Por confianza"
          testid="confianza"
          barras={panel.por_confianza.map((c) => ({
            clave: c.clave ?? 'SIN_CONFIANZA',
            etiqueta: etiquetaConfianza(c.clave),
            valor: c.fichas,
            texto: fichasYDelta(c.fichas, c.delta_impuesto),
            color: colorConfianza(c.clave)
          }))}
        />
        <Barras
          titulo="Por estado"
          testid="estado"
          vacio="Sin datos de catastro."
          barras={panel.por_estado.map((c) => ({
            clave: c.clave,
            etiqueta: etiquetaEstado(c.clave),
            valor: c.fichas,
            texto: cantidad(c.fichas),
            color: COLOR_ESTADO[c.clave] ?? GRIS
          }))}
        />
        <Barras
          titulo="Sectores con más diferencia de impuesto"
          testid="sector"
          barras={panel.top_sectores.map((s, i) => ({
            clave: `${s.sector ?? 'sin'}-${i}`,
            etiqueta: s.sector ? `Sector ${s.sector}` : 'Sin sector',
            valor: Number(s.delta_impuesto) || 0,
            texto: fichasYDelta(s.fichas, s.delta_impuesto),
            // red where catastro would charge more, blue where less, as on the map
            color: colorDeSigno(Number(s.delta_impuesto) || 0)
          }))}
        />
      </div>
    </section>
  )
}
