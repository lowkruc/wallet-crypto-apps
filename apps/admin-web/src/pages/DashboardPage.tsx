import { useCallback, useEffect, useMemo, useState } from 'react'
import { Wallet, Wallet2, RefreshCcw, Plus } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/lib/api-client'
import { Input } from '@/components/ui/input'

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

const formatBalance = (value: string, currency: string) => {
  const formatter = new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  })
  return formatter.format(Number(value))
}

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
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

  useEffect(() => {
    void fetchWallets()
  }, [fetchWallets])

  const highlightedWallet = useMemo(() => wallets.find((wallet) => wallet.id === primaryWalletId), [wallets, primaryWalletId])
  const secondaryWallets = useMemo(() => wallets.filter((wallet) => wallet.id !== primaryWalletId), [wallets, primaryWalletId])

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background px-4 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Wallet overview</p>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">
            Welcome back, {user?.name ?? user?.email ?? 'there'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Balances, recent movements, and session controls live here. Refresh anytime to pull the latest data.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-2 border border-border/70 bg-card/90 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Main balance
              </CardTitle>
              <CardDescription>The wallet you land on first when signing in.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {highlightedWallet ? (
                <>
                  <p className="text-2xl font-semibold text-foreground">
                    {formatBalance(highlightedWallet.balance, highlightedWallet.currency)}
                  </p>
                  <div className="text-sm text-muted-foreground">
                    <p>ID: {highlightedWallet.id}</p>
                    <p>Currency: {highlightedWallet.currency}</p>
                  </div>
                  <Button
                    variant="default"
                    className="w-full"
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
                </>
              ) : loading ? (
                <div className="space-y-2">
                  <div className="h-8 w-40 animate-pulse rounded-full bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No wallet found for this profile.</p>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/70 bg-background/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet2 className="h-5 w-5 text-primary" />
                Session & actions
              </CardTitle>
              <CardDescription>Sign out or refresh balances if another reviewer made changes.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button variant="secondary" onClick={logout} className="w-full">
                Log out
              </Button>
              <Button variant="ghost" onClick={() => void fetchWallets()} disabled={loading} className="w-full">
                <RefreshCcw className="mr-2 h-4 w-4" /> Refresh balances
              </Button>
              {error && (
                <p className="rounded-2xl border border-destructive/60 bg-destructive/10 px-4 py-2 text-xs text-destructive" role="alert">
                  {error}
                </p>
              )}
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
                  <p className="text-xs text-muted-foreground">ID: {wallet.id}</p>
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
                        {wallet.currency} — {wallet.id.slice(0, 6)}…
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
      </div>
    </div>
  )
}

export default DashboardPage
