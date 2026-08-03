'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings as SettingsIcon,
  Bell,
  Shield,
  Palette,
  Save,
  Sun,
  Moon,
  Monitor,
  Lock,
  KeyRound,
  Clock,
  Hourglass,
  ShieldCheck,
  Database,
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { getSettings, updateSettings, type SettingsItem } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { R2UsageDashboard } from '@/components/dashboard/r2-usage-dashboard'

const MOTION_TAB = {
  initial: { opacity: 0, x: 8 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -8 },
  transition: { duration: 0.25, ease: 'easeOut' as const },
}

function ComingSoonBadge() {
  return (
    <Badge
      variant="outline"
      className="ml-2 border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] font-semibold uppercase tracking-wide"
    >
      Coming soon
    </Badge>
  )
}

function FieldRow({
  label,
  description,
  children,
}: {
  label: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {label}
        </p>
        {description && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

// Theme picker card used on the Appearance tab — mirrors what ThemeToggle does
// but inline with preview swatches.
function ThemePreviewCard({
  value,
  label,
  description,
  icon: Icon,
  isActive,
  onSelect,
}: {
  value: 'light' | 'dark' | 'system'
  label: string
  description: string
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  isActive: boolean
  onSelect: (v: 'light' | 'dark' | 'system') => void
}) {
  const isLight = value === 'light'
  const isSystem = value === 'system'
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className="text-left rounded-xl border p-4 transition-all group w-full h-full"
      style={{
        background: isActive ? 'rgba(245,158,11,0.06)' : 'var(--surface-3)',
        borderColor: isActive ? 'rgba(245,158,11,0.5)' : 'var(--border-subtle)',
        boxShadow: isActive ? '0 0 0 1px rgba(245,158,11,0.3), 0 0 24px rgba(245,158,11,0.08)' : 'none',
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = 'var(--border-strong)'
          e.currentTarget.style.background = 'var(--surface-2)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          e.currentTarget.style.borderColor = 'var(--border-subtle)'
          e.currentTarget.style.background = 'var(--surface-3)'
        }
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{
            background: isActive
              ? 'linear-gradient(135deg, #F59E0B, #D97706)'
              : 'var(--surface-3)',
          }}
        >
          <Icon
            className="w-4 h-4"
            style={{ color: isActive ? 'var(--surface-3)' : 'var(--text-muted)' }}
          />
        </div>
        {isActive && (
          <span
            className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}
          >
            Active
          </span>
        )}
      </div>
      <p className="text-sm font-semibold mt-3" style={{ color: 'var(--text-primary)' }}>
        {label}
      </p>
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
        {description}
      </p>
      {/* Mini theme preview swatches */}
      <div className="mt-3 flex gap-1.5">
        <span
          className="h-3 flex-1 rounded-full"
          style={{
            background: isLight
              ? 'linear-gradient(135deg, #FAFBFC, #F1F5F9)'
              : isSystem
                ? 'linear-gradient(135deg, #FAFBFC 0%, #FAFBFC 50%, #0B0F17 50%, #0B0F17 100%)'
                : 'linear-gradient(135deg, #0B0F17, #121824)',
            border: '1px solid var(--border-subtle)',
          }}
        />
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: isLight ? '#0F172A' : 'var(--text-primary)' }}
        />
        <span
          className="h-3 w-3 rounded-full"
          style={{ background: '#F59E0B' }}
        />
      </div>
    </button>
  )
}

export function AdminSettingsView() {
  const { theme, setTheme } = useTheme()
  const [settings, setSettings] = useState<SettingsItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('general')

  // Form state
  const [companyName, setCompanyName] = useState('')
  const [supportEmail, setSupportEmail] = useState('')
  const [timezone, setTimezone] = useState('')
  const [emailNotif, setEmailNotif] = useState(true)
  const [smsNotif, setSmsNotif] = useState(false)
  const [marketingNotif, setMarketingNotif] = useState(false)

  // next-themes returns undefined until mounted; track that for SSR-safe UI.
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    getSettings()
      .then(({ settings: s }) => {
        setSettings(s)
        setCompanyName(s.companyName)
        setSupportEmail(s.supportEmail)
        setTimezone(s.timezone)
        setEmailNotif(s.emailNotifications)
        setSmsNotif(s.smsNotifications)
        setMarketingNotif(s.marketingNotifications)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      const { settings: s } = await updateSettings({
        companyName,
        supportEmail,
        timezone,
        emailNotifications: emailNotif,
        smsNotifications: smsNotif,
        marketingNotifications: marketingNotif,
      })
      setSettings(s)
      toast.success('Settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="h-8 w-40 rounded" style={{ background: 'var(--surface-3)' }} />
        <div className="h-10 w-96 rounded-lg" style={{ background: 'var(--surface-3)' }} />
        <div className="h-64 rounded-xl" style={{ background: 'var(--surface-3)' }} />
      </div>
    )
  }

  const tabConfig: Array<{
    value: string
    label: string
    icon: React.ComponentType<{ className?: string }>
  }> = [
    { value: 'general', label: 'General', icon: SettingsIcon },
    { value: 'notifications', label: 'Notifications', icon: Bell },
    { value: 'security', label: 'Security', icon: Shield },
    { value: 'storage', label: 'Storage', icon: Database },
    { value: 'appearance', label: 'Appearance', icon: Palette },
  ]

  return (
    <div className="space-y-6 p-6">
      {/* Header + sticky save */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-10 -mx-6 px-6 py-3 flex items-center justify-between gap-4"
        style={{
          background: 'linear-gradient(180deg, var(--surface-3) 75%, transparent)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Settings
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Manage your platform configuration
          </p>
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full gap-2 shadow-lg shrink-0 focus-ring-gold button-press"
          style={{
            background: 'linear-gradient(135deg, #F59E0B, #D97706)',
            color: 'var(--surface-3)',
          }}
        >
          <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Changes'}
        </Button>
      </motion.div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
        <TabsList
          className="h-auto flex flex-wrap sm:flex-nowrap sm:flex-col w-full sm:w-56 items-stretch gap-1 p-2 rounded-xl"
          style={{
            background: 'var(--surface-1)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {tabConfig.map((tab) => (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className="justify-start gap-2 px-3 py-2 h-auto rounded-lg text-sm font-medium data-[state=active]:text-[#0B0F17] data-[state=active]:shadow-none"
              style={{
                color: 'var(--text-muted)',
              }}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <div className="min-w-0">
          <AnimatePresence mode="wait">
            {/* General */}
            {activeTab === 'general' && (
              <motion.div key="general" {...MOTION_TAB}>
                <TabsContent value="general" className="m-0">
                  <Card
                    className="rounded-xl border hover-glow"
                    style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
                  >
                    <CardHeader>
                      <CardTitle
                        className="flex items-center gap-2 text-base"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <SettingsIcon className="w-4 h-4" style={{ color: '#F59E0B' }} />
                        General
                      </CardTitle>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Basic platform identity and locale configuration.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-4">
                        <div className="space-y-2">
                          <Label style={{ color: 'var(--text-muted)' }}>Company Name</Label>
                          <Input
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="rounded-xl border-none input-focus-gold"
                            style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label style={{ color: 'var(--text-muted)' }}>Support Email</Label>
                          <Input
                            type="email"
                            value={supportEmail}
                            onChange={(e) => setSupportEmail(e.target.value)}
                            className="rounded-xl border-none input-focus-gold"
                            style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                          />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label style={{ color: 'var(--text-muted)' }}>Timezone</Label>
                          <Input
                            value={timezone}
                            onChange={(e) => setTimezone(e.target.value)}
                            className="rounded-xl border-none input-focus-gold"
                            style={{ background: 'var(--surface-3)', color: 'var(--text-primary)' }}
                            placeholder="Africa/Harare"
                          />
                        </div>
                      </div>
                      <Separator style={{ background: 'var(--border-subtle)' }} />
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-4">
                        <div className="space-y-2">
                          <Label style={{ color: 'var(--text-muted)' }}>Default Currency</Label>
                          <Input
                            value={settings ? 'USD ($)' : ''}
                            readOnly
                            className="rounded-xl border-none opacity-70"
                            style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label style={{ color: 'var(--text-muted)' }}>Support Phone</Label>
                          <Input
                            value={settings?.supportPhone || 'Not configured'}
                            readOnly
                            className="rounded-xl border-none opacity-70"
                            style={{ background: 'var(--surface-3)', color: 'var(--text-muted)' }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </motion.div>
            )}

            {/* Notifications */}
            {activeTab === 'notifications' && (
              <motion.div key="notifications" {...MOTION_TAB}>
                <TabsContent value="notifications" className="m-0">
                  <Card
                    className="rounded-xl border hover-glow"
                    style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
                  >
                    <CardHeader>
                      <CardTitle
                        className="flex items-center gap-2 text-base"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <Bell className="w-4 h-4" style={{ color: '#F59E0B' }} />
                        Notifications
                      </CardTitle>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Choose how the platform alerts admins and customers.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-0">
                      <FieldRow
                        label="Email Notifications"
                        description="Receive email alerts for important events"
                      >
                        <Switch checked={emailNotif} onCheckedChange={setEmailNotif} />
                      </FieldRow>
                      <Separator style={{ background: 'var(--border-subtle)' }} />
                      <FieldRow
                        label="SMS Notifications"
                        description="Receive SMS alerts for critical updates"
                      >
                        <Switch checked={smsNotif} onCheckedChange={setSmsNotif} />
                      </FieldRow>
                      <Separator style={{ background: 'var(--border-subtle)' }} />
                      <FieldRow
                        label="Marketing Notifications"
                        description="Receive promotional and marketing updates"
                      >
                        <Switch
                          checked={marketingNotif}
                          onCheckedChange={setMarketingNotif}
                        />
                      </FieldRow>
                    </CardContent>
                  </Card>
                </TabsContent>
              </motion.div>
            )}

            {/* Security */}
            {activeTab === 'security' && (
              <motion.div key="security" {...MOTION_TAB}>
                <TabsContent value="security" className="m-0">
                  <Card
                    className="rounded-xl border hover-glow"
                    style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
                  >
                    <CardHeader>
                      <CardTitle
                        className="flex items-center gap-2 text-base"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <Shield className="w-4 h-4" style={{ color: '#F59E0B' }} />
                        Security
                        <ComingSoonBadge />
                      </CardTitle>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Hardened authentication policies for admin accounts.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-0">
                      <FieldRow
                        label="Minimum Password Length"
                        description="Enforced when admins reset or change passwords"
                      >
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                          style={{ background: 'var(--surface-3)' }}
                        >
                          <KeyRound className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
                            12 chars
                          </span>
                        </div>
                      </FieldRow>
                      <Separator style={{ background: 'var(--border-subtle)' }} />
                      <FieldRow
                        label="Require Special Characters"
                        description="At least one symbol (e.g. !, @, #) in every password"
                      >
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                          style={{ background: 'rgba(16,185,129,0.12)' }}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
                          <span className="text-sm font-medium" style={{ color: '#10B981' }}>
                            Enabled
                          </span>
                        </div>
                      </FieldRow>
                      <Separator style={{ background: 'var(--border-subtle)' }} />
                      <FieldRow
                        label="Two-Factor Authentication"
                        description="Require a one-time code on every admin login"
                      >
                        <div className="flex items-center gap-2">
                          <Switch checked={false} disabled />
                          <ComingSoonBadge />
                        </div>
                      </FieldRow>
                      <Separator style={{ background: 'var(--border-subtle)' }} />
                      <FieldRow
                        label="Session Timeout"
                        description="Admins are auto-signed-out after this period of inactivity"
                      >
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                          style={{ background: 'var(--surface-3)' }}
                        >
                          <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
                            30 min
                          </span>
                        </div>
                      </FieldRow>
                      <Separator style={{ background: 'var(--border-subtle)' }} />
                      <FieldRow
                        label="Max Login Attempts"
                        description="Account is locked after this many failed attempts"
                      >
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                          style={{ background: 'var(--surface-3)' }}
                        >
                          <Hourglass className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                          <span className="text-sm font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
                            5 attempts
                          </span>
                        </div>
                      </FieldRow>
                      <Separator style={{ background: 'var(--border-subtle)' }} />
                      <FieldRow
                        label="Lock Icon Reminder"
                        description="Visual lock indicator displayed on password fields"
                      >
                        <div
                          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                          style={{ background: 'rgba(16,185,129,0.12)' }}
                        >
                          <Lock className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
                          <span className="text-sm font-medium" style={{ color: '#10B981' }}>
                            Always On
                          </span>
                        </div>
                      </FieldRow>
                    </CardContent>
                  </Card>
                </TabsContent>
              </motion.div>
            )}

            {/* Storage */}
            {activeTab === 'storage' && (
              <motion.div key="storage" {...MOTION_TAB}>
                <TabsContent value="storage" className="m-0">
                  <R2UsageDashboard />
                </TabsContent>
              </motion.div>
            )}

            {/* Appearance */}
            {activeTab === 'appearance' && (
              <motion.div key="appearance" {...MOTION_TAB}>
                <TabsContent value="appearance" className="m-0">
                  <Card
                    className="rounded-xl border hover-glow"
                    style={{ background: 'var(--surface-1)', borderColor: 'var(--border-subtle)' }}
                  >
                    <CardHeader>
                      <CardTitle
                        className="flex items-center gap-2 text-base"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        <Palette className="w-4 h-4" style={{ color: '#F59E0B' }} />
                        Appearance
                      </CardTitle>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Pick a theme. System follows the visitor&apos;s OS preference.
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
                        <ThemePreviewCard
                          value="light"
                          label="Light"
                          description="Crisp white surfaces for daytime viewing."
                          icon={Sun}
                          isActive={mounted && theme === 'light'}
                          onSelect={(v) => setTheme(v)}
                        />
                        <ThemePreviewCard
                          value="dark"
                          label="Dark"
                          description="Deep navy with gold accents. Default for Vibe Hub."
                          icon={Moon}
                          isActive={mounted && theme === 'dark'}
                          onSelect={(v) => setTheme(v)}
                        />
                        <ThemePreviewCard
                          value="system"
                          label="System"
                          description="Syncs with the OS light/dark preference automatically."
                          icon={Monitor}
                          isActive={mounted && theme === 'system'}
                          onSelect={(v) => setTheme(v)}
                        />
                      </div>
                      <Separator className="my-2" style={{ background: 'var(--border-subtle)' }} />
                      <div className="py-4">
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          The gold accent colour is part of the Vibe Hub brand and is applied in every
                          theme. Use the quick toggle in the top bar to switch on the fly.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  )
}

export default AdminSettingsView
