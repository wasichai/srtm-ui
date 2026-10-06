import { AlertTriangle, MapPinCheck } from 'lucide-react'
import { emptyOf, type FormValues } from '../../kit/forms/spec'
import { rentas } from '../api'
import { Alert } from '@wasichai/ui'
import { formatText } from '../components/format'
import { PERENE_UBIGEO } from '../forms/bloques'
import { celda, etiqueta } from '../forms/etiquetas'
import { describirDomicilio, DOMICILIO_SECTIONS, MEDIO_CONTACTO_SECTIONS, nombreORazonSocial, RELACIONADO_SECTIONS, SUSTENTO_SECTIONS } from '../forms/specs'
import { UbicarDireccion } from '../forms/UbicarDireccion'
import type { Contribuyente, Domicilio, MedioContacto, Relacionado, Sustento } from '../types'
import { HijosPanel } from './HijosPanel'

// the contribuyente's four lists of the srtm's registro de contribuyente

export const esFiscalActivo = (d: Domicilio) => d.tipo_domicilio === 'FISCAL' && d.estado !== 'INACTIVO'

// the only active fiscal domicilio: the first one added (null: a new one), or the one edited when no other is.
// the backend keeps it fiscal, active and there; the dialog greys its tipo, as the srtm does
const unicoFiscal = (d: Domicilio | null, rows: Domicilio[]) => (d === null || esFiscalActivo(d)) && !rows.some((r) => r.id !== d?.id && esFiscalActivo(r))

const TIPO_FIJO = DOMICILIO_SECTIONS.map((s) => ({
  ...s,
  fields: s.fields.map((f) => (f.name === 'tipo_domicilio' ? { ...f, readOnly: true } : f))
}))

export function DomiciliosPanel({ contribuyente }: { contribuyente: Contribuyente }) {
  return (
    <HijosPanel<Domicilio>
      parent={contribuyente.id!}
      api={rentas.domicilios}
      queryKey="domicilios"
      plural="domicilios"
      singular="domicilio"
      sections={(rows, editing) => (unicoFiscal(editing, rows) ? TIPO_FIJO : DOMICILIO_SECTIONS)}
      catalog="domicilio"
      wide
      fijo={(d, rows) => (unicoFiscal(d, rows) ? 'Es el único domicilio fiscal activo: no se puede eliminar' : null)}
      nuevo={(rows) =>
        emptyOf<Domicilio>(DOMICILIO_SECTIONS, {
          ...PERENE_UBIGEO,
          tipo_domicilio: rows.some(esFiscalActivo) ? 'REAL' : 'FISCAL',
          tipo_predio: 'PREDIO URBANO',
          estado: 'ACTIVO'
        })
      }
      aviso={(rows) =>
        rows.some(esFiscalActivo) ? null : (
          <Alert tone="danger" className="rounded-md border border-danger/40 bg-danger/10 px-4 py-3">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <span className="block font-semibold">(*) Registrar al menos 1 domicilio fiscal</span>
                {contribuyente.domicilio_fiscal && (
                  <span className="mt-0.5 block text-ink-muted">Domicilio fiscal del padrón: {contribuyente.domicilio_fiscal}</span>
                )}
              </span>
            </span>
          </Alert>
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
        { label: 'Código', render: (d) => formatText(d.codigo) },
        { label: 'Tipo de domicilio', render: (d) => celda('tipo_domicilio', d.tipo_domicilio) },
        { label: 'Tipo de predio', render: (d) => celda('tipo_predio', d.tipo_predio) },
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
        { label: 'Código', render: (r) => formatText(r.codigo) },
        { label: 'Tipo de relacionado', render: (r) => celda('tipo_relacionado', r.tipo_relacionado) },
        {
          label: 'Documento',
          render: (r) => `${r.tipo_documento ? etiqueta('tipo_documento', r.tipo_documento) : ''} ${r.numero_documento ?? ''}`.trim() || '—'
        },
        { label: 'Apellidos y nombres / Razón social', render: nombreORazonSocial },
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
        { label: 'Código', render: (m) => formatText(m.codigo) },
        { label: 'Tipo', render: (m) => celda('tipo', m.tipo) },
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
        { label: 'Número', render: (s) => formatText(s.codigo) },
        { label: 'Documento', render: (s) => celda('documento', s.documento) },
        { label: 'N° documento', render: (s) => formatText(s.numero_documento) },
        { label: 'Tipo de presentación', render: (s) => celda('tipo_presentacion', s.tipo_presentacion) },
        { label: 'Folios', render: (s) => formatText(s.folios) }
      ]}
    />
  )
}
