/**
 * The Garden Padel lockup.
 *
 * Two files rather than one recoloured by CSS: the ink differs between themes
 * but the sage circle does not, so a filter would either wash out the circle or
 * leave the ink wrong. Both are rendered and the theme decides which is
 * visible, so switching themes needs no JavaScript and never flashes.
 */

import darkInk from '../assets/logo-horizontal-dark.png'
import lightInk from '../assets/logo-horizontal-light.png'
import markDark from '../assets/mark-dark.png'
import markLight from '../assets/mark-light.png'
import { cx } from './primitives'

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cx('inline-block', className)}>
      <img src={lightInk} alt="Garden Padel" className="block h-full w-auto dark:hidden" />
      <img src={darkInk} alt="" aria-hidden className="hidden h-full w-auto dark:block" />
    </span>
  )
}

/** The tree alone, for tight spaces. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cx('inline-block', className)}>
      <img src={markLight} alt="Garden Padel" className="block h-full w-auto dark:hidden" />
      <img src={markDark} alt="" aria-hidden className="hidden h-full w-auto dark:block" />
    </span>
  )
}
