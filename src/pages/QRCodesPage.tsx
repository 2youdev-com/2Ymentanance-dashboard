import { useEffect, useState, useCallback } from 'react'
import { QrCode, Search, Download, Plus, Trash2, Printer, Package } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/ui/status-badge'
import { useSiteStore } from '@/store'
import { Asset } from '@/types'
import api from '@/lib/api'

// ── UUID generator ────────────────────────────────────────────────────────────
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

interface GeneratedQR {
  uuid: string
  createdAt: Date
  label: string
}

// ── QR image URL ──────────────────────────────────────────────────────────────
const qrUrl = (uuid: string, size = 150) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${uuid}&margin=8`

// ── Print helpers ─────────────────────────────────────────────────────────────
function printGeneratedQRs(qrs: GeneratedQR[]) {
  const win = window.open('', '_blank')
  if (!win) return
  const items = qrs
    .map(
      (q) => `
      <div style="display:inline-block;text-align:center;margin:12px;padding:16px;border:1px solid #ddd;border-radius:8px;width:180px;vertical-align:top">
        <img src="${qrUrl(q.uuid, 140)}" style="display:block;margin:0 auto"/>
        <p style="font-size:11px;font-weight:bold;margin:8px 0 2px">${q.label || 'Unregistered Asset'}</p>
        <p style="font-size:9px;color:#888;word-break:break-all">${q.uuid}</p>
        <p style="font-size:9px;color:#aaa">Generated: ${q.createdAt.toLocaleDateString()}</p>
      </div>`
    )
    .join('')
  win.document.write(`
    <html>
      <head><title>New QR Codes</title></head>
      <body style="font-family:sans-serif;padding:24px">
        <h2 style="margin-bottom:4px">New Asset QR Codes</h2>
        <p style="color:#888;font-size:13px;margin-bottom:20px">
          Scan with mobile app to register assets. Generated ${new Date().toLocaleString()}
        </p>
        <div>${items}</div>
      </body>
    </html>`)
  win.document.close()
  win.print()
}

function printAssetQR(asset: Asset) {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(`
    <html>
      <head><title>QR - ${asset.name}</title></head>
      <body style="text-align:center;font-family:sans-serif;padding:32px">
        <h2>${asset.name}</h2>
        <p style="color:#666">${asset.assetNumber} · ${asset.type.replace(/_/g, ' ')}</p>
        <p style="color:#666">${asset.site.name}</p>
        <img src="${qrUrl(asset.qrUuid, 200)}" style="margin:16px auto;display:block"/>
        <p style="font-size:11px;color:#999;word-break:break-all">${asset.qrUuid}</p>
      </body>
    </html>`)
  win.document.close()
  win.print()
}

// ═══════════════════════════════════════════════════════════════════════════════

export default function QRCodesPage() {
  const { selectedSiteId } = useSiteStore()

  // Existing assets
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  // Generated (new) QRs
  const [generatedQRs, setGeneratedQRs] = useState<GeneratedQR[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [generateCount, setGenerateCount] = useState(1)

  const fetchAssets = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string | number> = { limit: 200 }
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
    ? assets.filter(
        (a) =>
          a.name.toLowerCase().includes(search.toLowerCase()) ||
          (a.assetNumber ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : assets

  // ── Generate new QR(s) ───────────────────────────────────────────────────
  const handleGenerate = () => {
    const count = Math.min(Math.max(1, generateCount), 20)
    const newItems: GeneratedQR[] = Array.from({ length: count }, (_, i) => ({
      uuid: generateUUID(),
      createdAt: new Date(),
      label: count === 1 ? newLabel : newLabel ? `${newLabel} ${i + 1}` : '',
    }))
    setGeneratedQRs((prev) => [...newItems, ...prev])
    setNewLabel('')
  }

  const removeGenerated = (uuid: string) =>
    setGeneratedQRs((prev) => prev.filter((q) => q.uuid !== uuid))

  const clearAll = () => setGeneratedQRs([])

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div>
      <PageHeader
        title="QR Codes"
        description="Generate new QR tags and manage existing asset codes"
        breadcrumbs={[{ label: 'QR Codes' }]}
      />

      <div className="p-6 space-y-8">

        {/* ── SECTION 1: Generator ── */}
        <Card className="border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              Generate New QR Codes
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Generate blank QR tags to print and attach to new assets. The mobile app will prompt registration when scanned.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Controls */}
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Label (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Chiller Unit, AHU..."
                  className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-56"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary w-20"
                  value={generateCount}
                  onChange={(e) => setGenerateCount(Number(e.target.value))}
                />
              </div>
              <Button onClick={handleGenerate} className="gap-2">
                <Plus className="h-4 w-4" /> Generate
              </Button>
              {generatedQRs.length > 0 && (
                <>
                  <Button
                    variant="outline"
                    className="gap-2"
                    onClick={() => printGeneratedQRs(generatedQRs)}
                  >
                    <Printer className="h-4 w-4" /> Print All ({generatedQRs.length})
                  </Button>
                  <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={clearAll}>
                    Clear All
                  </Button>
                </>
              )}
            </div>

            {/* Generated QR grid */}
            {generatedQRs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 gap-2">
                <QrCode className="h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">No QR codes generated yet</p>
                <p className="text-xs text-muted-foreground">Click Generate to create new QR tags</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                {generatedQRs.map((qr) => (
                  <div
                    key={qr.uuid}
                    className="relative flex flex-col items-center rounded-lg border bg-muted/20 p-3 gap-2 text-center group"
                  >
                    {/* Remove button */}
                    <button
                      onClick={() => removeGenerated(qr.uuid)}
                      className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>

                    <img
                      src={qrUrl(qr.uuid)}
                      alt="Generated QR"
                      className="rounded w-24 h-24"
                    />

                    <div className="w-full">
                      {qr.label && (
                        <p className="text-xs font-semibold truncate">{qr.label}</p>
                      )}
                      <p className="text-[9px] text-muted-foreground break-all leading-tight mt-0.5">
                        {qr.uuid.slice(0, 18)}…
                      </p>
                      <span className="inline-block mt-1 text-[9px] bg-yellow-100 text-yellow-800 rounded-full px-2 py-0.5 font-medium">
                        Unregistered
                      </span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs h-7"
                      onClick={() => printGeneratedQRs([qr])}
                    >
                      <Printer className="h-3 w-3 mr-1" /> Print
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── SECTION 2: Existing Assets ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Registered Asset QR Codes
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Reprint QR tags for existing assets
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{filtered.length} assets</span>
          </div>

          {/* Search */}
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or asset number…"
              className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <PageLoader />
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No assets found</div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filtered.map((asset) => (
                <Card key={asset.id} className="overflow-hidden">
                  <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                    <img
                      src={qrUrl(asset.qrUuid, 120)}
                      alt={`QR for ${asset.name}`}
                      className="rounded"
                      loading="lazy"
                    />
                    <div className="w-full">
                      <p className="font-semibold text-sm leading-tight truncate">{asset.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{asset.assetNumber}</p>
                      <p className="text-xs text-muted-foreground">{asset.type.replace(/_/g, ' ')}</p>
                      <p className="text-xs text-muted-foreground">{asset.site.name}</p>
                      <div className="mt-2">
                        <StatusBadge status={asset.status} />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => printAssetQR(asset)}
                    >
                      <Printer className="h-3 w-3 mr-1" /> Print QR
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
