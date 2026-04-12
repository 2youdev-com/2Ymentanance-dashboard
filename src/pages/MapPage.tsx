import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { useSiteStore } from '@/store'
import { Asset } from '@/types'
import api from '@/lib/api'

declare global {
  interface Window {
    Cesium: typeof import('cesium')
  }
}

const STATUS_COLORS = {
  OPERATIONAL: '#22c55e',
  NEEDS_MAINTENANCE: '#eab308',
  OUT_OF_SERVICE: '#ef4444',
}

// Approximate coordinates for Bank Tower Riyadh
const TOWER_CENTER = { lon: 46.6753, lat: 24.6896, height: 0 }
const NRR_CENTER = { lon: 46.6800, lat: 24.6920, height: 0 }

export default function MapPage() {
  const cesiumContainer = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<unknown>(null)
  const { selectedSiteId } = useSiteStore()
  const navigate = useNavigate()
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [cesiumLoaded, setCesiumLoaded] = useState(false)

  // Load assets
  useEffect(() => {
    const params: Record<string, string> = { limit: '200' }
    if (selectedSiteId) params.siteId = selectedSiteId
    api.get('/assets', { params }).then(res => setAssets(res.data.data))
  }, [selectedSiteId])

  // Load CesiumJS from CDN
  useEffect(() => {
    if (window.Cesium) { setCesiumLoaded(true); return }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Widgets/widgets.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Cesium.js'
    script.onload = () => setCesiumLoaded(true)
    document.head.appendChild(script)
  }, [])

  // Init viewer
  useEffect(() => {
    if (!cesiumLoaded || !cesiumContainer.current || viewerRef.current) return

    const Cesium = window.Cesium
    Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo'

    const viewer = new Cesium.Viewer(cesiumContainer.current, {
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      animation: false,
      timeline: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
    })

    viewerRef.current = viewer

    // Fly to Riyadh
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(TOWER_CENTER.lon, TOWER_CENTER.lat, 800),
      orientation: { pitch: Cesium.Math.toRadians(-45) },
    })

    // Add asset pins
    assets.forEach((asset) => {
      const center = asset.site.name.includes('NRR') ? NRR_CENTER : TOWER_CENTER
      // Spread pins around the center based on asset index
      const idx = assets.indexOf(asset)
      const angle = (idx / assets.length) * 2 * Math.PI
      const radius = 0.001
      const lon = center.lon + radius * Math.cos(angle)
      const lat = center.lat + radius * Math.sin(angle)

      const color = STATUS_COLORS[asset.status] || '#888'

      viewer.entities.add({
        id: asset.id,
        name: asset.name,
        position: Cesium.Cartesian3.fromDegrees(lon, lat),
        billboard: {
          image: createPinSvg(color),
          width: 32,
          height: 32,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        },
        label: {
          text: asset.name,
          font: '11px sans-serif',
          pixelOffset: new Cesium.Cartesian2(0, -36),
          fillColor: Cesium.Color.WHITE,
          outlineColor: Cesium.Color.BLACK,
          outlineWidth: 2,
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.6),
        },
      })
    })

    // Click handler
    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((click: { position: unknown }) => {
      const picked = viewer.scene.pick(click.position as Cesium.Cartesian2)
      if (Cesium.defined(picked) && picked.id) {
        const found = assets.find(a => a.id === picked.id.id)
        if (found) setSelectedAsset(found)
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      handler.destroy()
      viewer.destroy()
      viewerRef.current = null
    }
  }, [cesiumLoaded, assets, navigate])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Site Map"
        description="Asset locations across Bank Tower and NRR IT Hub"
        breadcrumbs={[{ label: 'Site Map' }]}
      />

      <div className="relative flex-1 overflow-hidden">
        {/* Cesium container */}
        <div ref={cesiumContainer} className="absolute inset-0" />

        {/* Legend */}
        <div className="absolute top-4 left-4 z-10">
          <Card className="shadow-lg">
            <CardContent className="p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Legend</p>
              {[
                { color: STATUS_COLORS.OPERATIONAL, label: 'Operational' },
                { color: STATUS_COLORS.NEEDS_MAINTENANCE, label: 'Needs Maintenance' },
                { color: STATUS_COLORS.OUT_OF_SERVICE, label: 'Out of Service' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs">{label}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Selected asset popup */}
        {selectedAsset && (
          <div className="absolute bottom-4 right-4 z-10 w-72">
            <Card className="shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-sm">{selectedAsset.name}</p>
                    <p className="text-xs text-muted-foreground">{selectedAsset.type.replace(/_/g, ' ')}</p>
                  </div>
                  <button
                    onClick={() => setSelectedAsset(null)}
                    className="text-muted-foreground hover:text-foreground text-lg leading-none"
                  >×</button>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                  <p>Asset #: {selectedAsset.assetNumber}</p>
                  <p>Location: {[selectedAsset.building, selectedAsset.floor, selectedAsset.zone].filter(Boolean).join(' · ')}</p>
                  <p>Site: {selectedAsset.site.name}</p>
                </div>
                <div className="flex items-center justify-between">
                  <StatusBadge status={selectedAsset.status} />
                  <button
                    onClick={() => navigate(`/assets/${selectedAsset.id}`)}
                    className="text-xs text-primary hover:underline font-medium"
                  >
                    View details →
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading overlay */}
        {!cesiumLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80 z-20">
            <div className="text-center">
              <div className="animate-spin rounded-full border-2 border-muted border-t-primary h-10 w-10 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading map…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function createPinSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="14" r="10" fill="${color}" stroke="white" stroke-width="2"/>
    <polygon points="16,28 10,20 22,20" fill="${color}"/>
    <circle cx="16" cy="14" r="4" fill="white" opacity="0.8"/>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}
