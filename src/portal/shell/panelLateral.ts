import { useState } from 'react'

// whether the classic lateral is open: only on a phone, from the header's menu button, and a pick closes it. the
// portal's rail never folds
export function usePanelLateral() {
  const [abierto, setAbierto] = useState(false)
  return {
    abierto,
    alternar: () => setAbierto((era) => !era),
    alNavegar: () => setAbierto(false)
  }
}
