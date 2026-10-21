import { ApiError } from '@wasichai/core'
import { Alert, Button, Dialog, DialogContent, DialogDescription, DialogTitle, Table, Td, Th } from '@wasichai/ui'
import { Calculator, Check, RefreshCw } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { UseFormReturn } from 'react-hook-form'
import type { FormValues } from '../../kit/forms/spec'
import { errorMessage } from '../../kit/ui/errorMessage'
import { formatMoney, formatNumber, formatText } from '../components/format'
import { NUMERICA } from '../components/tabla'
import { rentas } from '../api'
import { useAutoavaluoSugerido, useRefresh } from '../queries'
import type { AutoavaluoSugerido, Declaracion } from '../types'

// the autoavalúo sugerido (srtm-backend#152): the organization's catastro-backend values what the declaración
// declares. since srtm-backend#156 the backend writes that valuation as the autoavalúo on every write, so the button
// shows how it was worked out. asked only by the button, never stored. manual (an organization without catastro, whose
// user writes the autoavalúo): "Usar este valor" fills valor_autoavaluo in the form, which the user still saves. a
// municipalidad without catastro (409) leaves the button disabled, saying why

// the catastro's llave, as a person reads it: a code before ':' and what it is about after. any other as it comes
const LLAVES: Partial<Record<string, (resto: string[]) => string>> = {
  ARANCEL_FALTANTE: () => 'La vía del predio no tiene arancel en catastro',
  PARAMETRO_FALTANTE: (resto) => `No hay tablas de ${resto[resto.length - 1]} en catastro`,
  OBRA_DESCONOCIDA: (resto) => `Catastro no conoce la obra ${resto.join(':')}`,
  CLASIFICACION_DESCONOCIDA: (resto) => `Catastro no conoce la clasificación ${resto.join(':')}`,
  ESTADO_DESCONOCIDO: (resto) => `Catastro no conoce el estado de conservación ${resto.join(':')}`,
  AREA_TERRENO_FALTANTE: () => 'Falta el área del terreno',
  AREA_CONSTRUIDA_FALTANTE: () => 'Un nivel no declara área construida',
  ANIO_CONSTRUCCION_FALTANTE: () => 'Un nivel u obra no declara año de construcción',
  MATERIAL_FALTANTE: () => 'Un nivel u obra no declara material',
  ESTADO_FALTANTE: () => 'Un nivel u obra no declara estado de conservación',
  OBRA_CANTIDAD_FALTANTE: () => 'Una obra no declara cantidad',
  CATEGORIA_FALTANTE: (resto) => `Falta la categoría ${resto.join(':')} de un nivel`,
  DEPRECIACION_FALTANTE: (resto) => `Catastro no tiene la depreciación ${resto.join(' / ')}`,
  VU_SIN_VALOR: (resto) => `Catastro no tiene valor unitario para ${resto.join(' ')}`
}

export function motivoLegible(llave: string | null | undefined): string | null {
  if (!llave) return null
  const [codigo, ...resto] = llave.split(':')
  const legible = LLAVES[codigo]
  return legible && (codigo !== 'PARAMETRO_FALTANTE' || resto.length > 0) ? legible(resto) : llave
}

// the catastro could not value the declaración (srtm-backend#156): the backend kept the autoavalúo before and says why.
// Recalcular values it again, once the catastro answers or has what it lacked; a declaración only read is only told
export function AutoavaluoPorRevisar({ declaracion, soloLectura }: { declaracion: Declaracion; soloLectura?: boolean }) {
  const refresh = useRefresh()
  const [recalculando, setRecalculando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!declaracion.autoavaluo_por_revisar) return null
  const recalcular = async () => {
    setError(null)
    setRecalculando(true)
    try {
      await rentas.recalcularDeclaracion(declaracion.id!)
      await refresh()
    } catch (e) {
      setError(errorMessage(e, 'No se pudo recalcular el autoavalúo'))
    } finally {
      setRecalculando(false)
    }
  }
  const motivo = motivoLegible(declaracion.autoavaluo_motivo) ?? 'el catastro no valuó la declaración'
  return (
    <div role="status" aria-label="Autoavalúo por revisar">
      <Alert tone="warning">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p>
            <span className="font-semibold">Autoavalúo por revisar:</span> {motivo}
          </p>
          {!soloLectura && (
            <Button type="button" variant="secondary" size="sm" disabled={recalculando} onClick={() => void recalcular()}>
              <RefreshCw className="size-4" />
              {recalculando ? 'Recalculando…' : 'Recalcular'}
            </Button>
          )}
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </Alert>
    </div>
  )
}

const ORIGEN_ARANCEL: Record<string, string> = {
  CUERPO: 'Arancel de la declaración (padrón de origen)',
  FICHA: 'Arancel de la ficha catastral'
}

export function AutoavaluoSugeridoBoton({ declaracion, form, manual }: { declaracion: string; form: UseFormReturn<FormValues>; manual?: boolean }) {
  const query = useAutoavaluoSugerido(declaracion)
  const [abierto, setAbierto] = useState(false)
  const sinCatastro = query.error instanceof ApiError && query.error.status === 409
  const calcular = async () => {
    const { data } = await query.refetch()
    if (data) setAbierto(true)
  }
  const usar = (valor: number) => {
    form.setValue('valor_autoavaluo', String(valor), { shouldDirty: true, shouldValidate: form.formState.isSubmitted })
    setAbierto(false)
  }
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button type="button" variant="secondary" size="sm" disabled={sinCatastro || query.isFetching} onClick={() => void calcular()}>
        <Calculator className="size-4" />
        {query.isFetching ? 'Calculando…' : 'Ver cálculo del autoavalúo'}
      </Button>
      {sinCatastro && <span className="text-xs text-ink-muted">La municipalidad no tiene catastro configurado</span>}
      {query.isError && !sinCatastro && !query.isFetching && (
        <span role="alert" className="max-w-sm text-right text-xs text-danger">
          {errorMessage(query.error, 'No se pudo calcular el autoavalúo sugerido')}
        </span>
      )}
      {abierto && query.data && <DialogoSugerido sugerido={query.data} onUsar={manual ? usar : undefined} onClose={() => setAbierto(false)} />}
    </span>
  )
}

function Dato({ termino, children, fuerte }: { termino: string; children: ReactNode; fuerte?: boolean }) {
  return (
    <>
      <dt className="text-ink-muted">{termino}</dt>
      <dd className={fuerte ? 'font-semibold text-ink tabular-nums' : 'text-ink tabular-nums'}>{children}</dd>
    </>
  )
}

const lista = 'grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm'

// onUsar: only where the user writes the autoavalúo
function DialogoSugerido({ sugerido: s, onUsar, onClose }: { sugerido: AutoavaluoSugerido; onUsar?: (valor: number) => void; onClose: () => void }) {
  const valuado = s.autoavaluo !== null && s.autoavaluo !== undefined
  const motivo = motivoLegible(s.llave)
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
        <DialogTitle className="text-lg font-semibold">Cálculo del autoavalúo</DialogTitle>
        <DialogDescription className="mb-4 text-sm text-ink-muted">
          {onUsar
            ? 'Lo calcula el catastro de la municipalidad con lo que declara esta declaración, sus niveles y sus obras. No se guarda: si lo usas, queda en el formulario hasta que guardes.'
            : 'Así valúa el catastro de la municipalidad lo que declara esta declaración, sus niveles y sus obras: es el autoavalúo que el sistema guarda con cada cambio.'}
        </DialogDescription>
        <div className="space-y-5">
          <dl className={lista}>
            <Dato termino="Año">{formatText(s.anio)}</Dato>
            <Dato termino="Región">{formatText(s.region)}</Dato>
            <Dato termino="Versión de las tablas">{formatText(s.version)}</Dato>
            <Dato termino="Arancel (por m²)">
              {formatMoney(s.arancel_m2)}
              {s.origen_arancel && <span className="ml-2 text-ink-muted">· {ORIGEN_ARANCEL[s.origen_arancel] ?? s.origen_arancel}</span>}
            </Dato>
          </dl>
          {valuado ? (
            <>
              <dl className={lista}>
                <Dato termino="Terreno">{formatMoney(s.terreno)}</Dato>
                <Dato termino="Construcción">{formatMoney(s.construccion)}</Dato>
                <Dato termino="Obras complementarias">{formatMoney(s.obras)}</Dato>
                <Dato termino="Autoavalúo" fuerte>
                  {formatMoney(s.autoavaluo)}
                </Dato>
              </dl>
              {(s.detalle?.pisos.length ?? 0) > 0 && (
                <div className="overflow-x-auto">
                  <Table aria-label="Construcción por piso">
                    <thead>
                      <tr>
                        <Th>Piso</Th>
                        <Th {...NUMERICA}>Área (m²)</Th>
                        <Th {...NUMERICA}>V. unitario</Th>
                        <Th {...NUMERICA}>Incremento</Th>
                        <Th {...NUMERICA}>% depreciación</Th>
                        <Th {...NUMERICA}>V. unitario depreciado</Th>
                        <Th {...NUMERICA}>Valor</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.detalle!.pisos.map((p, i) => (
                        <tr key={i}>
                          <Td>{p.seccion ? `${formatText(p.piso)} (sección ${p.seccion})` : formatText(p.piso)}</Td>
                          <Td {...NUMERICA}>{formatNumber(p.area_construida)}</Td>
                          <Td {...NUMERICA}>{formatMoney(p.valor_unitario)}</Td>
                          <Td {...NUMERICA}>{formatMoney(p.incremento)}</Td>
                          <Td {...NUMERICA}>{formatNumber(p.porcentaje_depreciacion)}</Td>
                          <Td {...NUMERICA}>{formatMoney(p.valor_unitario_depreciado)}</Td>
                          <Td {...NUMERICA}>{formatMoney(p.valor)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
              {(s.detalle?.obras.length ?? 0) > 0 && (
                <div className="overflow-x-auto">
                  <Table aria-label="Obras complementarias">
                    <thead>
                      <tr>
                        <Th>Obra</Th>
                        <Th {...NUMERICA}>Cantidad</Th>
                        <Th {...NUMERICA}>V. unitario</Th>
                        <Th {...NUMERICA}>Factor de oficialización</Th>
                        <Th {...NUMERICA}>% depreciación</Th>
                        <Th {...NUMERICA}>Valor</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.detalle!.obras.map((o, i) => (
                        <tr key={i}>
                          <Td>{formatText(o.codigo_vu)}</Td>
                          <Td {...NUMERICA}>{formatNumber(o.cantidad)}</Td>
                          <Td {...NUMERICA}>{formatMoney(o.valor_unitario)}</Td>
                          <Td {...NUMERICA}>{formatNumber(o.factor_oficializacion)}</Td>
                          <Td {...NUMERICA}>{formatNumber(o.porcentaje_depreciacion)}</Td>
                          <Td {...NUMERICA}>{formatMoney(o.valor)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              )}
            </>
          ) : (
            <Alert tone="warning" title="El catastro no valuó la declaración">
              {motivo && <p>{motivo}</p>}
              {s.motivo && s.motivo !== motivo && <p className="text-xs">{s.motivo}</p>}
            </Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
            {valuado && onUsar && (
              <Button type="button" onClick={() => onUsar(s.autoavaluo!)}>
                <Check className="size-4" />
                Usar este valor
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
