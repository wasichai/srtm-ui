import type { CONTRIBUYENTE_TABS } from '../pages/ContribuyentePage'
import type { DECLARACION_TABS } from '../pages/DeclaracionPage'

// what each step of the portal's wizards asks for: the instruction bar under the chevron steps, with the
// portal-tributario variant. one per step (a step is a tab), after "Paso N:" in bold, so each starts in lower case

type PasoInscripcion = (typeof CONTRIBUYENTE_TABS)[number]['id']
type PasoDeclaracion = (typeof DECLARACION_TABS)[number]['id']

// the inscription of a contribuyente: its datos (Nuevo contribuyente), then its ficha tab by tab (?inscripcion=1)
export const INSTRUCCIONES_INSCRIPCION: Record<PasoInscripcion, string> = {
  datos: 'complete los datos del contribuyente y pulse Siguiente para inscribirlo.',
  domicilios: 'registre al menos un domicilio fiscal: con él se abren los pasos siguientes.',
  relacionados: 'registre a los relacionados del contribuyente (representante, cónyuge…), si los tiene.',
  contacto: 'registre sus teléfonos y correos, y marque el principal.',
  sustento: 'registre los documentos que sustentan la inscripción.'
}

// a new declaración jurada: its first two tabs, before it is presented. the rest wait for it
export const INSTRUCCIONES_NUEVA_DECLARACION: Record<'datos' | 'ubicacion', string> = {
  datos: 'complete los datos del predio y de la adquisición y pulse Siguiente.',
  ubicacion: 'registre la ubicación del predio o búsquelo en el padrón, y pulse Siguiente para presentar la declaración.'
}

// the declaración just presented (?asistente=1): "Siguiente" saves what changed and opens the next tab
export const INSTRUCCIONES_DECLARACION: Record<PasoDeclaracion, string> = {
  datos: 'revise los datos del predio y de la adquisición y pulse Siguiente.',
  ubicacion: 'revise la ubicación del predio y pulse Siguiente.',
  transferentes: 'registre a quien le transfirió el predio (vendedor, donante…), si lo hay, y pulse Siguiente.',
  caracteristicas: 'complete el uso y el área del terreno, agregue los niveles de construcción y las obras complementarias, y pulse Siguiente.',
  condominos: 'si el predio tiene otros propietarios, agréguelos con su porcentaje y pulse Siguiente.',
  frentes: 'registre los otros frentes del predio, si los tiene, y pulse Terminar.'
}
