import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/store'
import api from '@/lib/api'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post('/auth/login', { username: username.trim(), password: password.trim() })
      const { token, user } = res.data.data
      localStorage.setItem('loc_token', token)
      setAuth(token, user)
      navigate('/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
      setError(msg || 'Login failed. Please check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Building2 className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold">2Ymentanance</h1>
          <p className="text-sm text-muted-foreground">Asset Maintenance System</p>
          <p className="text-xs text-muted-foreground">Bank Tower & NRR IT Hub — Riyadh, KSA</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>Enter your credentials to access the dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Username</label>
                <Input
                  placeholder="e.g. supervisor"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Password</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-4 rounded-md bg-muted p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Demo credentials</p>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p><span className="font-mono font-medium text-foreground">supervisor</span> / demo1234 — Admin</p>
                <p><span className="font-mono font-medium text-foreground">tech1</span> / demo1234 — Technician</p>
                <p><span className="font-mono font-medium text-foreground">viewer</span> / demo1234 — Viewer</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}