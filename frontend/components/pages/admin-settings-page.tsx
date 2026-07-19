'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { getSettings, updateSettings, type SettingsApi } from '@/lib/api'

const settingsSchema = z.object({
  companyName: z.string().min(1, 'Company name is required'),
  supportEmail: z.string().email('Enter a valid email address'),
  timezone: z.string().min(1, 'Timezone is required'),
  emailNotifications: z.boolean(),
  smsNotifications: z.boolean(),
  marketingNotifications: z.boolean(),
})

type SettingsValues = z.infer<typeof settingsSchema>

const timezones = [
  'Africa/Harare',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'Africa/Nairobi',
  'UTC',
  'US/Eastern',
  'US/Pacific',
  'Europe/London',
]

export function AdminSettingsPage() {
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const form = useForm<SettingsValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      companyName: '',
      supportEmail: '',
      timezone: 'Africa/Harare',
      emailNotifications: true,
      smsNotifications: false,
      marketingNotifications: false,
    },
  })

  useEffect(() => {
    let cancelled = false
    const fetchSettings = async () => {
      try {
        const result = await getSettings()
        if (!cancelled) {
          form.reset({
            companyName: result.companyName,
            supportEmail: result.supportEmail,
            timezone: result.timezone,
            emailNotifications: result.notifications.email,
            smsNotifications: result.notifications.sms,
            marketingNotifications: result.notifications.marketing,
          })
        }
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : 'Failed to load settings')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchSettings()
    return () => { cancelled = true }
  }, [form])

  const onSubmit = async (values: SettingsValues) => {
    setSaving(true)
    try {
      const payload: SettingsApi = {
        companyName: values.companyName,
        supportEmail: values.supportEmail,
        timezone: values.timezone,
        notifications: {
          email: values.emailNotifications,
          sms: values.smsNotifications,
          marketing: values.marketingNotifications,
        },
      }
      await updateSettings(payload)
      toast.success('Settings saved')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  return (
    <>
      <motion.div
        className="space-y-8 max-w-2xl"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Company Information */}
            <section className="space-y-4">
              <h2 className="text-base font-semibold">Company Information</h2>
              <Separator />

              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Company Name</FormLabel>
                    <FormControl>
                      <Input placeholder="VibeWave" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="supportEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Support Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="support@vibewave.co.zw"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timezone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timezone</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select timezone" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {timezones.map((tz) => (
                          <SelectItem key={tz} value={tz}>
                            {tz}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>

            {/* Notification Preferences */}
            <section className="space-y-4">
              <h2 className="text-base font-semibold">
                Notification Preferences
              </h2>
              <Separator />

              <FormField
                control={form.control}
                name="emailNotifications"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="!mt-0">Email Notifications</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Receive important updates via email
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="smsNotifications"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="!mt-0">SMS Notifications</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Receive critical alerts via SMS
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="marketingNotifications"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="!mt-0">
                        Marketing Notifications
                      </FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Receive product news and feature announcements
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </section>

            {/* Save */}
            <Button
              type="submit"
              className="rounded-full px-6"
              disabled={saving}
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </Form>
      </motion.div>
    </>
  )
}