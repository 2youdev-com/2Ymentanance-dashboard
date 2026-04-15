import { useEffect, useState, useCallback } from 'react'
import { Plus, Trash2, Pencil, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { Site } from '@/types'
import api from '@/lib/api'

// ── The API returns sites as [{ siteId, site: { id, name } }]
// ── so we define a local User type that matches the actual response
interface ApiUser {
  id: string
  username: string
  fullName: string
  role: 'ADMIN' | 'TECHNICIAN' | 'VIEWER'
  photoUrl?: string
  sites: { siteId: string; site: { id: string; name: string } }[]
}

interface UserForm {
  username: string
  password: string
  fullName: string
  role: string
  siteIds: string[]
}

const EMPTY_FORM: UserForm = {
  username: '', password: '', fullName: '', role: 'TECHNICIAN', siteIds: [],
}

const ROLE_COLORS: Record<string, 'default' | 'secondary' | 'warning'> = {
  ADMIN: 'default',
  TECHNICIAN: 'secondary',
  VIEWER: 'warning',
}

export default function UsersPage() {
  const [users, setUsers] = useState<ApiUser[]>([])
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<UserForm>(EMPTY_FORM)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, sitesRes] = await Promise.all([
        api.get('/users'),
        api.get('/sites'),
      ])
      setUsers(usersRes.data.data)
      setSites(sitesRes.data.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const openCreate = () => {
    setEditingUser(null)
    setForm(EMPTY_FORM)
    setError(null)
    setShowForm(true)
  }

  const openEdit = (user: ApiUser) => {
    setEditingUser(user)
    setForm({
      username: user.username,
      password: '',
      fullName: user.fullName,
      role: user.role,
      // ← fix: extract id from nested site object
      siteIds: user.sites.map(s => s.site.id),
    })
    setError(null)
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Frontend validation
    if (!editingUser && form.siteIds.length === 0) {
      setError('Please select at least one site.')
      return
    }
    if (!editingUser && form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setSaving(true)
    try {
      if (editingUser) {
        const payload: Partial<UserForm> = {
          fullName: form.fullName,
          role: form.role,
          siteIds: form.siteIds,
        }
        if (form.password) payload.password = form.password
        await api.patch(`/users/${editingUser.id}`, payload)
      } else {
        await api.post('/users', form)
      }
      setShowForm(false)
      setEditingUser(null)
      setForm(EMPTY_FORM)
      fetchUsers()
    } catch (err: any) {
      // Show the error message from the API if available
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        'Something went wrong. Please try again.'
      setError(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return
    try {
      await api.delete(`/users/${id}`)
      fetchUsers()
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to delete user.')
    }
  }

  const toggleSite = (siteId: string) => {
    setForm(f => ({
      ...f,
      siteIds: f.siteIds.includes(siteId)
        ? f.siteIds.filter(id => id !== siteId)
        : [...f.siteIds, siteId],
    }))
  }

  if (loading) return <PageLoader />

  return (
    <div>
      <PageHeader
        title="User Management"
        description={`${users.length} users registered`}
        breadcrumbs={[{ label: 'Users' }]}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Add User
          </Button>
        }
      />

      <div className="p-6 space-y-6">

        {/* ── Form ── */}
        {showForm && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {editingUser ? 'Edit User' : 'New User'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Error banner */}
              {error && (
                <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Full Name</label>
                  <Input
                    value={form.fullName}
                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Username</label>
                  <Input
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    disabled={!!editingUser}
                    required={!editingUser}
                    autoComplete="off"
                  />
                  {editingUser && (
                    <p className="text-xs text-muted-foreground">Username cannot be changed</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    {editingUser ? 'New Password (optional)' : 'Password'}
                  </label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    required={!editingUser}
                    autoComplete="new-password"
                    placeholder={editingUser ? 'Leave blank to keep current' : 'Min. 8 characters'}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Role</label>
                  <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="TECHNICIAN">Technician</SelectItem>
                      <SelectItem value="VIEWER">Viewer</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="col-span-2 space-y-1">
                  <label className="text-sm font-medium">
                    Site Access
                    <span className="text-destructive ml-1">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {sites.map(site => (
                      <button
                        key={site.id}
                        type="button"
                        onClick={() => toggleSite(site.id)}
                        className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                          form.siteIds.includes(site.id)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-input hover:bg-accent'
                        }`}
                      >
                        {site.name}
                      </button>
                    ))}
                  </div>
                  {form.siteIds.length === 0 && (
                    <p className="text-xs text-muted-foreground">Select at least one site</p>
                  )}
                </div>

                <div className="col-span-2 flex gap-2 justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setShowForm(false); setError(null) }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingUser ? 'Save Changes' : 'Create User'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Users table ── */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Sites</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {user.fullName.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-xs text-muted-foreground">@{user.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={ROLE_COLORS[user.role] || 'secondary'}>{user.role}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {/* ← fix: read from nested site object */}
                      {user.sites.map(s => (
                        <span key={s.siteId} className="rounded bg-muted px-2 py-0.5 text-xs">
                          {s.site.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => openEdit(user)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(user.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  )
}