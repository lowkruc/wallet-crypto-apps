import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import DashboardPage from '@/pages/DashboardPage'
import { useAuthStore } from '@/store/auth'

vi.mock('@/lib/api-client', () => {
  return {
    apiClient: {
      get: vi.fn(),
    },
  }
})

const mockedApi = await import('@/lib/api-client')

describe('DashboardPage', () => {
  beforeEach(() => {
    useAuthStore.setState((state) => ({
      ...state,
      token: 'token',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        walletId: 'wallet-primary',
      },
      hydrated: true,
      logout: vi.fn(),
    }))
    vi.mocked(mockedApi.apiClient.get).mockReset()
  })

  it('renders wallets returned from the API', async () => {
    vi.mocked(mockedApi.apiClient.get).mockResolvedValue({
      data: [
        { id: 'wallet-primary', userId: 'user-1', currency: 'IDR', balance: '120000', createdAt: new Date().toISOString() },
        { id: 'wallet-2', userId: 'user-1', currency: 'USD', balance: '50', createdAt: new Date().toISOString() },
      ],
    })

    render(<DashboardPage />)

    await screen.findByText(/main balance/i)
    expect(screen.getByText(/usd wallet/i)).toBeVisible()
    expect(mockedApi.apiClient.get).toHaveBeenCalledWith('/wallets/me')
  })

  it('shows an error message when request fails', async () => {
    vi.mocked(mockedApi.apiClient.get).mockRejectedValue(new Error('boom'))

    render(<DashboardPage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/can’t load wallets/i)
    })
  })
})
