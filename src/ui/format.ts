/**
 * How a side of the net is written. Kept in one place because it appeared in
 * three and drifted is exactly the sort of thing nobody notices until the
 * scoreboard and the phone disagree.
 */

import type { PairingFormula } from '../domain/types'

/** "Ann & Bob" reads as a partnership; "Ann + Bob" reads as arithmetic. */
export const SIDE_SEPARATOR = ' & '

export function formatSide(names: string[]): string {
  return names.join(SIDE_SEPARATOR)
}

/** The pairing formulas as the create form offers them and the setup screen recalls them. */
export const FORMULA_LABEL: Record<PairingFormula, string> = {
  '1+4v2+3': '#1+#4 v #2+#3 — zbalansowana',
  '1+2v3+4': '#1+#2 v #3+#4 — silni razem',
  '1+3v2+4': '#1+#3 v #2+#4',
}
