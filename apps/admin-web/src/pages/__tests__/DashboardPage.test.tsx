import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DashboardPage from '@/pages/DashboardPage'
import { useAuthStore } from '@/store/auth'

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  registerUnauthorizedHandler: vi.fn(),
}))

const mockedApi = await import('@/lib/api-client')
const renderDashboard = () =>
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <DashboardPage />
    </MemoryRouter>,
  )

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
    vi.mocked(mockedApi.apiClient.post).mockReset()
  })

  it('renders wallets returned from the API', async () => {
    vi.mocked(mockedApi.apiClient.get).mockResolvedValue({
      data: [
        { id: 'wallet-primary', userId: 'user-1', currency: 'IDR', balance: '120000', createdAt: new Date().toISOString() },
        { id: 'wallet-2', userId: 'user-1', currency: 'USD', balance: '50', createdAt: new Date().toISOString() },
      ],
    })

    renderDashboard()

    await screen.findByText(/main balance/i)
    expect(screen.getByText(/usd wallet/i)).toBeVisible()
    expect(mockedApi.apiClient.get).toHaveBeenCalledWith('/wallets/me')
  })

  it('shows an error message when request fails', async () => {
    vi.mocked(mockedApi.apiClient.get).mockRejectedValue(new Error('boom'))

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/can’t load wallets/i)
    })
  })

  it('submits a deposit', async () => {
    const user = userEvent.setup()

    vi.mocked(mockedApi.apiClient.get).mockResolvedValue({
      data: [
        { id: 'wallet-primary', userId: 'user-1', currency: 'IDR', balance: '120000', createdAt: new Date().toISOString() },
      ],
    })
    vi.mocked(mockedApi.apiClient.post).mockResolvedValue({ data: {} })

    renderDashboard()

    const depositButton = await screen.findByRole('button', { name: /deposit funds/i })
    await user.click(depositButton)

    await screen.findByText(/top up your wallet/i)
    await user.selectOptions(screen.getByLabelText(/wallet/i), 'wallet-primary')
    await user.type(screen.getByLabelText(/amount \(idr\)/i), '100')
    await user.click(screen.getByRole('button', { name: /add funds/i }))

    await waitFor(() => {
      expect(mockedApi.apiClient.post).toHaveBeenCalledWith('/wallets/wallet-primary/deposit', {
        amount: 100,
        currency: 'IDR',
      })
    })
  })

  it('submits a transfer when details are valid', async () => {
    const user = userEvent.setup()

    vi.mocked(mockedApi.apiClient.get).mockResolvedValue({
      data: [
        { id: 'wallet-primary', userId: 'user-1', currency: 'IDR', balance: '120', createdAt: new Date().toISOString() },
      ],
    })
    vi.mocked(mockedApi.apiClient.post).mockResolvedValue({ data: {} })

    renderDashboard()

    const openTransferButton = await screen.findByRole('button', { name: /transfer funds/i })
    await user.click(openTransferButton)
    await screen.findByText(/send funds to another reviewer/i)
    await user.type(screen.getByLabelText(/recipient email/i), 'friend@example.com')
    await user.type(screen.getByLabelText(/amount to send/i), '50')
    await user.click(screen.getByRole('button', { name: /send funds/i }))

    await waitFor(() => {
      expect(mockedApi.apiClient.post).toHaveBeenCalledWith('/wallets/transfer', {
        recipientEmail: 'friend@example.com',
        amount: 50,
      })
    })
  })

  it('prevents transfers that exceed the available balance', async () => {
    const user = userEvent.setup()

    vi.mocked(mockedApi.apiClient.get).mockResolvedValue({
      data: [
        { id: 'wallet-primary', userId: 'user-1', currency: 'IDR', balance: '75', createdAt: new Date().toISOString() },
      ],
    })

    renderDashboard()

    const openTransferButton = await screen.findByRole('button', { name: /transfer funds/i })
    await user.click(openTransferButton)
    await user.type(screen.getByLabelText(/recipient email/i), 'friend@example.com')
    await user.type(screen.getByLabelText(/amount to send/i), '100')
    await user.click(screen.getByRole('button', { name: /send funds/i }))

    await screen.findByText(/amount exceeds the available balance/i)
    expect(mockedApi.apiClient.post).not.toHaveBeenCalled()
  })

  it('blocks self-transfers before hitting the API', async () => {
    const user = userEvent.setup()

    vi.mocked(mockedApi.apiClient.get).mockResolvedValue({
      data: [
        { id: 'wallet-primary', userId: 'user-1', currency: 'IDR', balance: '75', createdAt: new Date().toISOString() },
      ],
    })

    renderDashboard()

    const openTransferButton = await screen.findByRole('button', { name: /transfer funds/i })
    await user.click(openTransferButton)
    await user.type(screen.getByLabelText(/recipient email/i), 'user@example.com')
    await user.type(screen.getByLabelText(/amount to send/i), '10')
    await user.click(screen.getByRole('button', { name: /send funds/i }))

    await screen.findByText(/can’t send funds to your own email/i)
    expect(mockedApi.apiClient.post).not.toHaveBeenCalled()
  })
})
