import { useEffect, useMemo, useState } from 'react'
import { Wallet, Wallet2, RefreshCcw } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/lib/api-client'

type WalletSummary = {
  id: string
  userId: string
  currency: string
  balance: string
  createdAt: string
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

  const primaryWalletId = user?.walletId

  const fetchWallets = async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await apiClient.get<WalletSummary[]>('/wallets/me')
      setWallets(data)
    } catch (err) {
      console.error(err)
      setError('We can’t load wallets right now. Please try again shortly.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void fetchWallets()
  }, [])

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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardPage
