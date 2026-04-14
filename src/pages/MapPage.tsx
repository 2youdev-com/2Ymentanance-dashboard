"use client"

import React, { useEffect, useMemo, useRef, useState } from "react"
import { Canvas, useFrame, useThree } from "@react-three/fiber"
import { Html, OrbitControls, RoundedBox, Text } from "@react-three/drei"
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib"
import * as THREE from "three"
import { PageLoader } from "@/components/ui/spinner"
import { useSiteStore } from "@/store"
import api from "@/lib/api"

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
  slotIndex: number
  x: number
  z: number
}

type ApiAsset = {
  id: string
  name: string
  type: string
  status: string
  floor?: string | number | null
  zone?: string | null
  building?: string | null
}

type CameraView = "default" | "top" | "left" | "right" | "fit"

const FLOORS = 12
const FLOOR_GAP = 2.75

const TOWER_W = 11.6
const TOWER_D = 7.6
const TOWER_H = (FLOORS - 1) * FLOOR_GAP + 1.9
const PODIUM_W = 14.4
const PODIUM_D = 10.4
const PODIUM_H = 1.2
const CORE_W = 2.15
const CORE_D = 1.7

const BG = "#04111d"

const STATUS_COLORS: Record<AssetStatus, string> = {
  OPERATIONAL: "#36d399",
  SCHEDULED_TASK: "#f4b740",
  CRITICAL_ALERT: "#ff6b6b",
}

const STATUS_LABELS: Record<AssetStatus, string> = {
  OPERATIONAL: "Operational",
  SCHEDULED_TASK: "Scheduled Task",
  CRITICAL_ALERT: "Critical Alert",
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

const FLOOR_SLOTS = [
  { x: -3.5, z: -2.1 },
  { x: -1.15, z: -2.1 },
  { x: 1.15, z: -2.1 },
  { x: 3.5, z: -2.1 },
  { x: -3.5, z: 0 },
  { x: -1.15, z: 0 },
  { x: 1.15, z: 0 },
  { x: 3.5, z: 0 },
  { x: -3.5, z: 2.1 },
  { x: -1.15, z: 2.1 },
  { x: 1.15, z: 2.1 },
  { x: 3.5, z: 2.1 },
]

function mapApiStatus(status: string): AssetStatus {
  if (status === "OPERATIONAL") return "OPERATIONAL"
  if (status === "NEEDS_MAINTENANCE") return "SCHEDULED_TASK"
  if (status === "OUT_OF_SERVICE") return "CRITICAL_ALERT"
  return "OPERATIONAL"
}

function mapApiType(type: string): AssetType {
  switch (type) {
    case "CHILLER":
      return "Chiller"
    case "AHU":
      return "AHU"
    case "ELEVATOR":
      return "Elevator"
    case "ELECTRICAL_PANEL":
    case "POWER_DISTRIBUTION":
    case "AUTO_TRANSFER_SWITCH":
    case "FIRE_SUPPRESSION":
      return "Electrical"
    case "GENERATOR":
      return "Generator"
    case "FIRE_PUMP":
      return "Fire Pump"
    case "FCU":
      return "FCU"
    case "UPS":
      return "UPS"
    case "PRECISION_COOLING":
      return "CRAC"
    default:
      return "Electrical"
  }
}

function parseFloorValue(floor: string | number | null | undefined): number {
  if (typeof floor === "number" && !Number.isNaN(floor)) {
    return Math.min(Math.max(Math.floor(floor), 1), FLOORS)
  }

  if (!floor) return 1

  const value = String(floor).toLowerCase().trim()

  if (value.includes("ground")) return 1
  if (value.includes("basement")) return 1
  if (value.includes("roof")) return FLOORS

  const match = value.match(/\d+/)
  if (match) {
    const num = Number(match[0])
    if (!Number.isNaN(num)) {
      return Math.min(Math.max(num, 1), FLOORS)
    }
  }

  return 1
}

function mapAssetsFromApi(apiAssets: ApiAsset[]): Asset[] {
  const floorCounters: Record<number, number> = {}

  return [...apiAssets]
    .sort((a, b) => parseFloorValue(a.floor) - parseFloorValue(b.floor))
    .map((asset) => {
      const floorNumber = parseFloorValue(asset.floor)
      const currentCount = floorCounters[floorNumber] ?? 0
      floorCounters[floorNumber] = currentCount + 1

      const slotIndex = currentCount % FLOOR_SLOTS.length
      const slot = FLOOR_SLOTS[slotIndex]

      return {
        id: asset.id,
        name: asset.name,
        type: mapApiType(asset.type),
        status: mapApiStatus(asset.status),
        floor: floorNumber,
        zone: asset.zone || `Zone ${currentCount + 1}`,
        building: asset.building || "Tower",
        slotIndex,
        x: slot.x,
        z: slot.z,
      }
    })
}

function floorY(floor: number) {
  return (floor - 1) * FLOOR_GAP
}

function getCameraPreset(view: CameraView) {
  const centerY = floorY(6)

  switch (view) {
    case "top":
      return {
        position: new THREE.Vector3(0, 52, 0.01),
        target: new THREE.Vector3(0, centerY, 0),
      }
    case "left":
      return {
        position: new THREE.Vector3(-29, centerY + 3, 0),
        target: new THREE.Vector3(0, centerY, 0),
      }
    case "right":
      return {
        position: new THREE.Vector3(29, centerY + 3, 0),
        target: new THREE.Vector3(0, centerY, 0),
      }
    case "fit":
      return {
        position: new THREE.Vector3(34, 24, 32),
        target: new THREE.Vector3(0, centerY, 0),
      }
    default:
      return {
        position: new THREE.Vector3(25, 17, 25),
        target: new THREE.Vector3(0, centerY, 0),
      }
  }
}

function CameraRig({
  view,
  controlsRef,
}: {
  view: CameraView
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  const { camera } = useThree()
  const desiredPosition = useRef(getCameraPreset(view).position.clone())
  const desiredTarget = useRef(getCameraPreset(view).target.clone())
  const isAnimating = useRef(true)

  useEffect(() => {
    const preset = getCameraPreset(view)
    desiredPosition.current.copy(preset.position)
    desiredTarget.current.copy(preset.target)
    isAnimating.current = true
  }, [view])

  useFrame((_, delta) => {
    if (!isAnimating.current) return

    const controls = controlsRef.current
    const lerpAlpha = 1 - Math.exp(-delta * 4.5)

    camera.position.lerp(desiredPosition.current, lerpAlpha)

    if (controls) {
      controls.target.lerp(desiredTarget.current, lerpAlpha)
      controls.update()

      const posDone = camera.position.distanceTo(desiredPosition.current) < 0.08
      const targetDone = controls.target.distanceTo(desiredTarget.current) < 0.08

      if (posDone && targetDone) {
        camera.position.copy(desiredPosition.current)
        controls.target.copy(desiredTarget.current)
        controls.update()
        isAnimating.current = false
      }
    } else {
      camera.lookAt(desiredTarget.current)
      const posDone = camera.position.distanceTo(desiredPosition.current) < 0.08
      if (posDone) {
        camera.position.copy(desiredPosition.current)
        camera.lookAt(desiredTarget.current)
        isAnimating.current = false
      }
    }
  })

  return null
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[14, 24, 14]} intensity={1.18} />
      <directionalLight position={[-10, 12, -12]} intensity={0.24} />
      <pointLight position={[0, TOWER_H + 7, 0]} intensity={0.42} color="#85ffd6" />
      <pointLight position={[0, 10, 10]} intensity={0.22} color="#75d6ff" />
      <pointLight position={[0, 8, -10]} intensity={0.12} color="#8cf8e1" />
    </>
  )
}

function GroundPlane() {
  return (
    <group position={[0, -0.75, 0]} frustumCulled={false}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} frustumCulled={false}>
        <planeGeometry args={[150, 150]} />
        <meshStandardMaterial color="#050b13" roughness={0.95} metalness={0.05} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} frustumCulled={false}>
        <ringGeometry args={[10, 18, 64]} />
        <meshBasicMaterial color="#103447" transparent opacity={0.12} />
      </mesh>
    </group>
  )
}

function Podium() {
  return (
    <group position={[0, PODIUM_H / 2 - 0.55, 0]} frustumCulled={false}>
      <RoundedBox args={[PODIUM_W, PODIUM_H, PODIUM_D]} radius={0.24} smoothness={4}>
        <meshStandardMaterial
          color="#081424"
          roughness={0.5}
          metalness={0.16}
          emissive="#07111d"
          emissiveIntensity={0.4}
        />
      </RoundedBox>

      <mesh position={[0, PODIUM_H / 2 + 0.02, 0]}>
        <boxGeometry args={[PODIUM_W - 0.8, 0.04, PODIUM_D - 0.8]} />
        <meshBasicMaterial color="#1ec8a5" transparent opacity={0.18} />
      </mesh>
    </group>
  )
}

function TowerCore() {
  return (
    <group position={[0, TOWER_H / 2 - 0.15, 0]} frustumCulled={false}>
      <RoundedBox args={[CORE_W, TOWER_H - 0.4, CORE_D]} radius={0.18} smoothness={4}>
        <meshStandardMaterial
          color="#0b1726"
          roughness={0.34}
          metalness={0.3}
          emissive="#0d2336"
          emissiveIntensity={0.35}
        />
      </RoundedBox>

      {Array.from({ length: FLOORS }, (_, i) => {
        const y = floorY(i + 1) - (TOWER_H / 2 - 0.15) + 0.42
        return (
          <mesh key={i} position={[0, y, CORE_D / 2 + 0.02]}>
            <boxGeometry args={[1.1, 0.04, 0.04]} />
            <meshBasicMaterial color="#7ceccf" transparent opacity={0.12} />
          </mesh>
        )
      })}
    </group>
  )
}

function RoofCrown() {
  return (
    <group position={[0, TOWER_H + 0.46, 0]} frustumCulled={false}>
      <RoundedBox args={[TOWER_W + 0.2, 0.34, TOWER_D + 0.2]} radius={0.14} smoothness={4}>
        <meshStandardMaterial
          color="#0b1b2b"
          roughness={0.26}
          metalness={0.34}
          emissive="#0b8f79"
          emissiveIntensity={0.18}
        />
      </RoundedBox>

      <mesh position={[0, 0.03, 0]}>
        <boxGeometry args={[TOWER_W - 0.2, 0.02, TOWER_D - 0.2]} />
        <meshBasicMaterial color="#8ef9d9" transparent opacity={0.28} />
      </mesh>
    </group>
  )
}

function FacadeMullions() {
  const mullionXs = [-4.3, -2.15, 0, 2.15, 4.3]

  return (
    <group position={[0, TOWER_H / 2 - 0.15, 0]} frustumCulled={false}>
      {mullionXs.map((x, i) => (
        <React.Fragment key={`front-${i}`}>
          <mesh position={[x, 0, TOWER_D / 2 + 0.02]}>
            <boxGeometry args={[0.05, TOWER_H - 0.1, 0.05]} />
            <meshBasicMaterial color="#97f4df" transparent opacity={0.16} />
          </mesh>

          <mesh position={[x, 0, -TOWER_D / 2 - 0.02]}>
            <boxGeometry args={[0.05, TOWER_H - 0.1, 0.05]} />
            <meshBasicMaterial color="#97f4df" transparent opacity={0.07} />
          </mesh>
        </React.Fragment>
      ))}

      {[-2.5, 0, 2.5].map((z, i) => (
        <React.Fragment key={`side-${i}`}>
          <mesh position={[TOWER_W / 2 + 0.02, 0, z]}>
            <boxGeometry args={[0.05, TOWER_H - 0.1, 0.05]} />
            <meshBasicMaterial color="#97f4df" transparent opacity={0.08} />
          </mesh>

          <mesh position={[-TOWER_W / 2 - 0.02, 0, z]}>
            <boxGeometry args={[0.05, TOWER_H - 0.1, 0.05]} />
            <meshBasicMaterial color="#97f4df" transparent opacity={0.08} />
          </mesh>
        </React.Fragment>
      ))}
    </group>
  )
}

function TowerShell() {
  const shellHeight = TOWER_H + 0.18
  const sideYOffset = shellHeight / 2 - 0.15

  return (
    <group frustumCulled={false}>
      <group position={[0, sideYOffset, 0]}>
        <mesh position={[-TOWER_W / 2 - 0.05, 0, 0]}>
          <boxGeometry args={[0.12, shellHeight, TOWER_D + 0.15]} />
          <meshPhysicalMaterial
            color="#7fdcc9"
            transparent
            opacity={0.14}
            transmission={0.18}
            roughness={0.06}
            metalness={0.02}
            depthWrite={false}
          />
        </mesh>

        <mesh position={[TOWER_W / 2 + 0.05, 0, 0]}>
          <boxGeometry args={[0.12, shellHeight, TOWER_D + 0.15]} />
          <meshPhysicalMaterial
            color="#7fdcc9"
            transparent
            opacity={0.14}
            transmission={0.18}
            roughness={0.06}
            metalness={0.02}
            depthWrite={false}
          />
        </mesh>

        <mesh position={[0, 0, -TOWER_D / 2 - 0.05]}>
          <boxGeometry args={[TOWER_W + 0.15, shellHeight, 0.12]} />
          <meshPhysicalMaterial
            color="#7fdcc9"
            transparent
            opacity={0.12}
            transmission={0.18}
            roughness={0.06}
            metalness={0.02}
            depthWrite={false}
          />
        </mesh>
      </group>

      <mesh position={[0, TOWER_H + 0.02, 0]}>
        <boxGeometry args={[TOWER_W + 0.2, 0.08, TOWER_D + 0.2]} />
        <meshBasicMaterial color="#8ff9da" transparent opacity={0.18} />
      </mesh>

      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[TOWER_W + 0.2, 0.08, TOWER_D + 0.2]} />
        <meshBasicMaterial color="#8ff9da" transparent opacity={0.08} />
      </mesh>
    </group>
  )
}

function FloorDeck({
  floor,
  active,
}: {
  floor: number
  active: boolean
}) {
  const y = floorY(floor)

  return (
    <group position={[0, y, 0]} frustumCulled={false}>
      <mesh>
        <boxGeometry args={[TOWER_W - 0.5, 0.12, TOWER_D - 0.38]} />
        <meshStandardMaterial
          color={active ? "#10281f" : "#0a131f"}
          roughness={0.58}
          metalness={0.16}
          emissive={active ? "#1ba56c" : "#09121a"}
          emissiveIntensity={active ? 0.22 : 0.08}
        />
      </mesh>

      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[TOWER_W - 0.9, 0.02, TOWER_D - 0.74]} />
        <meshBasicMaterial
          color={active ? "#83ffd2" : "#3d6c73"}
          transparent
          opacity={active ? 0.14 : 0.05}
        />
      </mesh>

      <mesh position={[0, 0.5, -TOWER_D / 2 + 0.16]}>
        <boxGeometry args={[TOWER_W - 0.8, 1.02, 0.05]} />
        <meshBasicMaterial color="#88ffe0" transparent opacity={active ? 0.08 : 0.04} />
      </mesh>

      <Text
        position={[-TOWER_W / 2 - 0.72, 0.22, 0]}
        fontSize={0.36}
        color={active ? "#e9fff6" : "#88b7aa"}
        rotation={[0, Math.PI / 2, 0]}
        anchorX="center"
        anchorY="middle"
      >
        {`F${floor}`}
      </Text>
    </group>
  )
}

function FloorColumnLabels() {
  return (
    <group frustumCulled={false}>
      {Array.from({ length: FLOORS }, (_, i) => {
        const floor = i + 1
        return (
          <Text
            key={floor}
            position={[TOWER_W / 2 + 0.82, floorY(floor) + 0.18, 0]}
            fontSize={0.24}
            color="#7ba79b"
            rotation={[0, -Math.PI / 2, 0]}
            anchorX="center"
            anchorY="middle"
          >
            {`${floor}`}
          </Text>
        )
      })}
    </group>
  )
}

function AnimatedStatusOrb({
  color,
  selected,
  hovered,
  onClick,
  onPointerOver,
  onPointerOut,
}: {
  color: string
  selected: boolean
  hovered: boolean
  onClick: (e: any) => void
  onPointerOver: (e: any) => void
  onPointerOut: (e: any) => void
}) {
  const orbRef = useRef<THREE.Mesh | null>(null)
  const glowRef = useRef<THREE.Mesh | null>(null)
  const seed = useMemo(() => Math.random() * Math.PI * 2, [])

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime() + seed
    const bob = Math.sin(t * 2.1) * 0.08
    const scalePulse = 1 + Math.sin(t * 2.1) * 0.03

    if (orbRef.current) {
      orbRef.current.position.y = 0.6 + bob
      orbRef.current.scale.setScalar(scalePulse)
    }

    if (glowRef.current) {
      glowRef.current.position.y = 0.61 + bob
      const glowScale = 1 + Math.sin(t * 2.1) * 0.05
      glowRef.current.scale.setScalar(glowScale)

      const material = glowRef.current.material as THREE.MeshBasicMaterial
      const targetOpacity = selected ? 0.18 : hovered ? 0.12 : 0.08
      material.opacity = THREE.MathUtils.lerp(material.opacity, targetOpacity, 1 - Math.exp(-delta * 6))
    }
  })

  return (
    <>
      <mesh
        ref={orbRef}
        position={[0, 0.6, 0]}
        renderOrder={40}
        onClick={onClick}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
      >
        <sphereGeometry args={[0.16, 28, 28]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={selected ? 1.2 : hovered ? 0.9 : 0.6}
          roughness={0.14}
          metalness={0.06}
        />
      </mesh>

      <mesh ref={glowRef} position={[0, 0.61, 0]}>
        <sphereGeometry args={[0.26, 28, 28]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.16 : 0.08} />
      </mesh>
    </>
  )
}

function AssetPod({
  asset,
  selected,
  onSelect,
}: {
  asset: Asset
  selected: boolean
  onSelect: (asset: Asset) => void
}) {
  const y = floorY(asset.floor)
  const color = STATUS_COLORS[asset.status]
  const [hovered, setHovered] = useState(false)
  const showTooltip = hovered || selected

  const openDetails = (e: any) => {
    e.stopPropagation()
    onSelect(asset)
  }

  const onEnter = (e: any) => {
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = "pointer"
  }

  const onLeave = (e: any) => {
    e.stopPropagation()
    setHovered(false)
    document.body.style.cursor = "default"
  }

  return (
    <group position={[asset.x, y + 0.16, asset.z]} frustumCulled={false}>
      <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.13, 0]}>
        <mesh
          renderOrder={20}
          onClick={openDetails}
          onPointerOver={onEnter}
          onPointerOut={onLeave}
        >
          <torusGeometry args={[0.9, 0.1, 24, 140]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={selected ? 1 : hovered ? 0.78 : 0.5}
            roughness={0.14}
            metalness={0.42}
          />
        </mesh>

        <mesh>
          <torusGeometry args={[1.12, 0.028, 14, 100]} />
          <meshBasicMaterial color={color} transparent opacity={selected ? 0.34 : 0.18} />
        </mesh>

        <mesh>
          <ringGeometry args={[0.62, 0.78, 48]} />
          <meshBasicMaterial color={color} transparent opacity={0.16} side={THREE.DoubleSide} />
        </mesh>
      </group>

      <RoundedBox
        args={[1.02, 0.34, 0.62]}
        radius={0.07}
        smoothness={4}
        position={[0, 0.22, 0]}
        onClick={openDetails}
        onPointerOver={onEnter}
        onPointerOut={onLeave}
      >
        <meshStandardMaterial
          color="#070b10"
          roughness={0.18}
          metalness={0.42}
          emissive="#0c1220"
          emissiveIntensity={0.26}
        />
      </RoundedBox>

      <AnimatedStatusOrb
        color={color}
        selected={selected}
        hovered={hovered}
        onClick={openDetails}
        onPointerOver={onEnter}
        onPointerOut={onLeave}
      />

      <mesh
        position={[0, 0.38, 0]}
        onClick={openDetails}
        onPointerOver={onEnter}
        onPointerOut={onLeave}
      >
        <cylinderGeometry args={[1.22, 1.22, 1.45, 32]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {selected && (
        <>
          <group rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
            <mesh>
              <torusGeometry args={[1.3, 0.04, 14, 90]} />
              <meshBasicMaterial color={color} transparent opacity={0.34} />
            </mesh>
          </group>

          <mesh position={[0, 0.92, 0]}>
            <cylinderGeometry args={[0.014, 0.014, 0.62, 10]} />
            <meshBasicMaterial color={color} transparent opacity={0.38} />
          </mesh>
        </>
      )}

      {showTooltip && (
        <Html position={[0, 1.3, 0]} center distanceFactor={10}>
          <div className="rounded-2xl border border-cyan-500/15 bg-[#091224]/95 px-3 py-2 text-[11px] text-white shadow-xl backdrop-blur-md">
            <div className="font-medium">{asset.name}</div>
            <div className="mt-1 text-[10px] text-slate-400">
              {asset.type} • {asset.floor}F • {STATUS_LABELS[asset.status]}
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
  const selectedFloor = selectedAsset?.floor ?? null

  return (
    <group onClick={() => onSelectAsset(null)} frustumCulled={false}>
      <GroundPlane />
      <Podium />
      <TowerShell />
      <TowerCore />
      <RoofCrown />
      <FacadeMullions />
      <FloorColumnLabels />

      {Array.from({ length: FLOORS }, (_, i) => i + 1).map((floor) => (
        <FloorDeck key={floor} floor={floor} active={selectedFloor === floor} />
      ))}

      {assets.map((asset) => (
        <AssetPod
          key={asset.id}
          asset={asset}
          selected={selectedAsset?.id === asset.id}
          onSelect={onSelectAsset}
        />
      ))}
    </group>
  )
}

function AssetDetailsPanel({
  asset,
  onClose,
}: {
  asset: Asset | null
  onClose: () => void
}) {
  if (!asset) return null

  const color = STATUS_COLORS[asset.status]

  return (
    <div className="pointer-events-auto absolute right-6 top-24 w-[350px] rounded-[28px] border border-white/8 bg-[#071120]/90 p-5 shadow-2xl backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">
            Asset Details
          </div>
          <h3 className="mt-2 text-[22px] font-semibold text-white">{asset.name}</h3>
        </div>

        <button
          onClick={onClose}
          className="rounded-xl border border-slate-700/80 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Close
        </button>
      </div>

      <div className="mt-5 space-y-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-slate-300">{STATUS_LABELS[asset.status]}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-white/[0.04] p-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Type</div>
            <div className="mt-1 text-white">{asset.type}</div>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Floor</div>
            <div className="mt-1 text-white">{asset.floor}F</div>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Zone</div>
            <div className="mt-1 text-white">{asset.zone}</div>
          </div>

          <div className="rounded-2xl bg-white/[0.04] p-3">
            <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
              Building
            </div>
            <div className="mt-1 text-white">{asset.building}</div>
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.04] p-3">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Asset ID</div>
          <div className="mt-1 break-all text-white">{asset.id}</div>
        </div>
      </div>
    </div>
  )
}

export default function MapPage() {
  const { selectedSiteId } = useSiteStore()
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  const [activeType, setActiveType] = useState<"All" | AssetType>("All")
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<AssetStatus | "ALL">("ALL")
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [cameraView, setCameraView] = useState<CameraView>("default")
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchAssets = async () => {
      setLoading(true)

      try {
        const params: Record<string, string | number> = { limit: 200 }
        if (selectedSiteId) params.siteId = selectedSiteId

        const res = await api.get("/assets", { params })
        const mappedAssets = mapAssetsFromApi(res.data.data ?? [])
        setAssets(mappedAssets)
      } catch (err) {
        console.error("Map assets fetch error:", err)
        setAssets([])
      } finally {
        setLoading(false)
      }
    }

    fetchAssets()
  }, [selectedSiteId])

  const filteredAssets = useMemo(() => {
    return assets.filter((asset) => {
      const typeOk = activeType === "All" || asset.type === activeType
      const statusOk = statusFilter === "ALL" || asset.status === statusFilter
      const q = search.toLowerCase().trim()

      const searchOk =
        !q ||
        asset.name.toLowerCase().includes(q) ||
        asset.type.toLowerCase().includes(q) ||
        asset.zone.toLowerCase().includes(q) ||
        asset.building.toLowerCase().includes(q)

      return typeOk && statusOk && searchOk
    })
  }, [assets, activeType, statusFilter, search])

  const buildingStatusCounts = useMemo(() => {
    return {
      ok: filteredAssets.filter((a) => a.status === "OPERATIONAL").length,
      warn: filteredAssets.filter((a) => a.status === "SCHEDULED_TASK").length,
      err: filteredAssets.filter((a) => a.status === "CRITICAL_ALERT").length,
    }
  }, [filteredAssets])

  useEffect(() => {
    if (!selectedAsset) return
    const stillExists = filteredAssets.some((a) => a.id === selectedAsset.id)
    if (!stillExists) setSelectedAsset(null)
  }, [filteredAssets, selectedAsset])

  if (loading) return <PageLoader />

  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#04111d] text-white">
      <div className="absolute inset-0">
        <Canvas
          camera={{
            position: [25, 17, 25],
            fov: 34,
            near: 0.1,
            far: 700,
          }}
          gl={{ antialias: true }}
          dpr={[1, 1.75]}
        >
          <color attach="background" args={[BG]} />

          <SceneLights />
          <CameraRig view={cameraView} controlsRef={controlsRef} />

          <Building3D
            assets={filteredAssets}
            selectedAsset={selectedAsset}
            onSelectAsset={setSelectedAsset}
          />

          <OrbitControls
            ref={controlsRef}
            target={[0, floorY(6), 0]}
            minDistance={10}
            maxDistance={220}
            minPolarAngle={0.16}
            maxPolarAngle={Math.PI / 2.02}
            enablePan={false}
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.75}
            zoomSpeed={0.85}
          />
        </Canvas>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(18,78,95,0.16),transparent_34%)]" />

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-6 right-6 top-4 rounded-[28px] border border-white/8 bg-[#071120]/82 px-5 py-4 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-wrap items-center gap-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
              Asset Type
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {ASSET_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => setActiveType(type)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    activeType === type
                      ? "bg-emerald-500 text-white shadow-[0_0_18px_rgba(16,185,129,0.25)]"
                      : "bg-white/[0.02] text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {[
                {
                  key: "OPERATIONAL" as const,
                  label: "Operational",
                  dot: "bg-emerald-400",
                  active: "border-emerald-400/50 bg-emerald-500/12 text-emerald-300",
                },
                {
                  key: "SCHEDULED_TASK" as const,
                  label: "Task",
                  dot: "bg-yellow-400",
                  active: "border-yellow-400/50 bg-yellow-500/12 text-yellow-300",
                },
                {
                  key: "CRITICAL_ALERT" as const,
                  label: "Critical",
                  dot: "bg-red-400",
                  active: "border-red-400/50 bg-red-500/12 text-red-300",
                },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setStatusFilter(item.key)}
                  className={`flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition ${
                    statusFilter === item.key
                      ? item.active
                      : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  }`}
                >
                  <span className={`h-2.5 w-2.5 rounded-full ${item.dot}`} />
                  <span>{item.label}</span>
                </button>
              ))}

              <button
                onClick={() => setStatusFilter("ALL")}
                className={`rounded-full border px-3 py-2 text-sm transition ${
                  statusFilter === "ALL"
                    ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                    : "border-white/10 bg-white/[0.02] text-slate-300 hover:bg-white/[0.05] hover:text-white"
                }`}
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        <div className="pointer-events-auto absolute left-6 top-24 w-[330px] space-y-4">
          <div className="rounded-[28px] border border-white/8 bg-[#071120]/84 p-3 shadow-2xl backdrop-blur-xl">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets, floors, zones..."
              className="w-full rounded-2xl border border-white/8 bg-[#09162a] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>

          <div className="rounded-[28px] border border-white/8 bg-[#071120]/84 p-4 shadow-2xl backdrop-blur-xl">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
              Building Status
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-3">
                <span className="h-3.5 w-3.5 rounded-full bg-emerald-400" />
                <span className="text-white">All Clear</span>
                <span className="ml-auto text-slate-400">{buildingStatusCounts.ok}</span>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-3">
                <span className="h-3.5 w-3.5 rounded-full bg-yellow-400" />
                <span className="text-white">Scheduled Task</span>
                <span className="ml-auto text-slate-400">{buildingStatusCounts.warn}</span>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-white/[0.03] px-3 py-3">
                <span className="h-3.5 w-3.5 rounded-full bg-red-400" />
                <span className="text-white">Critical Alert</span>
                <span className="ml-auto text-slate-400">{buildingStatusCounts.err}</span>
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                Camera
              </div>

              <div className="grid grid-cols-5 gap-2">
                {[
                  { icon: "👁", value: "default" as const },
                  { icon: "↑", value: "top" as const },
                  { icon: "←", value: "left" as const },
                  { icon: "→", value: "right" as const },
                  { icon: "⤢", value: "fit" as const },
                ].map((item, i) => (
                  <button
                    key={i}
                    onClick={() => setCameraView(item.value)}
                    className={`flex h-11 items-center justify-center rounded-2xl border transition ${
                      cameraView === item.value
                        ? "border-emerald-400/45 bg-emerald-500/12 text-emerald-300"
                        : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    <span className="text-sm">{item.icon}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <AssetDetailsPanel asset={selectedAsset} onClose={() => setSelectedAsset(null)} />
      </div>
    </div>
  )
}