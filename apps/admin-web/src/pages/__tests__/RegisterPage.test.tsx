import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import RegisterPage from '@/pages/RegisterPage'
import { useAuthStore } from '@/store/auth'

const renderWithRouter = () =>
  render(
    <MemoryRouter initialEntries={['/register']}>
      <Routes>
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/dashboard" element={<div>Dashboard view</div>} />
      </Routes>
    </MemoryRouter>,
  )

describe('RegisterPage', () => {
  const mockRegister = vi.fn()
  const mockClearError = vi.fn()

  beforeEach(() => {
    mockRegister.mockReset()
    mockClearError.mockReset()
    useAuthStore.setState((state) => ({
      ...state,
      token: null,
      user: null,
      loading: false,
      error: null,
      hydrated: true,
      register: mockRegister,
      clearError: mockClearError,
    }))
  })

  it('submits registration data and redirects to dashboard', async () => {
    mockRegister.mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderWithRouter()

    await user.type(screen.getByLabelText(/full name/i), 'Alex Reviewer')
    await user.type(screen.getByLabelText(/email/i), 'alex@example.com')
    await user.type(screen.getByLabelText(/password/i), 'Password1')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        name: 'Alex Reviewer',
        email: 'alex@example.com',
        password: 'Password1',
      })
    })

    await screen.findByText(/dashboard view/i)
  })

  it('shows error when registration fails', async () => {
    mockRegister.mockImplementation(async () => {
      useAuthStore.setState({ error: 'Unable to register' })
      throw new Error('Unable to register')
    })

    const user = userEvent.setup()
    renderWithRouter()

    await user.type(screen.getByLabelText(/email/i), 'fail@example.com')
    await user.type(screen.getByLabelText(/password/i), 'Password1')
    await user.click(screen.getByRole('button', { name: /create account/i }))

    await screen.findByRole('alert')
    expect(screen.getByRole('alert').textContent?.toLowerCase()).toContain(
      'could not create your account',
    )
  })
})
