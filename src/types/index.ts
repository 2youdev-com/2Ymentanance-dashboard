export type Role = 'TECHNICIAN' | 'VIEWER' | 'ADMIN'
export type AssetStatus = 'OPERATIONAL' | 'NEEDS_MAINTENANCE' | 'OUT_OF_SERVICE'
export type MaintenanceType = 'PREVENTIVE' | 'CORRECTIVE'
export type ChecklistResult = 'PASS' | 'FAIL' | 'NA'
export type Severity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type ProblemCategory =
  | 'OVERHEATING' | 'UNUSUAL_NOISE' | 'WATER_LEAK' | 'ELECTRICAL_FAULT'
  | 'SENSOR_FAILURE' | 'PHYSICAL_DAMAGE' | 'PRESSURE_DROP'
  | 'MECHANICAL_JAM' | 'BATTERY_FAILURE' | 'FILTER_CLOGGED'

export interface Site {
  id: string
  name: string
  address: string
}

export interface User {
  id: string
  username: string
  fullName: string
  role: Role
  photoUrl?: string
  sites: { id: string; name: string }[]
}

export interface Asset {
  id: string
  qrUuid: string
  type: string
  name: string
  model: string
  serialNumber: string
  assetNumber: string
  building?: string
  floor?: string
  zone?: string
  status: AssetStatus
  photoUrl?: string
  remarks?: string
  lastPreventiveDate?: string
  lastCorrectiveDate?: string
  createdAt: string
  site: { id: string; name: string }
  creator: { id: string; fullName: string }
  maintenanceLogs?: MaintenanceLog[]
  _count?: { maintenanceLogs: number }
}

export interface ChecklistItem {
  id: string
  itemCode: string
  description: string
  result: ChecklistResult
  notes?: string
}

export interface MachinePhoto {
  id: string
  url: string
  createdAt: string
}

export interface ExtraPhoto {
  id: string
  url: string
  createdAt: string
}

export interface ProblemReport {
  id: string
  category: ProblemCategory
  severity: Severity
  description: string
  videoUrl?: string
  audioUrl?: string
  submittedAt: string
  resolved: boolean
  extraPhotos: ExtraPhoto[]
  log?: {
    asset: { id: string; name: string; type: string; site: { name: string } }
    technician: { id: string; fullName: string }
  }
}

export interface MaintenanceLog {
  id: string
  type: MaintenanceType
  status: string
  startedAt: string
  completedAt?: string
  personPhoto?: string
  asset: { id: string; name: string; type: string; site: { name: string } }
  technician: { id: string; fullName: string }
  checklistItems?: ChecklistItem[]
  machinePhotos?: MachinePhoto[]
  problemReport?: ProblemReport
  _count?: { checklistItems: number; machinePhotos: number }
}

export interface DashboardStats {
  totalAssets: number
  needsMaintenance: number
  completedThisWeek: number
  openReports: number
}

export interface ActivityEvent {
  id: string
  type: string
  assetId: string
  assetName: string
  siteName: string
  technicianName: string
  timestamp: string
  details: string
}

export interface Pagination {
  total: number
  page: number
  limit: number
  pages: number
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  pagination?: Pagination
  error?: string
}
