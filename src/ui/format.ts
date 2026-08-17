/**
 * How a side of the net is written. Kept in one place because it appeared in
 * three and drifted is exactly the sort of thing nobody notices until the
 * scoreboard and the phone disagree.
 */

/** "Ann & Bob" reads as a partnership; "Ann + Bob" reads as arithmetic. */
export const SIDE_SEPARATOR = ' & '

export function formatSide(names: string[]): string {
  return names.join(SIDE_SEPARATOR)
}
