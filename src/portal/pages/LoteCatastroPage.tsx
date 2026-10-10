import { useQuery } from '@tanstack/react-query'
import { LoadingState, QueryState } from '@wasichai/core'
import { Card, CardBody } from '@wasichai/ui'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { RecordForm } from '../../kit/forms/RecordForm'
import { emptyOf, type SectionSpec } from '../../kit/forms/spec'
import { rentas } from '../api'
import { nombres, PERENE_UBIGEO, ubigeoCampos } from '../forms/bloques'
import { CatastroMapa } from '../forms/CatastroMapa'
import { useCatalogos, useRefresh } from '../queries'
import { useVolver } from '../shell/useVolver'
import { useWorkspaceTab } from '../shell/WorkspaceTabs'
import type { CatastroFiscal, Ubigeo } from '../types'
import { FichaHeader } from './FichaHeader'

// a lote of the catastro fiscal (page 14's "predio de catastro fiscal"): its codes, where it is and its polygon. until
// the GeoJSON is imported (model/import_catastro.py), the catastro is kept by hand here
export const LOTE_SECTIONS: SectionSpec[] = [
  {
    id: 'datos-del-lote',
    title: 'Datos del lote',
    fields: [
      { name: 'codigo_cpu', label: 'Código CPU', required: true, span: 2 },
      { name: 'codigo_predio_municipal', label: 'Código de predio municipal', span: 2 },
      { name: 'partida_registral', label: 'Partida registral', span: 1 },
      { name: 'tipo_predio', label: 'Tipo de predio', kind: 'enum', required: true, span: 1 }
    ]
  },
  {
    id: 'ubicacion-del-lote',
    title: 'Ubicación del lote',
    fields: [
      ...ubigeoCampos(),
      { name: 'tipo_via', label: 'Tipo de vía', kind: 'enum', span: 1 },
      {
        name: 'via',
        label: 'Descripción de la vía',
        kind: 'suggest',
        span: 2,
        suggest: { fetch: async (q, v) => nombres((await rentas.vias(q, v.tipo_via, v.ubigeo)).content), dependsOn: ['tipo_via', 'ubigeo'] }
      },
      { name: 'numero', label: 'Número principal', span: 1 },
      { name: 'kilometro', label: 'Kilómetro', span: 2 },
      { name: 'tipo_zona', label: 'Zona', kind: 'enum', span: 1 },
      {
        name: 'zona',
        label: 'Descripción de la zona',
        kind: 'suggest',
        span: 3,
        suggest: { fetch: async (q, v) => nombres((await rentas.unidadesUrbanas(q, v.tipo_zona, v.ubigeo)).content), dependsOn: ['tipo_zona', 'ubigeo'] }
      },
      { name: 'manzana', label: 'Manzana', span: 1 },
      { name: 'lote', label: 'Lote', span: 1 },
      { name: 'direccion', label: 'Dirección de catastro fiscal', span: 6 }
    ]
  },
  {
    id: 'poligono-del-lote',
    title: 'Polígono del lote',
    fields: [
      {
        name: 'mapa',
        label: 'Mapa',
        kind: 'custom',
        span: 6,
        render: (form) => <CatastroMapa form={form} tomar={false} label="Mapa del lote de catastro fiscal" />
      },
      { name: 'lote_geom', label: 'Lote', kind: 'geometry' }
    ]
  }
]

// what the backend keeps of a lote: the form's departamento, provincia and distrito only lead to its ubigeo
const CAMPOS: (keyof CatastroFiscal)[] = [
  'codigo_cpu',
  'codigo_predio_municipal',
  'partida_registral',
  'tipo_predio',
  'ubigeo',
  'tipo_via',
  'via',
  'numero',
  'tipo_zona',
  'zona',
  'manzana',
  'lote',
  'kilometro',
  'direccion',
  'lote_geom'
]
const cuerpo = (values: CatastroFiscal) => Object.fromEntries(CAMPOS.map((c) => [c, values[c] ?? null])) as unknown as CatastroFiscal

type LoteForm = CatastroFiscal & { departamento?: string | null; provincia?: string | null; distrito?: string | null }

export function NuevoLotePage() {
  const navigate = useNavigate()
  const refresh = useRefresh()
  return (
    <LoteCard
      title="Nuevo lote de catastro fiscal"
      initial={emptyOf<LoteForm>(LOTE_SECTIONS, { ...PERENE_UBIGEO, tipo_predio: 'PREDIO URBANO' })}
      submitLabel="Registrar lote"
      save={async (values) => {
        const created = await rentas.crearLote(cuerpo(values))
        await refresh()
        // from now on a ficha of its own
        navigate(`/catastro/${created.id}`, { replace: true })
      }}
    />
  )
}

export function LoteCatastroRoute() {
  const { id = '' } = useParams()
  return <LoteCatastroPage key={id} id={id} />
}

function LoteCatastroPage({ id }: { id: string }) {
  const refresh = useRefresh()
  const lote = useQuery({ queryKey: ['lote', id], queryFn: () => rentas.lote(id) })
  // the lote keeps its ubigeo code only: the cascade needs its departamento, provincia and distrito
  const ubigeos = useQuery({ queryKey: ['ubigeos'], queryFn: rentas.ubigeos, staleTime: Infinity })
  const [guardado, setGuardado] = useState(false)
  useWorkspaceTab(lote.data ? { path: `/catastro/${id}`, label: `Lote ${lote.data.codigo_cpu ?? ''}`.trim(), kind: 'lote' } : null)

  return (
    <QueryState query={lote}>
      {(data) =>
        ubigeos.isPending ? (
          <LoadingState />
        ) : (
          <LoteCard
            title={`Lote ${data.codigo_cpu ?? ''}`.trim()}
            initial={emptyOf<LoteForm>(LOTE_SECTIONS, { ...data, ...lugar(data.ubigeo, ubigeos.data ?? []) })}
            submitLabel="Guardar cambios"
            guardado={guardado}
            save={async (values) => {
              setGuardado(false)
              await rentas.actualizarLote(id, cuerpo(values))
              await refresh()
              setGuardado(true)
            }}
          />
        )
      }
    </QueryState>
  )
}

function lugar(ubigeo: string | null, ubigeos: Ubigeo[]) {
  const found = ubigeo ? ubigeos.find((u) => u.codigo === ubigeo) : undefined
  return found ? { departamento: found.departamento, provincia: found.provincia, distrito: found.distrito } : {}
}

function LoteCard({
  title,
  initial,
  submitLabel,
  save,
  guardado = false
}: {
  title: string
  initial: LoteForm
  submitLabel: string
  save: (values: LoteForm) => Promise<void>
  guardado?: boolean
}) {
  // the lote editor is often opened in another browser tab (buscar predios, over a form being filled)
  const volver = useVolver('/')
  const catalogos = useCatalogos()
  return (
    <div className="space-y-5">
      <FichaHeader kind="Catastro fiscal" title={title} />
      <Card>
        <CardBody>
          <RecordForm
            sections={LOTE_SECTIONS}
            options={catalogos.data?.catastro_fiscal}
            initial={initial}
            submitLabel={submitLabel}
            onCancel={volver}
            onSubmit={save}
            footer={() =>
              guardado && (
                <p role="status" className="text-sm text-brand-strong">
                  Cambios guardados
                </p>
              )
            }
          />
        </CardBody>
      </Card>
    </div>
  )
}
