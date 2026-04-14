import { useEffect, useState, useCallback } from 'react'
import { QrCode, Search, Download } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { useSiteStore } from '@/store'
import { Asset } from '@/types'
import api from '@/lib/api'

export default function QRCodesPage() {
  const { selectedSiteId } = useSiteStore()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { limit: 100 }
      if (selectedSiteId) params.siteId = selectedSiteId
      const res = await api.get('/assets', { params })
      setAssets(res.data.data ?? [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedSiteId])

  useEffect(() => { fetchAssets() }, [fetchAssets])

  const filtered = search
    ? assets.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.assetNumber?.toLowerCase().includes(search.toLowerCase()))
    : assets

  const printQR = (asset: Asset) => {
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><head><title>QR - ${asset.name}</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:32px">
        <h2>${asset.name}</h2>
        <p style="color:#666">${asset.assetNumber} · ${asset.type.replace(/_/g,' ')}</p>
        <p style="color:#666">${asset.site.name}</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${asset.qrUuid}" alt="QR Code" style="margin:16px auto;display:block"/>
        <p style="font-size:12px;color:#999">${asset.qrUuid}</p>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  return (
    <div>
      <PageHeader
        title="QR Codes"
        description={`${filtered.length} assets with QR codes`}
        breadcrumbs={[{ label: 'QR Codes' }]}
      />

      <div className="p-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search assets…"
            className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Grid */}
        {loading ? <PageLoader /> : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">No assets found</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {filtered.map((asset) => (
              <Card key={asset.id} className="overflow-hidden">
                <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${asset.qrUuid}`}
                    alt={`QR for ${asset.name}`}
                    className="rounded"
                    loading="lazy"
                  />
                  <div>
                    <p className="font-semibold text-sm leading-tight">{asset.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{asset.assetNumber}</p>
                    <p className="text-xs text-muted-foreground">{asset.type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-muted-foreground">{asset.site.name}</p>
                    <div className="mt-2">
                      <StatusBadge status={asset.status} />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={() => printQR(asset)}>
                    <Download className="h-3 w-3 mr-1" /> Print QR
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
