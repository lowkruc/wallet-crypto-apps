import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
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

let walletResponse: Array<{
  id: string
  userId: string
  currency: string
  balance: string
  createdAt: string
}>
let analyticsTransactions: Array<{
  id: string
  currency: string
  amount: string
  direction: 'IN' | 'OUT'
  counterparty?: { id: string; email: string; name?: string | null } | null
  createdAt: string
}>
let analyticsTopUsers: Array<{
  userId: string
  email: string
  name?: string | null
  totalOutbound: string
}>
let failWalletRequest: boolean

beforeAll(() => {
  class StubResizeObserver {
    private readonly callback: ResizeObserverCallback

    constructor(callback: ResizeObserverCallback) {
      this.callback = callback
    }

    observe() {
      this.callback([{ contentRect: { width: 800, height: 400 } }] as unknown as ResizeObserverEntry[], this)
    }

    unobserve() {}
    disconnect() {}
  }

  vi.stubGlobal('ResizeObserver', StubResizeObserver)
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    value: 400,
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    value: 600,
  })
})

afterAll(() => {
  vi.unstubAllGlobals()
})

describe('DashboardPage', () => {
  beforeEach(() => {
    walletResponse = [
      {
        id: 'wallet-primary',
        userId: 'user-1',
        currency: 'IDR',
        balance: '120000',
        createdAt: new Date().toISOString(),
      },
    ]
    analyticsTransactions = []
    analyticsTopUsers = []
    failWalletRequest = false
    useAuthStore.setState((state) => ({
      ...state,
      token: 'token',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        username: 'userone',
        walletId: 'wallet-primary',
      },
      hydrated: true,
      logout: vi.fn(),
    }))
    vi.mocked(mockedApi.apiClient.get).mockReset()
    vi.mocked(mockedApi.apiClient.post).mockReset()
    vi.mocked(mockedApi.apiClient.get).mockImplementation((url: string) => {
      if (url === '/wallets/me') {
        if (failWalletRequest) {
          return Promise.reject(new Error('boom'))
        }
        return Promise.resolve({ data: walletResponse })
      }
      if (url.startsWith('/analytics/users/')) {
        return Promise.resolve({
          data: { userId: 'user-1', transactions: analyticsTransactions },
        })
      }
      if (url === '/analytics/top-users') {
        return Promise.resolve({ data: { users: analyticsTopUsers } })
      }
      return Promise.resolve({ data: {} })
    })
  })

  it('renders wallets returned from the API', async () => {
    walletResponse = [
      { id: 'wallet-primary', userId: 'user-1', currency: 'IDR', balance: '120000', createdAt: new Date().toISOString() },
      { id: 'wallet-2', userId: 'user-1', currency: 'USD', balance: '50', createdAt: new Date().toISOString() },
    ]

    renderDashboard()

    await screen.findByText(/main balance/i)
    expect(screen.getByText(/usd wallet/i)).toBeVisible()
    expect(mockedApi.apiClient.get).toHaveBeenCalledWith('/wallets/me')
  })

  it('shows an error message when request fails', async () => {
    failWalletRequest = true

    renderDashboard()

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/can’t load wallets/i)
    })
  })

  it('submits a deposit', async () => {
    const user = userEvent.setup()

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

    walletResponse = [
      { id: 'wallet-primary', userId: 'user-1', currency: 'IDR', balance: '120', createdAt: new Date().toISOString() },
    ]
    vi.mocked(mockedApi.apiClient.post).mockResolvedValue({ data: {} })

    renderDashboard()

    const openTransferButton = await screen.findByRole('button', { name: /transfer funds/i })
    await user.click(openTransferButton)
    await screen.findByText(/send funds to another reviewer/i)
    await user.type(screen.getByLabelText(/recipient username/i), 'friend_user')
    await user.type(screen.getByLabelText(/amount to send/i), '50')
    await user.click(screen.getByRole('button', { name: /send funds/i }))

    await waitFor(() => {
      expect(mockedApi.apiClient.post).toHaveBeenCalledWith('/wallets/transfer', {
        recipientUsername: 'friend_user',
        amount: 50,
      })
    })
  })

  it('prevents transfers that exceed the available balance', async () => {
    const user = userEvent.setup()

    walletResponse = [
      { id: 'wallet-primary', userId: 'user-1', currency: 'IDR', balance: '75', createdAt: new Date().toISOString() },
    ]

    renderDashboard()

    const openTransferButton = await screen.findByRole('button', { name: /transfer funds/i })
    await user.click(openTransferButton)
    await user.type(screen.getByLabelText(/recipient username/i), 'friend_user')
    await user.type(screen.getByLabelText(/amount to send/i), '100')
    await user.click(screen.getByRole('button', { name: /send funds/i }))

    await screen.findByText(/amount exceeds the available balance/i)
    expect(mockedApi.apiClient.post).not.toHaveBeenCalled()
  })

  it('blocks self-transfers before hitting the API', async () => {
    const user = userEvent.setup()

    walletResponse = [
      { id: 'wallet-primary', userId: 'user-1', currency: 'IDR', balance: '75', createdAt: new Date().toISOString() },
    ]

    renderDashboard()

    const openTransferButton = await screen.findByRole('button', { name: /transfer funds/i })
    await user.click(openTransferButton)
    await user.type(screen.getByLabelText(/recipient username/i), 'userone')
    await user.type(screen.getByLabelText(/amount to send/i), '10')
    await user.click(screen.getByRole('button', { name: /send funds/i }))

    await screen.findByText(/can’t send funds to your own username/i)
    expect(mockedApi.apiClient.post).not.toHaveBeenCalled()
  })

  it('renders analytics widgets when data is returned', async () => {
    const user = userEvent.setup()
    analyticsTransactions = [
      {
        id: 'tx-1',
        currency: 'IDR',
        amount: '-200',
        direction: 'OUT',
        counterparty: { id: 'user-2', email: 'friend@example.com', name: 'Friend' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tx-2',
        currency: 'IDR',
        amount: '150',
        direction: 'IN',
        counterparty: null,
        createdAt: new Date().toISOString(),
      },
    ]
    analyticsTopUsers = [
      { userId: 'user-a', email: 'a@example.com', name: 'User A', totalOutbound: '300' },
      { userId: 'user-b', email: 'b@example.com', name: null, totalOutbound: '150' },
    ]

    renderDashboard()

    await screen.findByRole('heading', { name: /largest movements/i })
    const viewMovementsButton = screen.getByRole('button', { name: /view movements/i })
    await user.click(viewMovementsButton)
    const movementsModal = await screen.findByRole('dialog', { name: /largest movements/i })
    expect(within(movementsModal).getByText(/friend@example.com/i)).toBeInTheDocument()
    await user.click(within(movementsModal).getByRole('button', { name: /close/i }))

    const viewLeaderboardButton = screen.getByRole('button', { name: /view leaderboard/i })
    await user.click(viewLeaderboardButton)
    const leaderboardModal = await screen.findByRole('dialog', { name: /top senders/i })
    expect(within(leaderboardModal).getByText(/User A/i)).toBeInTheDocument()
    await user.click(within(leaderboardModal).getByRole('button', { name: /close/i }))
  })
})
