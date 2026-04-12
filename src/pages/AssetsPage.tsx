import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, SlidersHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { useSiteStore } from '@/store'
import { Asset, Pagination } from '@/types'
import api from '@/lib/api'
import { formatDistanceToNow } from 'date-fns'

const ASSET_TYPES = [
  'CHILLER', 'AHU', 'ELEVATOR', 'ELECTRICAL_PANEL', 'GENERATOR',
  'FIRE_PUMP', 'FCU', 'UPS', 'PRECISION_COOLING', 'COOLING_TOWER',
  'AUTO_TRANSFER_SWITCH', 'FIRE_SUPPRESSION', 'POWER_DISTRIBUTION', 'OTHER',
]

const formatType = (t: string) => t.replace(/_/g, ' ')

export default function AssetsPage() {
  const navigate = useNavigate()
  const { selectedSiteId } = useSiteStore()
  const [assets, setAssets] = useState<Asset[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [page, setPage] = useState(1)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { page, limit: 20 }
      if (selectedSiteId) params.siteId = selectedSiteId
      if (search) params.search = search
      if (typeFilter !== 'all') params.type = typeFilter
      if (statusFilter !== 'all') params.status = statusFilter

      const res = await api.get('/assets', { params })
      setAssets(res.data.data)
      setPagination(res.data.pagination)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId, search, typeFilter, statusFilter, page])

  useEffect(() => {
    setPage(1)
  }, [selectedSiteId, search, typeFilter, statusFilter])

  useEffect(() => {
    fetchAssets()
  }, [fetchAssets])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  return (
    <div>
      <PageHeader
        title="Asset Registry"
        description={pagination ? `${pagination.total} assets registered` : 'Browse all assets'}
        breadcrumbs={[{ label: 'Assets' }]}
      />

      <div className="p-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1 min-w-64">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, serial, or asset number…"
                className="pl-9"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" size="icon">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          </form>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Asset type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {ASSET_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{formatType(t)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OPERATIONAL">Operational</SelectItem>
              <SelectItem value="NEEDS_MAINTENANCE">Needs Maintenance</SelectItem>
              <SelectItem value="OUT_OF_SERVICE">Out of Service</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card overflow-hidden">
          {loading ? (
            <PageLoader />
          ) : assets.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">No assets found</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Asset</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Location</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Last PM</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Site</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {assets.map((asset) => (
                  <tr
                    key={asset.id}
                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => navigate(`/assets/${asset.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{asset.name}</p>
                      <p className="text-xs text-muted-foreground">{asset.assetNumber} · {asset.serialNumber}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatType(asset.type)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {[asset.building, asset.floor, asset.zone].filter(Boolean).join(' · ')}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={asset.status} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {asset.lastPreventiveDate
                        ? formatDistanceToNow(new Date(asset.lastPreventiveDate), { addSuffix: true })
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{asset.site.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {(pagination.page - 1) * pagination.limit + 1}–
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span>Page {page} of {pagination.pages}</span>
              <Button variant="outline" size="sm" disabled={page === pagination.pages} onClick={() => setPage(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
