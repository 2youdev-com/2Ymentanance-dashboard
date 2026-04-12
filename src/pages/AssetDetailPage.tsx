import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPin, Calendar, User, Package, ChevronDown, ChevronUp, Image } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge, SeverityBadge, ResultBadge } from '@/components/ui/status-badge'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageLoader } from '@/components/ui/spinner'
import { Asset, MaintenanceLog } from '@/types'
import api from '@/lib/api'
import { format } from 'date-fns'
import ReactPlayer from 'react-player'

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [asset, setAsset] = useState<Asset | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  useEffect(() => {
    api.get(`/assets/${id}`)
      .then(res => setAsset(res.data.data))
      .catch(() => navigate('/assets'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  if (loading) return <PageLoader />
  if (!asset) return null

  const formatType = (t: string) => t.replace(/_/g, ' ')

  return (
    <div>
      <PageHeader
        title={asset.name}
        description={`${formatType(asset.type)} · ${asset.assetNumber}`}
        breadcrumbs={[{ label: 'Assets', to: '/assets' }, { label: asset.name }]}
        actions={<StatusBadge status={asset.status} />}
      />

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left: Asset info */}
          <div className="lg:col-span-2 space-y-6">
            {/* Info card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" /> Asset Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  {[
                    { label: 'Asset Type', value: formatType(asset.type) },
                    { label: 'Asset Name', value: asset.name },
                    { label: 'Model', value: asset.model },
                    { label: 'Serial Number', value: asset.serialNumber },
                    { label: 'Asset Number', value: asset.assetNumber },
                    { label: 'Status', value: <StatusBadge status={asset.status} /> },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
                {asset.remarks && (
                  <div className="mt-4 rounded-md bg-muted p-3 text-sm">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Remarks</p>
                    <p>{asset.remarks}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Location */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> Location
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  {[
                    { label: 'Site', value: asset.site.name },
                    { label: 'Building', value: asset.building || '—' },
                    { label: 'Floor', value: asset.floor || '—' },
                    { label: 'Zone', value: asset.zone || '—' },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="mt-0.5 font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>

            {/* Maintenance History Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Maintenance History</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {!asset.maintenanceLogs || asset.maintenanceLogs.length === 0 ? (
                  <p className="px-6 py-8 text-center text-sm text-muted-foreground">No maintenance records yet</p>
                ) : (
                  <div className="divide-y">
                    {asset.maintenanceLogs.map((log: MaintenanceLog) => (
                      <div key={log.id} className="px-6 py-4">
                        <button
                          className="flex w-full items-center justify-between text-left"
                          onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                              log.status === 'COMPLETED' ? 'bg-green-500' : 'bg-yellow-500'
                            }`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{log.type === 'PREVENTIVE' ? 'Preventive' : 'Corrective'} Maintenance</span>
                                {log.problemReport && (
                                  <SeverityBadge severity={log.problemReport.severity} />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(log.startedAt), 'dd MMM yyyy, HH:mm')} · {log.technician.fullName}
                              </p>
                            </div>
                          </div>
                          {expandedLog === log.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                        </button>

                        {expandedLog === log.id && (
                          <div className="mt-4 space-y-4 pl-5">
                            {/* Checklist items */}
                            {log.checklistItems && log.checklistItems.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">Checklist Results</p>
                                <div className="space-y-1.5">
                                  {log.checklistItems.map((item) => (
                                    <div key={item.id} className="flex items-start justify-between gap-3 text-xs">
                                      <span className="text-muted-foreground">{item.description}</span>
                                      <div className="flex items-center gap-2 flex-shrink-0">
                                        {item.notes && <span className="text-muted-foreground italic">{item.notes}</span>}
                                        <ResultBadge result={item.result} />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Machine photos */}
                            {log.machinePhotos && log.machinePhotos.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                  <Image className="h-3 w-3" /> Machine Photos ({log.machinePhotos.length})
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  {log.machinePhotos.map((p) => (
                                    <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                                      <img src={p.url} alt="machine" className="h-20 w-20 rounded object-cover border hover:opacity-80 transition-opacity" />
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Person selfie */}
                            {log.personPhoto && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                  <User className="h-3 w-3" /> Technician Selfie
                                </p>
                                <a href={log.personPhoto} target="_blank" rel="noreferrer">
                                  <img src={log.personPhoto} alt="technician" className="h-20 w-20 rounded object-cover border hover:opacity-80 transition-opacity" />
                                </a>
                              </div>
                            )}

                            {/* Problem report */}
                            {log.problemReport && (
                              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <p className="text-xs font-semibold text-red-800">Problem Report</p>
                                  <div className="flex gap-1">
                                    <SeverityBadge severity={log.problemReport.severity} />
                                    {log.problemReport.resolved && <Badge variant="success">Resolved</Badge>}
                                  </div>
                                </div>
                                <p className="text-xs text-red-700 mb-1">
                                  <span className="font-medium">Category:</span> {log.problemReport.category.replace(/_/g, ' ')}
                                </p>
                                <p className="text-xs text-red-700 mb-3">{log.problemReport.description}</p>

                                {/* Video player */}
                                {log.problemReport.videoUrl && (
                                  <div className="mb-2">
                                    <p className="text-xs font-medium text-red-700 mb-1">Video Evidence</p>
                                    <ReactPlayer
                                      url={log.problemReport.videoUrl}
                                      controls
                                      width="100%"
                                      height="200px"
                                      style={{ borderRadius: 6, overflow: 'hidden' }}
                                    />
                                  </div>
                                )}

                                {/* Audio player */}
                                {log.problemReport.audioUrl && (
                                  <div className="mb-2">
                                    <p className="text-xs font-medium text-red-700 mb-1">Audio Evidence</p>
                                    <audio controls className="w-full" src={log.problemReport.audioUrl} />
                                  </div>
                                )}

                                {/* Extra photos */}
                                {log.problemReport.extraPhotos && log.problemReport.extraPhotos.length > 0 && (
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    {log.problemReport.extraPhotos.map((p) => (
                                      <a key={p.id} href={p.url} target="_blank" rel="noreferrer">
                                        <img src={p.url} alt="problem" className="h-16 w-16 rounded object-cover border border-red-200 hover:opacity-80 transition-opacity" />
                                      </a>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right: Photo + Dates */}
          <div className="space-y-6">
            {/* Asset photo */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Asset Photo</CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-6 px-6">
                {asset.photoUrl ? (
                  <img src={asset.photoUrl} alt={asset.name} className="w-full rounded-lg object-cover aspect-square border" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg border bg-muted">
                    <Package className="h-12 w-12 text-muted-foreground" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Maintenance dates */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Maintenance Dates
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Last Preventive</p>
                  <p className="font-medium mt-0.5">
                    {asset.lastPreventiveDate ? format(new Date(asset.lastPreventiveDate), 'dd MMM yyyy') : 'Not recorded'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Last Corrective</p>
                  <p className="font-medium mt-0.5">
                    {asset.lastCorrectiveDate ? format(new Date(asset.lastCorrectiveDate), 'dd MMM yyyy') : 'Not recorded'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registered</p>
                  <p className="font-medium mt-0.5">{format(new Date(asset.createdAt), 'dd MMM yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Registered by</p>
                  <p className="font-medium mt-0.5">{asset.creator.fullName}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
