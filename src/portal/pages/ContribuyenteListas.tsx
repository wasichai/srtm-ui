import { AlertTriangle, MapPinCheck } from 'lucide-react'
import { rentas } from '../api'
import { formatText } from '../components/format'
import {
  describirDomicilio,
  DOMICILIO_SECTIONS,
  emptyOf,
  MEDIO_CONTACTO_SECTIONS,
  RELACIONADO_SECTIONS,
  SUSTENTO_SECTIONS,
  type FormValues
} from '../forms/specs'
import { UbicarDireccion } from '../forms/UbicarDireccion'
import type { Contribuyente, Domicilio, MedioContacto, Relacionado, Sustento } from '../types'
import { HijosPanel } from './HijosPanel'

// the contribuyente's four lists of the srtm's registro de contribuyente

const esFiscalActivo = (d: Domicilio) => d.tipo_domicilio === 'FISCAL' && d.estado !== 'INACTIVO'

// the padrón's district: where a new domicilio most likely is
const PERENE = { ubigeo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }

export function DomiciliosPanel({ contribuyente }: { contribuyente: Contribuyente }) {
  return (
    <HijosPanel<Domicilio>
      parent={contribuyente.id!}
      api={rentas.domicilios}
      queryKey="domicilios"
      plural="domicilios"
      singular="domicilio"
      sections={DOMICILIO_SECTIONS}
      catalog="domicilio"
      wide
      nuevo={(rows) =>
        emptyOf<Domicilio>(DOMICILIO_SECTIONS, {
          ...PERENE,
          tipo_domicilio: rows.some(esFiscalActivo) ? 'REAL' : 'FISCAL',
          tipo_predio: 'PREDIO URBANO',
          estado: 'ACTIVO'
        })
      }
      aviso={(rows) =>
        rows.some(esFiscalActivo) ? null : (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">(*) Registrar al menos 1 domicilio fiscal</p>
              {contribuyente.domicilio_fiscal && <p className="mt-0.5 text-ink-muted">Domicilio fiscal del padrón: {contribuyente.domicilio_fiscal}</p>}
            </div>
          </div>
        )
      }
      footer={(values: FormValues, form) => (
        <div className="space-y-1.5">
          <p className="text-xs text-ink-muted">Descripción del domicilio</p>
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-h-9 flex-1 rounded-md border border-border bg-surface-muted px-3 py-2 text-sm text-ink" aria-live="polite">
              {describirDomicilio(values) || '—'}
            </p>
            <UbicarDireccion form={form} descripcion={describirDomicilio(values)} />
          </div>
        </div>
      )}
      columns={[
        { label: 'Código', render: (_, i) => i + 1 },
        { label: 'Tipo de domicilio', render: (d) => formatText(d.tipo_domicilio) },
        { label: 'Tipo de predio', render: (d) => formatText(d.tipo_predio) },
        {
          label: 'Descripción del domicilio',
          render: (d) => (
            <span className="inline-flex items-start gap-1.5">
              {d.ubicacion && <MapPinCheck aria-label="Ubicado en el mapa" className="mt-0.5 size-4 shrink-0 text-success" />}
              {formatText(d.descripcion)}
            </span>
          )
        }
      ]}
    />
  )
}

export function RelacionadosPanel({ contribuyente }: { contribuyente: string }) {
  return (
    <HijosPanel<Relacionado>
      parent={contribuyente}
      api={rentas.relacionados}
      queryKey="relacionados"
      plural="relacionados"
      singular="relacionado"
      sections={RELACIONADO_SECTIONS}
      catalog="relacionado"
      wide
      nuevo={() => emptyOf<Relacionado>(RELACIONADO_SECTIONS, { tipo_documento: 'DNI', fuente_informacion: 'MANUAL', estado: 'ACTIVO' })}
      columns={[
        { label: 'Tipo de relacionado', render: (r) => formatText(r.tipo_relacionado) },
        { label: 'Documento', render: (r) => `${r.tipo_documento ?? ''} ${r.numero_documento ?? ''}`.trim() || '—' },
        { label: 'Apellidos y nombres', render: (r) => [r.apellido_paterno, r.apellido_materno, r.nombres].filter(Boolean).join(' ') || '—' },
        { label: 'Teléfono', render: (r) => formatText(r.telefono_celular ?? r.telefono_fijo) },
        { label: 'Correo', render: (r) => formatText(r.correo) }
      ]}
    />
  )
}

export function MediosContactoPanel({ contribuyente }: { contribuyente: string }) {
  return (
    <HijosPanel<MedioContacto>
      parent={contribuyente}
      api={rentas.mediosContacto}
      queryKey="medios-contacto"
      plural="medios de contacto"
      singular="medio de contacto"
      sections={MEDIO_CONTACTO_SECTIONS}
      catalog="medio_contacto"
      nuevo={(rows) => emptyOf<MedioContacto>(MEDIO_CONTACTO_SECTIONS, { tipo: 'TELEFONO CELULAR', principal: rows.length === 0, estado: 'ACTIVO' })}
      columns={[
        { label: 'Tipo', render: (m) => formatText(m.tipo) },
        { label: 'Número o correo', render: (m) => formatText(m.valor) },
        { label: 'Anexo', render: (m) => formatText(m.anexo) },
        { label: 'Principal', render: (m) => (m.principal ? 'SÍ' : 'NO') }
      ]}
    />
  )
}

export function SustentosPanel({ contribuyente }: { contribuyente: string }) {
  return (
    <HijosPanel<Sustento>
      parent={contribuyente}
      api={rentas.sustentos}
      queryKey="sustentos"
      plural="documentos sustento"
      singular="documento sustento"
      sections={SUSTENTO_SECTIONS}
      catalog="sustento"
      nuevo={() => emptyOf<Sustento>(SUSTENTO_SECTIONS, { estado: 'ACTIVO' })}
      columns={[
        { label: 'Número', render: (_, i) => i + 1 },
        { label: 'Documento', render: (s) => formatText(s.documento) },
        { label: 'N° documento', render: (s) => formatText(s.numero_documento) },
        { label: 'Tipo de presentación', render: (s) => formatText(s.tipo_presentacion) },
        { label: 'Folios', render: (s) => formatText(s.folios) }
      ]}
    />
  )
}
