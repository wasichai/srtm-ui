import { createContext, use } from 'react'

// the html id of a field's input, which its label points to. a form edited in place shares its page with others (tabs,
// the dialogs over them): it scopes its ids, so no label points into another form
export const FieldIdContext = createContext((name: string) => `field-${name}`)

export const useFieldId = () => use(FieldIdContext)
