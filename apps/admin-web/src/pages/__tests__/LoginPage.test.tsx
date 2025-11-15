import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import LoginPage from '@/pages/LoginPage'
import { useAuthStore } from '@/store/auth'

const renderWithRouter = () =>
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<div>Dashboard view</div>} />
      </Routes>
    </MemoryRouter>,
  )

describe('LoginPage', () => {
  const mockLogin = vi.fn()
  const mockClearError = vi.fn()

  beforeEach(() => {
    mockLogin.mockReset()
    mockClearError.mockReset()
    useAuthStore.setState((state) => ({
      ...state,
      token: null,
      user: null,
      loading: false,
      error: null,
      hydrated: true,
      login: mockLogin,
      clearError: mockClearError,
    }))
  })

  it('submits credentials and navigates to dashboard', async () => {
    mockLogin.mockResolvedValue(undefined)

    const user = userEvent.setup()
    renderWithRouter()

    await user.type(screen.getByLabelText(/email/i), 'tester@example.com')
    await user.type(screen.getByLabelText(/password/i), 'Password1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'tester@example.com',
        password: 'Password1',
      })
    })

    await screen.findByText(/dashboard view/i)
  })

  it('shows an error when login fails', async () => {
    mockLogin.mockImplementation(async () => {
      useAuthStore.setState({ error: 'Invalid credentials' })
      throw new Error('Invalid credentials')
    })

    const user = userEvent.setup()
    renderWithRouter()

    await user.type(screen.getByLabelText(/email/i), 'bad@example.com')
    await user.type(screen.getByLabelText(/password/i), 'Password1')
    await user.click(screen.getByRole('button', { name: /sign in/i }))

    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent(/invalid credentials/i)
  })
})
