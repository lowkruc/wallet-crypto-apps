import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
  ZAxis,
  type TooltipProps,
} from 'recharts'
import { Wallet, Wallet2, RefreshCcw, Plus, ArrowRightLeft } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/lib/api-client'
import { Input } from '@/components/ui/input'
import AppLayout from '@/components/layout/AppLayout'

type WalletSummary = {
  id: string
  userId: string
  currency: string
  balance: string
  createdAt: string
}

type DepositForm = {
  walletId: string
  amount: string
  currency: string
}

type TransferForm = {
  recipientUsername: string
  amount: string
}

type AnalyticsTransaction = {
  id: string
  currency: string
  amount: string
  direction: 'IN' | 'OUT'
  counterparty?: { id: string; email: string; name?: string | null } | null
  createdAt: string
}

type AnalyticsTopUser = {
  userId: string
  email: string
  name?: string | null
  totalOutbound: string
}

type AnalyticsState = {
  loading: boolean
  error: string | null
  transactions: AnalyticsTransaction[]
  topUsers: AnalyticsTopUser[]
}

type TransactionChartDatum = {
  id: string
  label: string
  amountLabel: string
  amount: number
  currency: string
  counterparty: string
  direction: 'IN' | 'OUT'
  size: number
}

type TopUserChartDatum = {
  userId: string
  label: string
  amount: number
  email: string
}

const resolveApiErrorMessage = (error: unknown) => {
  if (typeof error === 'object' && error !== null) {
    const response = (error as { response?: { data?: { message?: string | string[] } } }).response
    const message = response?.data?.message
    if (typeof message === 'string') {
      return message
    }
    if (Array.isArray(message) && message.length > 0 && typeof message[0] === 'string') {
      return message[0]
    }
  }
  if (error instanceof Error) {
    return error.message
  }
  return null
}

const formatBalance = (value: string, currency: string) => {
  const formatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  })
  return formatter.format(Number(value))
}

const formatWalletId = (id: string) => (id.length <= 10 ? id : `${id.slice(0, 4)}…${id.slice(-4)}`)

const ANALYTICS_LIMIT = 5

const formatCurrencyValue = (value: number, currency: string) => {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency,
      maximumFractionDigits: Math.abs(value) < 1 ? 2 : 0,
    }).format(value)
  } catch {
    return `${value.toFixed(2)} ${currency}`
  }
}

const OUTBOUND_COLOR = 'hsl(var(--primary))'
const INBOUND_COLOR = 'hsl(var(--primary-purple))'
const AREA_STROKE = 'hsl(var(--primary-fuchsia))'
const GRID_COLOR = 'hsl(var(--border))'
const AXIS_COLOR = 'hsl(var(--muted-foreground))'

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user)
  const [wallets, setWallets] = useState<WalletSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDepositing, setIsDepositing] = useState(false)
  const [depositError, setDepositError] = useState<string | null>(null)
  const [depositForm, setDepositForm] = useState<DepositForm>({
    walletId: '',
    amount: '',
    currency: 'IDR',
  })
  const [transferForm, setTransferForm] = useState<TransferForm>({
    recipientUsername: '',
    amount: '',
  })
  const [transferError, setTransferError] = useState<string | null>(null)
  const [isTransferring, setIsTransferring] = useState(false)
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false)
  const [isTransactionsModalOpen, setIsTransactionsModalOpen] = useState(false)
  const [isTopUsersModalOpen, setIsTopUsersModalOpen] = useState(false)
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [appliedRange, setAppliedRange] = useState<{ from: string; to: string }>({ from: '', to: '' })
  const [analyticsState, setAnalyticsState] = useState<AnalyticsState>({
    loading: true,
    error: null,
    transactions: [],
    topUsers: [],
  })

  const primaryWalletId = user?.walletId

  const fetchWallets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await apiClient.get<WalletSummary[]>('/wallets/me')
      setWallets(data)
      if (!depositForm.walletId && data.length > 0) {
        setDepositForm((prev) => ({ ...prev, walletId: data[0].id, currency: data[0].currency }))
      }
    } catch (err) {
      console.error(err)
      setError('We can’t load wallets right now. Please try again shortly.')
    } finally {
      setLoading(false)
    }
  }, [depositForm.walletId])

  const fetchAnalytics = useCallback(async (rangeOverride?: { from: string; to: string }) => {
    if (!user?.id) {
      setAnalyticsState((prev) => ({ ...prev, loading: false }))
      return
    }
    setAnalyticsState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const range = rangeOverride ?? appliedRange
      const params: Record<string, string | number> = { limit: ANALYTICS_LIMIT }
      if (range.from) {
        params.startDate = range.from
      }
      if (range.to) {
        params.endDate = range.to
      }
      const [transactionsResponse, topUsersResponse] = await Promise.all([
        apiClient.get<{ userId: string; transactions: AnalyticsTransaction[] }>(
          `/analytics/users/${user.id}/top-transactions`,
          { params },
        ),
        apiClient.get<{ users: AnalyticsTopUser[] }>('/analytics/top-users', {
          params,
        }),
      ])
      setAnalyticsState({
        loading: false,
        error: null,
        transactions: transactionsResponse.data.transactions,
        topUsers: topUsersResponse.data.users,
      })
    } catch (err) {
      console.error(err)
      const message =
        resolveApiErrorMessage(err) ?? 'Analytics are unavailable right now.'
      setAnalyticsState({
        loading: false,
        error: message,
        transactions: [],
        topUsers: [],
      })
    }
  }, [user?.id, appliedRange])

  useEffect(() => {
    void fetchWallets()
  }, [fetchWallets])

  useEffect(() => {
    void fetchAnalytics()
  }, [fetchAnalytics])

  const highlightedWallet = useMemo(() => wallets.find((wallet) => wallet.id === primaryWalletId), [wallets, primaryWalletId])
  const secondaryWallets = useMemo(() => wallets.filter((wallet) => wallet.id !== primaryWalletId), [wallets, primaryWalletId])
  const availableBalance = useMemo(() => {
    if (!highlightedWallet) {
      return 0
    }
    const parsed = Number(highlightedWallet.balance)
    return Number.isFinite(parsed) ? parsed : 0
  }, [highlightedWallet])
  const transactionChartData = useMemo<TransactionChartDatum[]>(() => {
    return analyticsState.transactions.map((tx) => {
      const amount = Number(tx.amount)
      const label = new Date(tx.createdAt).toLocaleDateString('id-ID', {
        month: 'short',
        day: 'numeric',
      })
      return {
        id: tx.id,
        label,
        amountLabel: `${label} • ${tx.counterparty?.email ?? 'External account'}`,
        amount,
        currency: tx.currency,
        counterparty: tx.counterparty?.email ?? 'External account',
        direction: tx.direction,
        size: Math.min(40, Math.max(12, Math.abs(amount) / 1000)),
      }
    })
  }, [analyticsState.transactions])
  const topUserChartData = useMemo<TopUserChartDatum[]>(() => {
    return analyticsState.topUsers.map((entry) => ({
      userId: entry.userId,
      label: entry.name ?? entry.email,
      amount: Number(entry.totalOutbound),
      email: entry.email,
    }))
  }, [analyticsState.topUsers])

  const analyticsLoading = analyticsState.loading
  const analyticsError = analyticsState.error
  const hasTransactionData = transactionChartData.length > 0
  const hasTopUsersData = topUserChartData.length > 0

  const handleTransferSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setTransferError(null)

    if (!highlightedWallet) {
      setTransferError('You need an active wallet before sending funds.')
      return
    }

    const normalizedUsername = transferForm.recipientUsername.trim().toLowerCase()
    if (!normalizedUsername) {
      setTransferError('Enter the recipient username before continuing.')
      return
    }

    if (user?.username && normalizedUsername === user.username.toLowerCase()) {
      setTransferError('You can’t send funds to your own username.')
      return
    }

    const amountValue = Number(transferForm.amount)
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setTransferError('Enter an amount greater than zero.')
      return
    }

    if (amountValue > availableBalance) {
      setTransferError('Amount exceeds the available balance.')
      return
    }

    setIsTransferring(true)
    try {
      await apiClient.post('/wallets/transfer', {
        recipientUsername: transferForm.recipientUsername.trim(),
        amount: amountValue,
      })
      setTransferForm({ recipientUsername: '', amount: '' })
      setTransferError(null)
      setIsTransferModalOpen(false)
      void fetchWallets()
    } catch (error) {
      console.error(error)
      const message = resolveApiErrorMessage(error) ?? 'Transfer failed. Please try again.'
      setTransferError(message)
    } finally {
      setIsTransferring(false)
    }
  }

  const renderSkeleton = () => (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1, 2].map((item) => (
        <Card key={item} className="border-border/50 bg-background/70">
          <CardHeader>
            <div className="h-4 w-24 animate-pulse rounded-full bg-muted" />
            <div className="mt-3 h-8 w-40 animate-pulse rounded-full bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-3 w-16 animate-pulse rounded-full bg-muted" />
          </CardContent>
        </Card>
      ))}
    </div>
  )

  const handleRefresh = () => {
    void Promise.all([fetchWallets(), fetchAnalytics()])
  }

  const handleDateRangeSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAppliedRange(dateRange)
    await fetchAnalytics(dateRange)
  }

  const handleClearDateRange = () => {
    const cleared = { from: '', to: '' }
    setDateRange(cleared)
    setAppliedRange(cleared)
    void fetchAnalytics(cleared)
  }

  const refreshAction = (
    <Button
      variant="ghost"
      className="rounded-full"
      onClick={handleRefresh}
      disabled={loading || analyticsState.loading}
    >
      <RefreshCcw className="mr-2 h-4 w-4" />
      Refresh
    </Button>
  )

  return (
    <AppLayout
      title={`Welcome back, ${
        user?.name ?? (user?.username ? `@${user.username}` : user?.email ?? 'there')
      }`}
      description="Balances, recent movements, and controls for your reviewer session."
      actions={refreshAction}
    >
      {error && (
        <p className="rounded-2xl border border-destructive/60 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <form
        className="mt-6 grid gap-4 rounded-3xl border border-border/70 bg-background/70 p-4 sm:grid-cols-[repeat(2,minmax(0,1fr))_auto_auto] sm:items-end"
        onSubmit={handleDateRangeSubmit}
      >
        <div className="space-y-1">
          <label htmlFor="date-from" className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            From
          </label>
          <Input
            id="date-from"
            type="date"
            value={dateRange.from}
            onChange={(event) => setDateRange((prev) => ({ ...prev, from: event.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="date-to" className="text-xs font-semibold uppercase tracking-[0.35em] text-muted-foreground">
            To
          </label>
          <Input
            id="date-to"
            type="date"
            value={dateRange.to}
            onChange={(event) => setDateRange((prev) => ({ ...prev, to: event.target.value }))}
          />
        </div>
        <Button type="submit" className="rounded-full" disabled={analyticsLoading}>
          Apply range
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="rounded-full"
          onClick={handleClearDateRange}
          disabled={analyticsLoading || (!dateRange.from && !dateRange.to)}
        >
          Clear
        </Button>
      </form>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.65fr)_minmax(0,0.35fr)]">
          <Card className="border border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Main balance
              </CardTitle>
              <CardDescription>Primary wallet linked to this profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {highlightedWallet ? (
                <>
                  <p className="text-4xl font-semibold text-foreground">
                    {formatBalance(highlightedWallet.balance, highlightedWallet.currency)}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-xs text-muted-foreground">Wallet ID</p>
                      <p className="font-mono text-base text-foreground">{formatWalletId(highlightedWallet.id)}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
                      <p className="text-xs text-muted-foreground">Currency</p>
                      <p className="text-base font-medium text-foreground">{highlightedWallet.currency}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      className="flex-1"
                      onClick={() => {
                        setDepositForm({
                          walletId: highlightedWallet.id,
                          currency: highlightedWallet.currency,
                          amount: '',
                        })
                        setIsDepositing(true)
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Deposit funds
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="flex-1"
                      onClick={() => {
                        setTransferError(null)
                        setIsTransferModalOpen(true)
                      }}
                    >
                      <ArrowRightLeft className="mr-2 h-4 w-4" />
                      Transfer funds
                    </Button>
                  </div>
                </>
              ) : loading ? (
                <div className="space-y-2">
                  <div className="h-10 w-48 animate-pulse rounded-full bg-muted" />
                  <div className="h-4 w-32 animate-pulse rounded-full bg-muted" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No wallet found for this profile.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-background/80">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet2 className="h-5 w-5 text-primary" />
                Snapshot
              </CardTitle>
              <CardDescription>Live portfolio stats.</CardDescription>
            </CardHeader>
            <CardContent className="flex h-full flex-col gap-4">
              <div className="flex items-center justify-between rounded-2xl border border-border/60 px-4 py-3">
                <div>
                  <p className="text-xs text-muted-foreground">Wallets</p>
                  <p className="text-2xl font-semibold text-foreground">{wallets.length}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Primary currency</p>
                  <p className="text-base font-medium text-foreground">{highlightedWallet?.currency ?? '—'}</p>
                </div>
              </div>
            <div className="rounded-2xl border border-border/60 bg-background/70 p-4 text-sm text-muted-foreground">
              <p>Balances refresh after each deposit. Use the refresh action above to sync changes from other reviewers.</p>
            </div>
          </CardContent>
        </Card>
      </div>

        {loading ? (
          renderSkeleton()
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {secondaryWallets.map((wallet) => (
              <Card key={wallet.id} className="border border-border/70 bg-background/80">
                <CardHeader>
                  <CardTitle>{wallet.currency} wallet</CardTitle>
                  <CardDescription>Created {new Date(wallet.createdAt).toLocaleDateString()}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                <p className="text-2xl font-semibold text-foreground">{formatBalance(wallet.balance, wallet.currency)}</p>
                <p className="text-xs text-muted-foreground">ID: {formatWalletId(wallet.id)}</p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDepositForm({ walletId: wallet.id, currency: wallet.currency, amount: '' })
                    setIsDepositing(true)
                    }}
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Deposit
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-8 space-y-6">
          <Card className="border border-border/70 bg-background/80">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRightLeft className="h-5 w-5 text-primary" />
                  Largest movements
                </CardTitle>
                <CardDescription>Recent credits and debits ranked by value.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() => void fetchAnalytics()}
                  disabled={analyticsLoading}
                >
                  <RefreshCcw className="h-4 w-4" />
                  <span className="sr-only">Reload largest movements</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setIsTransactionsModalOpen(true)}
                  disabled={!hasTransactionData}
                >
                  View movements
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {analyticsLoading ? (
                <div className="h-56 animate-pulse rounded-3xl bg-muted/30" />
              ) : analyticsError ? (
                <p
                  className="rounded-2xl border border-destructive/70 bg-destructive/10 px-4 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {analyticsError}
                </p>
              ) : hasTransactionData ? (
                <>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          type="category"
                        />
                        <YAxis
                          dataKey="amount"
                          tickFormatter={(value: number) =>
                            formatCurrencyValue(value, transactionChartData[0]?.currency ?? 'IDR')
                          }
                          tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          width={90}
                          domain={['dataMin', 'dataMax']}
                        />
                        <ReferenceLine y={0} stroke={AXIS_COLOR} strokeDasharray="4 4" opacity={0.5} />
                        <RechartsTooltip content={<TransactionTooltipContent />} cursor={{ stroke: 'transparent' }} />
                        <ZAxis dataKey="size" range={[80, 200]} />
                        <Line
                          type="monotone"
                          dataKey="amount"
                          stroke={AREA_STROKE}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 6, strokeWidth: 0 }}
                        />
                        <Scatter data={transactionChartData}>
                          {transactionChartData.map((entry) => (
                            <Cell
                              key={entry.id}
                              fill={entry.amount < 0 ? OUTBOUND_COLOR : INBOUND_COLOR}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  We’ll chart your analytics once you start sending funds.
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-background/80">
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Top senders</CardTitle>
                <CardDescription>Reviewer leaderboard by outbound transfers.</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full"
                  onClick={() => void fetchAnalytics()}
                  disabled={analyticsLoading}
                >
                  <RefreshCcw className="h-4 w-4" />
                  <span className="sr-only">Reload top senders</span>
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setIsTopUsersModalOpen(true)}
                  disabled={!hasTopUsersData}
                >
                  View leaderboard
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {analyticsLoading ? (
                <div className="h-56 animate-pulse rounded-3xl bg-muted/30" />
              ) : analyticsError ? (
                <p
                  className="rounded-2xl border border-destructive/70 bg-destructive/10 px-4 py-2 text-sm text-destructive"
                  role="alert"
                >
                  {analyticsError}
                </p>
              ) : hasTopUsersData ? (
                <>
                  <div className="h-60">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={topUserChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="topUsersArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={AREA_STROKE} stopOpacity={0.7} />
                            <stop offset="95%" stopColor={AREA_STROKE} stopOpacity={0.05} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" opacity={0.3} />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          tickFormatter={(value: number) => formatCurrencyValue(value, 'IDR')}
                          tick={{ fill: AXIS_COLOR, fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                          width={70}
                        />
                        <RechartsTooltip content={<TopUsersTooltipContent />} cursor={{ stroke: 'transparent' }} />
                        <Area
                          type="monotone"
                          dataKey="amount"
                          stroke={AREA_STROKE}
                          fillOpacity={1}
                          fill="url(#topUsersArea)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Outbound transfers will populate this leaderboard automatically.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {isDepositing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-3xl border border-border/80 bg-background p-6 shadow-xl">
              <div className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Deposit</p>
                <h2 className="text-2xl font-semibold text-foreground">Top up your wallet</h2>
                <p className="text-sm text-muted-foreground">
                  Funds arrive instantly. Pick a wallet and enter the amount you want to add.
                </p>
              </div>

              <form
                className="mt-6 space-y-4"
                noValidate
                onSubmit={async (event) => {
                  event.preventDefault()
                  setDepositError(null)
                  const amountValue = Number(depositForm.amount)
                  if (!depositForm.walletId) {
                    setDepositError('Select a wallet before adding funds.')
                    return
                  }
                  if (!Number.isFinite(amountValue) || amountValue <= 0) {
                    setDepositError('Enter an amount greater than zero.')
                    return
                  }
                  try {
                    await apiClient.post(`/wallets/${depositForm.walletId}/deposit`, {
                      amount: amountValue,
                      currency: depositForm.currency,
                    })
                    setIsDepositing(false)
                    setDepositForm((prev) => ({ ...prev, amount: '' }))
                    void fetchWallets()
                  } catch (err) {
                    console.error(err)
                    setDepositError('Deposit failed. Please check the form and try again.')
                  }
                }}
              >
                <div className="space-y-2 text-left">
                  <label htmlFor="wallet-select" className="text-sm font-medium text-foreground">
                    Wallet
                  </label>
                  <select
                    id="wallet-select"
                    className="h-11 w-full rounded-full border border-input bg-transparent px-5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    value={depositForm.walletId}
                    onChange={(event) => {
                      const selectedWallet = wallets.find((wallet) => wallet.id === event.target.value)
                      setDepositForm((prev) => ({
                        ...prev,
                        walletId: event.target.value,
                        currency: selectedWallet?.currency ?? prev.currency,
                      }))
                    }}
                    required
                  >
                    <option value="" disabled>
                      Select wallet
                    </option>
                    {wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.currency} — {formatWalletId(wallet.id)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label htmlFor="amount" className="text-sm font-medium text-foreground">
                    Amount ({depositForm.currency})
                  </label>
                  <Input
                    id="amount"
                    type="number"
                    min={0}
                    step="0.01"
                    value={depositForm.amount}
                    onChange={(event) => setDepositForm((prev) => ({ ...prev, amount: event.target.value }))}
                    required
                    placeholder="0.00"
                  />
                </div>

                {depositError && (
                  <p className="rounded-2xl border border-destructive/60 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
                    {depositError}
                  </p>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button type="submit" className="flex-1" disabled={!depositForm.amount}>
                    Add funds
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setIsDepositing(false)
                      setDepositError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isTransactionsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div
              className="w-full max-w-lg rounded-3xl border border-border/80 bg-background p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="transactions-modal-title"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Details</p>
                  <h2 id="transactions-modal-title" className="text-2xl font-semibold text-foreground">
                    Largest movements
                  </h2>
                </div>
                <Button variant="ghost" className="rounded-full" onClick={() => setIsTransactionsModalOpen(false)}>
                  Close
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {analyticsState.transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    We’ll save a history once transfers start flowing.
                  </p>
                ) : (
                  analyticsState.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm"
                    >
                      <div className="overflow-hidden">
                        <p className="font-semibold text-foreground">
                          {tx.counterparty?.email ?? 'External account'}
                        </p>
                        <p className="text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString('id-ID', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <p
                        className={`font-semibold ${
                          Number(tx.amount) < 0 ? 'text-primary' : 'text-primary-purple'
                        }`}
                      >
                        {formatCurrencyValue(Number(tx.amount), tx.currency)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {isTopUsersModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div
              className="w-full max-w-lg rounded-3xl border border-border/80 bg-background p-6 shadow-xl"
              role="dialog"
              aria-modal="true"
              aria-labelledby="top-users-modal-title"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Leaderboard</p>
                  <h2 id="top-users-modal-title" className="text-2xl font-semibold text-foreground">
                    Top senders
                  </h2>
                </div>
                <Button variant="ghost" className="rounded-full" onClick={() => setIsTopUsersModalOpen(false)}>
                  Close
                </Button>
              </div>
              <div className="mt-4 space-y-3">
                {analyticsState.topUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No outbound transfers recorded yet.</p>
                ) : (
                  analyticsState.topUsers.map((entry, index) => (
                    <div
                      key={entry.userId}
                      className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {index + 1}. {entry.name ?? entry.email}
                        </p>
                        <p className="text-muted-foreground">{entry.email}</p>
                      </div>
                      <p className="font-semibold text-primary-purple">
                        {formatCurrencyValue(Number(entry.totalOutbound), 'IDR')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {isTransferModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-3xl border border-border/80 bg-background p-6 shadow-xl">
              <div className="space-y-2 text-center">
                <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Transfer</p>
                <h2 className="text-2xl font-semibold text-foreground">Send funds to another reviewer</h2>
                <p className="text-sm text-muted-foreground">
                  Transfers always debit your primary wallet and execute instantly.
                </p>
              </div>

              {highlightedWallet ? (
                <form className="mt-6 space-y-4" noValidate onSubmit={handleTransferSubmit}>
                  <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                    <p>
                      Available:{' '}
                      <span className="font-semibold text-foreground">
                        {formatBalance(highlightedWallet.balance, highlightedWallet.currency)}
                      </span>
                    </p>
                    <p>Amounts above the available balance are blocked automatically.</p>
                  </div>

                  <div className="space-y-2 text-left">
                    <label htmlFor="recipient-username" className="text-sm font-medium text-foreground">
                      Recipient username
                    </label>
                    <Input
                      id="recipient-username"
                      autoComplete="off"
                      placeholder="reviewer_handle"
                      value={transferForm.recipientUsername}
                      onChange={(event) =>
                        setTransferForm((prev) => ({ ...prev, recipientUsername: event.target.value }))
                      }
                      disabled={isTransferring}
                      required
                    />
                  </div>

                  <div className="space-y-2 text-left">
                    <label htmlFor="transfer-amount" className="text-sm font-medium text-foreground">
                      Amount to send ({highlightedWallet.currency})
                    </label>
                    <Input
                      id="transfer-amount"
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="0.00"
                      value={transferForm.amount}
                      onChange={(event) => setTransferForm((prev) => ({ ...prev, amount: event.target.value }))}
                      disabled={isTransferring}
                      required
                    />
                  </div>

                  {transferError && (
                    <p className="rounded-2xl border border-destructive/60 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
                      {transferError}
                    </p>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="submit" className="flex-1" disabled={isTransferring}>
                      {isTransferring ? 'Sending…' : 'Send funds'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      className="flex-1"
                      onClick={() => {
                        setIsTransferModalOpen(false)
                        setTransferError(null)
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <p className="mt-6 text-center text-sm text-muted-foreground">
                  Transfers unlock once a wallet is assigned to this profile.
                </p>
              )}
            </div>
          </div>
        )}
    </AppLayout>
  )
}

const TransactionTooltipContent = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) {
    return null
  }
  const data = payload[0].payload as TransactionChartDatum
  return (
    <div className="rounded-2xl border border-border/60 bg-background/90 px-3 py-2 text-xs text-foreground shadow-none">
      <p className="font-semibold">{data.amountLabel}</p>
      <p className={`font-semibold ${data.amount < 0 ? 'text-primary' : 'text-primary-purple'}`}>
        {formatCurrencyValue(data.amount, data.currency)}
      </p>
      <p className="text-muted-foreground">{data.counterparty}</p>
    </div>
  )
}

const TopUsersTooltipContent = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || payload.length === 0) {
    return null
  }
  const data = payload[0].payload as TopUserChartDatum
  return (
    <div className="rounded-2xl border border-border/60 bg-background/90 px-3 py-2 text-xs text-foreground shadow-none">
      <p className="font-semibold">{data.label}</p>
      <p className="font-semibold text-primary-purple">
        {formatCurrencyValue(data.amount, 'IDR')}
      </p>
      <p className="text-muted-foreground">{data.email}</p>
    </div>
  )
}

export default DashboardPage
