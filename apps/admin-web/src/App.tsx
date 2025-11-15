import { ArrowRight } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

const palette = [
  { label: 'Primary Pink', hex: '#ec4899', token: '--primary-pink' },
  { label: 'Radiant Fuchsia', hex: '#d946ef', token: '--primary-fuchsia' },
  { label: 'Vivid Purple', hex: '#a855f7', token: '--primary-purple' },
]

function App() {
  return (
    <div className="bg-gradient-to-b from-background via-background/90 to-background pb-16 pt-20">
      <div className="mx-auto flex max-w-4xl flex-col gap-8 px-6">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.35em] text-primary/80">
            Wallet Admin Shell
          </p>
          <h1 className="text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
            Tailwind + shadcn/ui baseline
          </h1>
          <p className="text-muted-foreground sm:text-lg">
            Tokens, colors, and rounded controls are ready for dashboard work. Every CTA inherits the
            pink→purple palette and focus rings to meet the global styling brief.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>API wiring</CardTitle>
            <CardDescription>
              The admin web reads <code>.env.*</code> files to stay aligned with the Nest API host.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Input readOnly value={apiBaseUrl} data-testid="api-base" />
              <Button type="button">
                Run dashboard
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Update <code>.env.local</code> for local development or <code>.env.production</code> for deployments
              to drive both the API and admin front-end.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Palette tokens</CardTitle>
            <CardDescription>
              CSS variables exposed in <code>tailwind.config.ts</code> keep CTAs, focus rings, and gradients in sync.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              {palette.map((color) => (
                <div key={color.token} className="space-y-2 rounded-2xl border border-border/60 p-4 text-sm">
                  <div className="h-14 rounded-full" style={{ backgroundColor: color.hex }} />
                  <p className="font-semibold text-foreground">{color.label}</p>
                  <code className="text-muted-foreground">{color.token}</code>
                  <p className="text-xs text-muted-foreground">{color.hex}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App
