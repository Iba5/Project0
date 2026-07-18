import { z } from "zod"

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").min(6, "Password must be at least 6 characters"),
  rememberMe: z.boolean(),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const signupSchema = z.object({
  name: z.string().min(1, "Full name is required").min(2, "Name must be at least 2 characters"),
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
})

export type SignupFormValues = z.infer<typeof signupSchema>

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
})

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>

// ─── Events ───────────────────────────────────────────────────────────────────

export const eventSchema = z.object({
  name: z.string().min(1, "Event name is required"),
  description: z.string().min(1, "Description is required").min(10, "Description must be at least 10 characters"),
  banner: z.string().url("Banner must be a valid URL").or(z.literal("")),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  status: z.enum(["Upcoming", "Ongoing", "Expired"]),
})

export type EventFormValues = z.infer<typeof eventSchema>

// ─── Participants ──────────────────────────────────────────────────────────────

export const participantSchema = z.object({
  name: z.string().min(1, "Contestant name is required"),
  category: z.string().min(1, "Category is required"),
  platform: z.enum(["TikTok", "Facebook", "Instagram", "YouTube"]),
  videoUrl: z.string().min(1, "Video URL is required").url("Video URL must be a valid URL"),
  status: z.enum(["Active", "Pending", "Suspended"]),
  votes: z.number({ coerce: true }).int().min(0, "Votes cannot be negative"),
})

export type ParticipantFormValues = z.infer<typeof participantSchema>

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settingsSchema = z.object({
  companyName: z.string().min(1, "Company name is required"),
  supportEmail: z.string().min(1, "Support email is required").email("Enter a valid email address"),
  timezone: z.string().min(1, "Timezone is required"),
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    marketing: z.boolean(),
  }),
})

export type SettingsFormValues = z.infer<typeof settingsSchema>
