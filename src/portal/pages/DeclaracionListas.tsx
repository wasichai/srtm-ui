import { rentas } from '../api'
import { formatNumber, formatText, MESES, today } from '../components/format'
import { COLUMNAS } from '../forms/CategoriasFields'
import { FRENTE_SECTIONS, NIVEL_SECTIONS, OBRA_SECTIONS, TRANSFERENTE_SECTIONS } from '../forms/declaracionSpecs'
import { celda, etiqueta } from '../forms/etiquetas'
import { emptyOf, nombreORazonSocial, type FormValues } from '../forms/specs'
import type { NivelConstruccion, ObraComplementaria, OtroFrente, Transferente } from '../types'
import { HijosPanel } from './HijosPanel'

// the declaración jurada's lists, as the srtm draws them

const PERENE = { ubigeo: '120302', departamento: 'JUNIN', provincia: 'CHANCHAMAYO', distrito: 'PERENE' }
const anioActual = () => Number(today().slice(0, 4))
const mes = (m: number | null) => (m ? (MESES[m - 1] ?? String(m)) : '—')

export function TransferentesPanel({ declaracion, readOnly }: { declaracion: string; readOnly?: boolean }) {
  return (
    <HijosPanel<Transferente>
      parent={declaracion}
      readOnly={readOnly}
      api={rentas.transferentes}
      queryKey="transferentes"
      plural="transferentes"
      singular="transferente"
      sections={TRANSFERENTE_SECTIONS}
      catalog="transferente"
      wide
      nuevo={() => emptyOf<Transferente>(TRANSFERENTE_SECTIONS, { ...PERENE, tipo_documento: 'DNI', fuente_informacion: 'MANUAL', estado: 'ACTIVO' })}
      columns={[
        { label: 'Código', render: (t) => formatText(t.codigo) },
        {
          label: 'Documento',
          render: (t) => `${t.tipo_documento ? etiqueta('tipo_documento', t.tipo_documento) : ''} ${t.numero_documento ?? ''}`.trim() || '—'
        },
        { label: 'Apellidos y nombres / Razón social', render: nombreORazonSocial },
        { label: '% transferido', render: (t) => formatNumber(t.porcentaje_transferido), numeric: true },
        { label: 'Domicilio', render: (t) => formatText(t.descripcion_domicilio) }
      ]}
    />
  )
}

export function NivelesPanel({ declaracion, readOnly }: { declaracion: string; readOnly?: boolean }) {
  return (
    <HijosPanel<NivelConstruccion>
      parent={declaracion}
      readOnly={readOnly}
      api={rentas.niveles}
      queryKey="niveles"
      plural="niveles de construcción"
      singular="nivel de construcción"
      sections={NIVEL_SECTIONS}
      catalog="nivel_construccion"
      wide
      sinEstado
      nuevo={(rows) =>
        emptyOf<NivelConstruccion>(NIVEL_SECTIONS, {
          tipo_nivel: 'PISO',
          numero_piso: rows.length + 1,
          anio_construccion: anioActual(),
          estado: 'ACTIVO'
        })
      }
      columns={[
        { label: 'Tipo de nivel', render: (n) => celda('tipo_nivel', n.tipo_nivel) },
        { label: 'Piso', render: (n) => formatText(n.numero_piso) },
        { label: 'Año', render: (n) => formatText(n.anio_construccion) },
        { label: 'Mes', render: (n) => mes(n.mes_construccion) },
        { label: 'Área construida', render: (n) => formatNumber(n.area_construida), numeric: true },
        { label: 'Área común', render: (n) => formatNumber(n.area_comun), numeric: true },
        { label: 'Material', render: (n) => celda('material', n.material) },
        // the srtm's short headings: M&C, T, P, P&V, R, B, I(E/S)
        ...COLUMNAS.map((c, i) => ({
          label: ['M&C', 'T', 'P', 'P&V', 'R', 'B', 'I(E/S)'][i],
          render: (n: NivelConstruccion) => n[c.field] ?? '',
          className: 'text-center'
        })),
        { label: 'Conservación', render: (n) => celda('estado_conservacion', n.estado_conservacion) }
      ]}
    />
  )
}

export function ObrasPanel({ declaracion, readOnly }: { declaracion: string; readOnly?: boolean }) {
  return (
    <HijosPanel<ObraComplementaria>
      parent={declaracion}
      readOnly={readOnly}
      api={rentas.obras}
      queryKey="obras"
      plural="obras complementarias"
      singular="obra complementaria"
      sections={OBRA_SECTIONS}
      catalog="obra_complementaria"
      wide
      sinEstado
      nuevo={() =>
        emptyOf<ObraComplementaria>(OBRA_SECTIONS, {
          ingreso: 'POR CATEGORIAS',
          numero_piso: 1,
          anio_construccion: anioActual(),
          unidad_medida: 'M2',
          estado: 'ACTIVO'
        })
      }
      footer={(v: FormValues) => {
        const cantidad = Number((v.cantidad ?? '').replace(',', '.'))
        const metrado = Number((v.metrado ?? '').replace(',', '.'))
        const total = v.cantidad && v.metrado && Number.isFinite(cantidad * metrado) ? cantidad * metrado : null
        return (
          <div className="max-w-xs space-y-1.5">
            <p className="text-xs text-ink-muted">Total metrado</p>
            <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-right text-sm text-ink tabular-nums" aria-live="polite">
              {total === null ? '—' : `${formatNumber(total)} ${v.unidad_medida ?? ''}`.trim()}
            </p>
          </div>
        )
      }}
      columns={[
        { label: 'Tipo de obra', render: (o) => celda('tipo_obra', o.tipo_obra) },
        { label: 'Material', render: (o) => celda('material', o.material) },
        { label: 'Conservación', render: (o) => celda('estado_conservacion', o.estado_conservacion) },
        { label: 'Categoría', render: (o) => <span className="line-clamp-2">{o.categoria ?? (o.valor !== null ? `S/ ${formatNumber(o.valor)}` : '—')}</span> },
        { label: 'Mes', render: (o) => mes(o.mes_construccion) },
        { label: 'Cantidad', render: (o) => formatNumber(o.cantidad), numeric: true },
        { label: 'Metrado', render: (o) => formatNumber(o.metrado), numeric: true },
        { label: 'Total', render: (o) => formatNumber(o.total_metrado), numeric: true },
        { label: 'Año', render: (o) => formatText(o.anio_construccion) }
      ]}
    />
  )
}

export function FrentesPanel({ declaracion, readOnly }: { declaracion: string; readOnly?: boolean }) {
  return (
    <HijosPanel<OtroFrente>
      parent={declaracion}
      readOnly={readOnly}
      api={rentas.frentes}
      queryKey="frentes"
      plural="otros frentes"
      singular="frente"
      sections={FRENTE_SECTIONS}
      catalog="otro_frente"
      wide
      sinEstado
      nuevo={() => emptyOf<OtroFrente>(FRENTE_SECTIONS, { estado: 'ACTIVO' })}
      columns={[
        { label: 'Tipo vía', render: (f) => celda('tipo_via', f.tipo_via) },
        { label: 'Vía', render: (f) => formatText(f.via) },
        { label: 'N° principal', render: (f) => formatText(f.numero) },
        { label: 'Frontis', render: (f) => formatNumber(f.frontis), numeric: true },
        { label: 'Lote', render: (f) => formatText(f.lote) },
        { label: 'Cuadra', render: (f) => formatText(f.cuadra) },
        { label: 'Lado', render: (f) => celda('lado', f.lado) }
      ]}
    />
  )
}
