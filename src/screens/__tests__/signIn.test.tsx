// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'

import { SignInPage } from '../SignInPage'
import { describeAuthError, describePasswordError } from '../../data/auth'

async function mount(): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.append(container)
  await act(async () => {
    createRoot(container).render(
      <MemoryRouter>
        <SignInPage />
      </MemoryRouter>,
    )
  })
  return container
}

const button = (c: HTMLElement, text: string) =>
  [...c.querySelectorAll('button')].find((b) => b.textContent?.trim() === text) as HTMLButtonElement

const submit = (c: HTMLElement) => c.querySelector('button[type="submit"]') as HTMLButtonElement

async function click(el: HTMLElement) {
  await act(async () => {
    el.click()
  })
}

/**
 * React tracks an input's value internally, so assigning `.value` and firing an
 * event does not reach onChange — the component never sees the keystroke and any
 * assertion about it passes for the wrong reason. Go through the native setter.
 */
async function type(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  await act(async () => {
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

describe('sign-in screen', () => {
  it('offers a password by default, because that is the one that works at the desk', async () => {
    const container = await mount()
    expect(button(container, 'Hasło').getAttribute('aria-checked')).toBe('true')
    expect(container.querySelector('input[type="password"]')).not.toBeNull()
    expect(submit(container).textContent).toContain('Zaloguj się')
  })

  it('keeps the magic link available as the fallback', async () => {
    const container = await mount()
    await click(button(container, 'Link e-mail'))

    expect(container.querySelector('input[type="password"]')).toBeNull()
    expect(submit(container).textContent).toContain('Wyślij link')
    expect(container.textContent).toContain('nie pamiętasz hasła')
  })

  it('will not submit without both fields in password mode', async () => {
    const container = await mount()
    expect(submit(container).disabled).toBe(true)

    const email = container.querySelector('input[type="email"]') as HTMLInputElement
    await type(email, 'a@b.pl')
    // Email alone is not enough while a password is being asked for.
    expect(submit(container).disabled).toBe(true)

    await type(container.querySelector('input[type="password"]') as HTMLInputElement, 'sekret')
    expect(submit(container).disabled).toBe(false)
  })

  it('needs only an email in link mode', async () => {
    const container = await mount()
    await click(button(container, 'Link e-mail'))

    await type(container.querySelector('input[type="email"]') as HTMLInputElement, 'a@b.pl')
    expect(submit(container).disabled).toBe(false)
  })

  it('offers a password manager the right autocomplete hints', async () => {
    // Without these a manager will not save or fill the credential.
    const container = await mount()
    expect(container.querySelector('input[type="email"]')?.getAttribute('autocomplete')).toBe('username')
    expect(container.querySelector('input[type="password"]')?.getAttribute('autocomplete')).toBe('current-password')
  })
})

describe('password error messages', () => {
  it('does not tell an attacker which half was wrong', async () => {
    // Supabase returns one message for both cases; keep it that way in Polish.
    expect(describePasswordError('Invalid login credentials')).toBe('Nieprawidłowy e-mail lub hasło.')
  })

  it('explains the rate limit', () => {
    expect(describePasswordError('Request rate limit reached')).toContain('Za dużo prób')
  })

  it('falls back without leaking upstream wording', () => {
    const message = describePasswordError('unexpected gateway explosion')
    expect(message).toContain('Spróbuj ponownie')
    expect(message).not.toContain('gateway')
  })

  it('still handles the magic-link failures separately', () => {
    expect(describeAuthError('Signups not allowed for otp')).toContain('nie ma dostępu')
  })
})
