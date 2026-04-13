import React, { useMemo, useState } from "react"
import { Canvas } from "@react-three/fiber"
import { OrbitControls, Html, Line } from "@react-three/drei"

type AssetType =
  | "Chiller"
  | "AHU"
  | "Elevator"
  | "Electrical"
  | "Generator"
  | "Fire Pump"
  | "FCU"
  | "UPS"
  | "CRAC"

type AssetStatus = "OPERATIONAL" | "SCHEDULED_TASK" | "CRITICAL_ALERT"

type Asset = {
  id: string
  name: string
  type: AssetType
  status: AssetStatus
  floor: number
  zone: string
  building: string
  shaftIndex: number
}

const FLOORS = 12
const FLOOR_H = 2.9
const W = 6.4
const D = 4.4
const H = FLOORS * FLOOR_H

const BG = "#020816"
const CYAN = "#9efcff"

const STATUS_COLORS: Record<AssetStatus, string> = {
  OPERATIONAL: "#23d3b1",
  SCHEDULED_TASK: "#f0b233",
  CRITICAL_ALERT: "#ff6a63",
}

const ASSET_TYPES: ("All" | AssetType)[] = [
  "All",
  "Chiller",
  "AHU",
  "Elevator",
  "Electrical",
  "Generator",
  "Fire Pump",
  "FCU",
  "UPS",
  "CRAC",
]

const shafts = [
  { x: -1.15, z: -0.72, r: 0.22, ring: 0.54 },
  { x: 1.05, z: -0.72, r: 0.22, ring: 0.54 },
  { x: -1.15, z: 0.72, r: 0.22, ring: 0.54 },
  { x: 1.05, z: 0.72, r: 0.22, ring: 0.54 },
]

function makeAssets(): Asset[] {
  const types: AssetType[] = [
    "FCU",
    "AHU",
    "Chiller",
    "UPS",
    "CRAC",
    "Electrical",
    "Generator",
    "Fire Pump",
    "Elevator",
  ]

  const assets: Asset[] = []

  for (let floor = 1; floor <= FLOORS; floor++) {
    for (let shaftIndex = 0; shaftIndex < shafts.length; shaftIndex++) {
      const type = types[(floor + shaftIndex) % types.length]
      let status: AssetStatus = "OPERATIONAL"

      if (shaftIndex === 0 && floor % 2 === 0) status = "CRITICAL_ALERT"
      else if (shaftIndex === 1 && floor % 3 === 1) status = "SCHEDULED_TASK"
      else if (shaftIndex === 3 && floor % 4 === 0) status = "SCHEDULED_TASK"

      assets.push({
        id: `${floor}-${shaftIndex}`,
        name: `${floor}F East ${type}-${String(shaftIndex + 1).padStart(2, "0")}`,
        type,
        status,
        floor,
        zone: `East ${floor} E0${shaftIndex + 1}`,
        building: "Tower",
        shaftIndex,
      })
    }
  }

  return assets
}

function Edge({
  a,
  b,
  color = CYAN,
  opacity = 0.72,
  width = 1,
}: {
  a: [number, number, number]
  b: [number, number, number]
  color?: string
  opacity?: number
  width?: number
}) {
  return (
    <Line
      points={[a, b]}
      color={color}
      transparent
      opacity={opacity}
      lineWidth={width}
    />
  )
}

function OuterFrame() {
  const hw = W / 2
  const hd = D / 2

  return (
    <>
      <Edge a={[-hw, 0, -hd]} b={[hw, 0, -hd]} />
      <Edge a={[hw, 0, -hd]} b={[hw, 0, hd]} />
      <Edge a={[hw, 0, hd]} b={[-hw, 0, hd]} />
      <Edge a={[-hw, 0, hd]} b={[-hw, 0, -hd]} />

      <Edge a={[-hw, H, -hd]} b={[hw, H, -hd]} />
      <Edge a={[hw, H, -hd]} b={[hw, H, hd]} />
      <Edge a={[hw, H, hd]} b={[-hw, H, hd]} />
      <Edge a={[-hw, H, hd]} b={[-hw, H, -hd]} />

      <Edge a={[-hw, 0, -hd]} b={[-hw, H, -hd]} />
      <Edge a={[hw, 0, -hd]} b={[hw, H, -hd]} />
      <Edge a={[-hw, 0, hd]} b={[-hw, H, hd]} />
      <Edge a={[hw, 0, hd]} b={[hw, H, hd]} />
    </>
  )
}

function FloorFrames() {
  const hw = W / 2
  const hd = D / 2

  return (
    <>
      {Array.from({ length: FLOORS + 1 }).map((_, i) => {
        const y = i * FLOOR_H
        return (
          <group key={i}>
            <Edge a={[-hw, y, -hd]} b={[hw, y, -hd]} opacity={0.95} />
            <Edge a={[hw, y, -hd]} b={[hw, y, hd]} opacity={0.95} />
            <Edge a={[hw, y, hd]} b={[-hw, y, hd]} opacity={0.95} />
            <Edge a={[-hw, y, hd]} b={[-hw, y, -hd]} opacity={0.95} />
          </group>
        )
      })}
    </>
  )
}

function VerticalFaceGrid() {
  const hw = W / 2
  const hd = D / 2
  const xs = [-2.45, -1.65, -0.85, 0, 0.85, 1.65, 2.45]
  const zs = [-1.45, -0.72, 0, 0.72, 1.45]

  return (
    <>
      {xs.map((x) => (
        <group key={`x-${x}`}>
          <Edge a={[x, 0, -hd]} b={[x, H, -hd]} opacity={0.24} width={0.8} />
          <Edge a={[x, 0, hd]} b={[x, H, hd]} opacity={0.24} width={0.8} />
        </group>
      ))}
      {zs.map((z) => (
        <group key={`z-${z}`}>
          <Edge a={[-hw, 0, z]} b={[-hw, H, z]} opacity={0.24} width={0.8} />
          <Edge a={[hw, 0, z]} b={[hw, H, z]} opacity={0.24} width={0.8} />
        </group>
      ))}
    </>
  )
}

function SideBracing() {
  const hw = W / 2
  const hd = D / 2

  return (
    <>
      {Array.from({ length: FLOORS }).map((_, i) => {
        const y0 = i * FLOOR_H
        const y1 = (i + 1) * FLOOR_H
        return (
          <group key={i}>
            <Edge a={[-hw, y0, -hd]} b={[-hw, y1, hd]} opacity={0.16} width={0.8} />
            <Edge a={[-hw, y0, hd]} b={[-hw, y1, -hd]} opacity={0.16} width={0.8} />
            <Edge a={[hw, y0, -hd]} b={[hw, y1, hd]} opacity={0.16} width={0.8} />
            <Edge a={[hw, y0, hd]} b={[hw, y1, -hd]} opacity={0.16} width={0.8} />
          </group>
        )
      })}
    </>
  )
}

function Shafts() {
  return (
    <>
      {shafts.map((s, i) => (
        <mesh key={i} position={[s.x, H / 2, s.z]}>
          <cylinderGeometry args={[s.r, s.r, H, 28]} />
          <meshBasicMaterial color="#0b0f14" />
        </mesh>
      ))}
    </>
  )
}

function Arc({
  x,
  y,
  z,
  radius,
  color,
  start,
  end,
}: {
  x: number
  y: number
  z: number
  radius: number
  color: string
  start: number
  end: number
}) {
  const pts: [number, number, number][] = []
  const seg = 64

  for (let i = 0; i <= seg; i++) {
    const t = start + ((end - start) * i) / seg
    pts.push([Math.cos(t) * radius, 0, Math.sin(t) * radius])
  }

  return (
    <group position={[x, y, z]} rotation={[Math.PI / 2, 0, 0]}>
      <Line
        points={pts}
        color={color}
        transparent
        opacity={0.98}
        lineWidth={2.6}
      />
    </group>
  )
}

function AssetNode({
  asset,
  selected,
  onSelect,
}: {
  asset: Asset
  selected: boolean
  onSelect: (asset: Asset) => void
}) {
  const shaft = shafts[asset.shaftIndex]
  const y = (asset.floor - 1) * FLOOR_H + 0.64
  const color = STATUS_COLORS[asset.status]

  const start = asset.shaftIndex % 2 === 0 ? 0.82 : 1.08
  const end = asset.shaftIndex % 2 === 0 ? 5.12 : 5.38

  return (
    <group position={[shaft.x, y, shaft.z]}>
      <Arc
        x={0}
        y={0}
        z={0}
        radius={shaft.ring}
        color={color}
        start={start}
        end={end}
      />

      <mesh
        position={[0.27, 0.18, 0]}
        onClick={(e) => {
          e.stopPropagation()
          onSelect(asset)
        }}
        onPointerOver={(e) => {
          e.stopPropagation()
          document.body.style.cursor = "pointer"
        }}
        onPointerOut={() => {
          document.body.style.cursor = "default"
        }}
      >
        <sphereGeometry args={[0.07, 14, 14]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {selected && (
        <Html position={[0.95, 1.1, 0]} center>
          <div className="min-w-[180px] rounded-2xl border border-cyan-500/20 bg-[#0b1226]/95 px-4 py-3 text-white shadow-2xl backdrop-blur-md">
            <div className="text-[12px] font-semibold text-white">{asset.name}</div>
            <div className="mt-1 text-[11px] tracking-[0.25em] text-cyan-300 uppercase">
              {asset.type}
            </div>
            <div className="mt-2 flex items-center gap-2 text-[12px]">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-slate-300">
                {asset.status === "OPERATIONAL"
                  ? "Operational"
                  : asset.status === "SCHEDULED_TASK"
                  ? "Scheduled Task"
                  : "Critical Alert"}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-slate-400">
              {asset.floor}F · {asset.zone}
            </div>
          </div>
        </Html>
      )}
    </group>
  )
}

function Building3D({
  assets,
  selectedAsset,
  onSelectAsset,
}: {
  assets: Asset[]
  selectedAsset: Asset | null
  onSelectAsset: (asset: Asset | null) => void
}) {
  return (
    <group onClick={() => onSelectAsset(null)}>
      <OuterFrame />
      <FloorFrames />
      <VerticalFaceGrid />
      <SideBracing />
      <Shafts />
      {assets.map((asset) => (
        <AssetNode
          key={asset.id}
          asset={asset}
          selected={selectedAsset?.id === asset.id}
          onSelect={onSelectAsset}
        />
      ))}
    </group>
  )
}

function GroundGrid() {
  return (
    <gridHelper
      args={[120, 120, "#0b5a66", "#0b5a66"]}
      position={[0, -0.01, 0]}
    />
  )
}

export default function DigitalTwinPage() {
  const [activeType, setActiveType] = useState<"All" | AssetType>("All")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "ALL">("ALL")
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)

  const [layers, setLayers] = useState({
    workOrders: false,
    reports: true,
    maintenance: false,
    floorHealth: false,
    insights: false,
  })

  const allAssets = useMemo(() => makeAssets(), [])

  const filteredAssets = useMemo(() => {
    return allAssets.filter((asset) => {
      const typeOk = activeType === "All" || asset.type === activeType
      const statusOk = statusFilter === "ALL" || asset.status === statusFilter
      const searchOk =
        !search.trim() ||
        asset.name.toLowerCase().includes(search.toLowerCase()) ||
        asset.type.toLowerCase().includes(search.toLowerCase()) ||
        asset.zone.toLowerCase().includes(search.toLowerCase())

      return typeOk && statusOk && searchOk
    })
  }, [allAssets, activeType, statusFilter, search])

  const buildingStatusCounts = useMemo(() => {
    return {
      ok: filteredAssets.filter((a) => a.status === "OPERATIONAL").length,
      warn: filteredAssets.filter((a) => a.status === "SCHEDULED_TASK").length,
      err: filteredAssets.filter((a) => a.status === "CRITICAL_ALERT").length,
    }
  }, [filteredAssets])

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#020816] text-white">
      <div className="absolute inset-0">
        <Canvas camera={{ position: [14, 14, 14], fov: 30 }}>
          <color attach="background" args={[BG]} />
          <ambientLight intensity={1} />
          <GroundGrid />
          <Building3D
            assets={filteredAssets}
            selectedAsset={selectedAsset}
            onSelectAsset={setSelectedAsset}
          />
          <OrbitControls
            enablePan
            enableZoom
            enableRotate
            target={[0, H * 0.48, 0]}
            minDistance={3}
            maxDistance={80}
            minPolarAngle={0.1}
            maxPolarAngle={Math.PI - 0.1}
            panSpeed={1.2}
            zoomSpeed={1.2}
            rotateSpeed={0.8}
          />
        </Canvas>
      </div>

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-6 right-6 top-4 rounded-2xl border border-cyan-500/10 bg-[#081127]/90 px-5 py-4 shadow-2xl backdrop-blur-md">
          <div className="flex flex-wrap items-center gap-5">
            <div className="text-[12px] font-semibold tracking-[0.25em] text-slate-400 uppercase">
              By Asset Type
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {ASSET_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    activeType === type
                      ? "bg-emerald-500 text-white"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-4">
              <div className="text-[12px] font-semibold tracking-[0.25em] text-slate-400 uppercase">
                By Status
              </div>

              <button
                onClick={() => setStatusFilter("OPERATIONAL")}
                className={`h-8 w-8 rounded-full border ${
                  statusFilter === "OPERATIONAL"
                    ? "border-emerald-400 bg-emerald-500/15"
                    : "border-slate-600 bg-transparent"
                }`}
                title="Operational"
              >
                ✓
              </button>

              <button
                onClick={() => setStatusFilter("SCHEDULED_TASK")}
                className={`h-8 w-8 rounded-full border ${
                  statusFilter === "SCHEDULED_TASK"
                    ? "border-yellow-400 bg-yellow-500/15"
                    : "border-slate-600 bg-transparent"
                }`}
                title="Scheduled Task"
              >
                △
              </button>

              <button
                onClick={() => setStatusFilter("CRITICAL_ALERT")}
                className={`h-8 w-8 rounded-full border ${
                  statusFilter === "CRITICAL_ALERT"
                    ? "border-red-400 bg-red-500/15"
                    : "border-slate-600 bg-transparent"
                }`}
                title="Critical Alert"
              >
                ⊗
              </button>

              <button
                onClick={() => setStatusFilter("ALL")}
                className="rounded-full border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:text-white"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto absolute left-6 top-24 w-[310px]">
          <div className="rounded-2xl border border-cyan-500/10 bg-[#081127]/90 p-3 shadow-2xl backdrop-blur-md">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets..."
              className="w-full rounded-xl border border-cyan-500/10 bg-[#0b1630] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-500/10 bg-[#081127]/90 p-3 shadow-2xl backdrop-blur-md">
            <div className="mb-3 flex items-center gap-2">
              {["👁", "↑", "←", "→", "⤢"].map((icon, i) => (
                <button
                  key={i}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                    i === 0
                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-300"
                      : "border-slate-700 bg-[#0b1630] text-slate-400"
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>

            <div className="rounded-2xl border border-cyan-500/10 bg-[#0b1630] p-4">
              <div className="mb-4 text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">
                Building Status
              </div>

              <div className="space-y-3 text-lg">
                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-full bg-emerald-400" />
                  <span className="text-white">All Clear</span>
                  <span className="ml-auto text-slate-400">{buildingStatusCounts.ok}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-full bg-yellow-400" />
                  <span className="text-white">Scheduled Task</span>
                  <span className="ml-auto text-slate-400">{buildingStatusCounts.warn}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="h-3.5 w-3.5 rounded-full bg-red-400" />
                  <span className="text-white">Critical Alert</span>
                  <span className="ml-auto text-slate-400">{buildingStatusCounts.err}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto absolute right-6 top-24 w-[220px] rounded-2xl border border-cyan-500/10 bg-[#081127]/90 p-4 shadow-2xl backdrop-blur-md">
          <div className="mb-4 text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">
            Layers
          </div>

          <div className="space-y-2">
            {[
              { key: "workOrders", label: "Work Orders" },
              { key: "reports", label: "Reports" },
              { key: "maintenance", label: "Today's Maint." },
              { key: "floorHealth", label: "Floor Health" },
              { key: "insights", label: "Insights" },
            ].map((item) => {
              const active = layers[item.key as keyof typeof layers]

              return (
                <button
                  key={item.key}
                  onClick={() =>
                    setLayers((prev) => ({
                      ...prev,
                      [item.key]: !prev[item.key as keyof typeof prev],
                    }))
                  }
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition ${
                    active
                      ? "bg-red-500/15 text-red-300"
                      : "bg-transparent text-slate-400 hover:bg-white/5"
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      active ? "bg-red-400" : "bg-slate-700"
                    }`}
                  />
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}