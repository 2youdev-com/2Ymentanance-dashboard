import { Badge } from './badge'
import { AssetStatus, Severity } from '@/types'

export function StatusBadge({ status }: { status: AssetStatus }) {
  const map = {
    OPERATIONAL: { variant: 'success' as const, label: 'Operational' },
    NEEDS_MAINTENANCE: { variant: 'warning' as const, label: 'Needs Maintenance' },
    OUT_OF_SERVICE: { variant: 'danger' as const, label: 'Out of Service' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const map = {
    LOW: { variant: 'secondary' as const, label: 'Low' },
    MEDIUM: { variant: 'warning' as const, label: 'Medium' },
    HIGH: { variant: 'danger' as const, label: 'High' },
    CRITICAL: { variant: 'destructive' as const, label: 'Critical' },
  }
  const { variant, label } = map[severity]
  return <Badge variant={variant}>{label}</Badge>
}

export function ResultBadge({ result }: { result: 'PASS' | 'FAIL' | 'NA' }) {
  const map = {
    PASS: { variant: 'success' as const, label: 'Pass' },
    FAIL: { variant: 'danger' as const, label: 'Fail' },
    NA: { variant: 'secondary' as const, label: 'N/A' },
  }
  const { variant, label } = map[result]
  return <Badge variant={variant}>{label}</Badge>
}
