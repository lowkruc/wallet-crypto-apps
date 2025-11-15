import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth'

const DashboardPage = () => {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background/95 to-background px-4 py-12">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Wallet dashboard</p>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">Welcome back, {user?.name ?? user?.email}</h1>
          <p className="text-sm text-muted-foreground">
            This placeholder proves the auth guard works. Later tasks will populate this surface with wallet KPIs and analytics charts.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Reviewer identity</CardTitle>
              <CardDescription>JWT payload mirrored from the Nest API.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Email</p>
                <p className="font-medium text-foreground">{user?.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Wallet ID</p>
                <p className="font-medium text-foreground">{user?.walletId}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Session control</CardTitle>
              <CardDescription>Tokens live in localStorage and Axios headers.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button variant="secondary" onClick={logout} className="w-full">
                Log out
              </Button>
              <p className="text-xs text-muted-foreground">
                Update <code>.env.local</code> &rarr; `VITE_API_BASE_URL` to point at the correct Nest API environment before running `pnpm
                dev:admin`.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage
