/// <reference types="vite/client" />
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/status-badge'
import { useSiteStore } from '@/store'
import { Asset } from '@/types'
import api from '@/lib/api'

type CesiumType = any

const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0OTBhNmJmNy00MTU1LTQxNGEtYTZhMy02OGMzMDhkZTcxMDgiLCJpZCI6NDE3NTIxLCJpYXQiOjE3NzYwNzkwMzF9.c0Ii0L5KEryd-n6KKgjnR2mHjT2BrHmd5d3QUVrUXfQ'

const STATUS_COLORS = {
  OPERATIONAL:       '#22c55e',
  NEEDS_MAINTENANCE: '#eab308',
  OUT_OF_SERVICE:    '#ef4444',
}

const TOWER_CENTER = { lon: 46.6753, lat: 24.6896 }
const NRR_CENTER   = { lon: 46.6800, lat: 24.6920 }

export default function MapPage() {
  const cesiumContainer = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<any>(null)
  const { selectedSiteId } = useSiteStore()
  const navigate = useNavigate()
  const [assets, setAssets] = useState<Asset[]>([])
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [cesiumLoaded, setCesiumLoaded] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    const params: Record<string, string> = { limit: '200' }
    if (selectedSiteId) params.siteId = selectedSiteId
    api.get('/assets', { params }).then(res => setAssets(res.data.data))
  }, [selectedSiteId])

  useEffect(() => {
    if ((window as any).Cesium) { setCesiumLoaded(true); return }

    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Widgets/widgets.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Cesium.js'
    script.onload = () => setCesiumLoaded(true)
    document.head.appendChild(script)
  }, [])

  useEffect(() => {
    if (!cesiumLoaded || !cesiumContainer.current || viewerRef.current) return

    const Cesium: CesiumType = (window as any).Cesium
    Cesium.Ion.defaultAccessToken = CESIUM_TOKEN

    const viewer = new Cesium.Viewer(cesiumContainer.current, {
      baseLayerPicker:      false,
      geocoder:             false,
      homeButton:           false,
      sceneModePicker:      false,
      navigationHelpButton: false,
      animation:            false,
      timeline:             false,
      fullscreenButton:     false,
      infoBox:              false,
      selectionIndicator:   false,
      terrain: Cesium.Terrain.fromWorldTerrain(),
    })

    viewerRef.current = viewer
    viewer.scene.globe.enableLighting = true

    // OSM 3D Buildings
    Cesium.createOsmBuildingsAsync().then((osmBuildings: unknown) => {
      viewer.scene.primitives.add(osmBuildings)
      setMapReady(true)
    }).catch(() => setMapReady(true))

    // Fly to Bank Tower
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(TOWER_CENTER.lon, TOWER_CENTER.lat, 600),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch:   Cesium.Math.toRadians(-35),
        roll:    0,
      },
      duration: 2,
    })

    // Asset pins
    assets.forEach((asset, idx) => {
      const center = asset.site?.name?.includes('NRR') ? NRR_CENTER : TOWER_CENTER
      const angle  = (idx / Math.max(assets.length, 1)) * 2 * Math.PI
      const radius = 0.0008
      const lon    = center.lon + radius * Math.cos(angle)
      const lat    = center.lat + radius * Math.sin(angle)
      const color  = STATUS_COLORS[asset.status as keyof typeof STATUS_COLORS] ?? '#888'

      viewer.entities.add({
        id: asset.id,
        name: asset.name,
        position: Cesium.Cartesian3.fromDegrees(lon, lat, 10),
        billboard: {
          image: createPinSvg(color),
          width: 36,
          height: 36,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text:            asset.name,
          font:            '12px sans-serif',
          pixelOffset:     new Cesium.Cartesian2(0, -40),
          fillColor:       Cesium.Color.WHITE,
          outlineColor:    Cesium.Color.BLACK,
          outlineWidth:    2,
          style:           Cesium.LabelStyle.FILL_AND_OUTLINE,
          showBackground:  true,
          backgroundColor: new Cesium.Color(0, 0, 0, 0.65),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          scaleByDistance: new Cesium.NearFarScalar(100, 1.0, 2000, 0.4),
        },
      })
    })

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
    handler.setInputAction((click: { position: unknown }) => {
      const picked = viewer.scene.pick(click.position)
      if (Cesium.defined(picked) && picked.id) {
        const found = assets.find((a: Asset) => a.id === picked.id.id)
        if (found) setSelectedAsset(found)
      } else {
        setSelectedAsset(null)
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

    return () => {
      handler.destroy()
      viewer.destroy()
      viewerRef.current = null
    }
  }, [cesiumLoaded, assets])

  return (
    <div className="flex flex-col h-full">
      <PageHeader
        title="Site Map"
        description="Bank Tower & NRR IT Hub — King Fahd Road, Riyadh"
        breadcrumbs={[{ label: 'Site Map' }]}
      />

      <div className="relative flex-1 overflow-hidden">
        <div ref={cesiumContainer} className="absolute inset-0" />

        {/* Legend */}
        <div className="absolute top-4 left-4 z-10">
          <Card className="shadow-lg">
            <CardContent className="p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Legend</p>
              {[
                { color: STATUS_COLORS.OPERATIONAL,       label: 'Operational' },
                { color: STATUS_COLORS.NEEDS_MAINTENANCE, label: 'Needs Maintenance' },
                { color: STATUS_COLORS.OUT_OF_SERVICE,    label: 'Out of Service' },
              ].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs">{label}</span>
                </div>
              ))}
              <div className="pt-1 border-t border-border">
                <p className="text-xs text-muted-foreground">Click a pin for details</p>
              </div>
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
                  <button onClick={() => setSelectedAsset(null)} className="text-muted-foreground hover:text-foreground text-lg leading-none ml-2">×</button>
                </div>
                <div className="space-y-1.5 text-xs text-muted-foreground mb-3">
                  <p><span className="font-medium text-foreground">Asset #:</span> {selectedAsset.assetNumber}</p>
                  <p><span className="font-medium text-foreground">Location:</span> {[selectedAsset.building, selectedAsset.floor, selectedAsset.zone].filter(Boolean).join(' · ')}</p>
                  <p><span className="font-medium text-foreground">Site:</span> {selectedAsset.site.name}</p>
                </div>
                <div className="flex items-center justify-between">
                  <StatusBadge status={selectedAsset.status} />
                  <button onClick={() => navigate(`/assets/${selectedAsset.id}`)} className="text-xs text-primary hover:underline font-medium">
                    View details →
                  </button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Loading */}
        {(!cesiumLoaded || !mapReady) && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/90 z-20">
            <div className="text-center">
              <div className="animate-spin rounded-full border-2 border-muted border-t-primary h-10 w-10 mx-auto mb-3" />
              <p className="text-sm font-medium">Loading 3D map…</p>
              <p className="text-xs text-muted-foreground mt-1">Bank Tower · Riyadh, KSA</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function createPinSvg(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">
    <circle cx="18" cy="15" r="12" fill="${color}" stroke="white" stroke-width="2.5"/>
    <polygon points="18,34 11,23 25,23" fill="${color}"/>
    <circle cx="18" cy="15" r="5" fill="white" opacity="0.9"/>
  </svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}