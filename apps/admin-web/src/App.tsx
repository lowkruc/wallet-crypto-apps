import './App.css'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

function App() {
  return (
    <div className="container">
      <h1>Admin Portal</h1>
      <p>
        Shared API base URL:{' '}
        <code data-testid="api-base">{apiBaseUrl}</code>
      </p>
      <p>
        Configure <code>.env.local</code> for local dev and{' '}
        <code>.env.production</code> for deployments so both the Nest API and
        this admin app stay in sync.
      </p>
    </div>
  )
}

export default App
