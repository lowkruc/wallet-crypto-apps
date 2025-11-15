import { type FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { UserPlus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/store/auth'

const RegisterPage = () => {
  const navigate = useNavigate()
  const token = useAuthStore((state) => state.token)
  const register = useAuthStore((state) => state.register)
  const loading = useAuthStore((state) => state.loading)
  const error = useAuthStore((state) => state.error)
  const clearError = useAuthStore((state) => state.clearError)

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      clearError()
      setLocalError(null)
    }
  }, [clearError])

  if (token) {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLocalError(null)
    try {
      await register({ name: name || undefined, email, password })
      navigate('/dashboard', { replace: true })
    } catch {
      setLocalError('We could not create your account. Check the form and try again.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col justify-center bg-gradient-to-b from-background to-background/95 px-4 py-12">
      <div className="mx-auto w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-primary/80">Wallet Admin</p>
          <h1 className="text-3xl font-semibold text-foreground sm:text-4xl">Create your account</h1>
          <p className="text-sm text-muted-foreground">
            Set up your login details to start exploring balances and activity.
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <UserPlus className="h-5 w-5 text-primary" aria-hidden="true" />
              Quick setup
            </CardTitle>
            <CardDescription>We’ll create your first wallet automatically after you sign up.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-foreground">
                  Full name
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => {
                    if (error) clearError()
                    if (localError) setLocalError(null)
                    setName(event.target.value)
                  }}
                  placeholder="Alex Reviewer"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    if (error) clearError()
                    if (localError) setLocalError(null)
                    setEmail(event.target.value)
                  }}
                  required
                  placeholder="you@example.com"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => {
                    if (error) clearError()
                    if (localError) setLocalError(null)
                    setPassword(event.target.value)
                  }}
                  required
                  placeholder="Minimum 8 characters"
                />
              </div>

              {(error || localError) && (
                <p className="rounded-2xl border border-destructive/70 bg-destructive/10 px-4 py-2 text-sm text-destructive" role="alert">
                  {localError ?? error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have access?{' '}
          <Link to="/login" className="font-semibold text-primary hover:text-primary-fuchsia">
            Sign in instead
          </Link>
        </p>
      </div>
    </div>
  )
}

export default RegisterPage
