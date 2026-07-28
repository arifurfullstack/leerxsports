import { z } from "zod";

export const classLevelSchema = z.enum(["beginner", "intermediate", "advanced"]);
export const classCategorySchema = z.enum([
  "fitness",
  "martial arts",
  "team sports",
  "racquet sports",
  "water sports",
  "outdoor",
  "dance",
  "cycling",
]);
export const bookingStatusSchema = z.enum(["confirmed", "cancelled", "attended"]);

const datetimeWithOffset = z.string().datetime({ offset: true });

export const sportsClassSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().nullable(),
  instructor: z.string().min(1),
  duration_minutes: z.number().int().positive(),
  capacity: z.number().int().positive(),
  schedule: datetimeWithOffset,
  location: z.string().nullable(),
  level: classLevelSchema,
  category: z.string().nullable(),
  image_url: z.string().url().nullable().or(z.literal("")),
  price: z.number().nonnegative(),
  is_active: z.boolean(),
  created_at: datetimeWithOffset,
  updated_at: datetimeWithOffset,
});

export type SportsClass = z.infer<typeof sportsClassSchema>;

export const createClassSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  instructor: z.string().min(1),
  duration_minutes: z.coerce.number().int().positive(),
  capacity: z.coerce.number().int().positive(),
  schedule: datetimeWithOffset,
  location: z.string().optional(),
  level: classLevelSchema,
  category: z.string().optional(),
  image_url: z.string().url().optional().or(z.literal("")),
  price: z.coerce.number().nonnegative().default(0),
});

export const updateClassSchema = createClassSchema.partial().extend({
  id: z.string().uuid(),
});

export const bookingSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  class_id: z.string().uuid(),
  status: bookingStatusSchema,
  booked_at: datetimeWithOffset,
});

export const bookingWithClassSchema = bookingSchema.extend({
  class: sportsClassSchema,
});

export const classBookingCountSchema = z.object({
  class_id: z.string().uuid(),
  count: z.number().int(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const signupSchema = loginSchema.extend({
  fullName: z.string().min(1),
});

export const resetPasswordSchema = z.object({
  email: z.string().email(),
});

export const newPasswordSchema = z.object({
  password: z.string().min(6),
});

export const appRoleSchema = z.enum(["admin", "moderator", "user", "trainee", "trainer"]);
export type AppRole = z.infer<typeof appRoleSchema>;

export const experienceLevelSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "elite",
]);

export const genderSchema = z.enum(["male", "female", "nonbinary", "prefer_not"]);

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9_]+$/, "lowercase letters, numbers and underscores only");

export const traineeOnboardingSchema = z.object({
  username: usernameSchema,
  display_name: z.string().trim().min(1).max(60),
  country: z.string().trim().min(2).max(80),
  native_language: z.string().trim().min(2).max(40),
  additional_languages: z.array(z.string().trim().max(40)).max(10).default([]),
  gender: genderSchema.optional(),
  height_cm: z.coerce.number().positive().max(300).optional(),
  weight_kg: z.coerce.number().positive().max(500).optional(),
  body_fat_percent: z.coerce.number().min(1).max(70).optional(),
  skeletal_muscle_kg: z.coerce.number().positive().max(200).optional(),
  goal: z.string().trim().max(200).optional(),
  experience_level: experienceLevelSchema,
  injuries: z.string().trim().max(1000).optional(),
  agreement_accepted: z.literal(true),
});
export type TraineeOnboarding = z.infer<typeof traineeOnboardingSchema>;

export const trainerApplicationSchema = z.object({
  username: usernameSchema,
  display_name: z.string().trim().max(60).optional().default(""),
  full_legal_name: z.string().trim().max(120).optional().default(""),
  public_trainer_name: z.string().trim().max(60).optional().default(""),
  country: z.string().trim().max(80).optional().default(""),
  native_language: z.string().trim().max(40).optional().default(""),
  additional_languages: z.array(z.string().trim().max(40)).max(10).default([]),
  specialties: z.array(z.string().trim().max(40)).max(10).default([]),
  years_experience: z.coerce.number().int().min(0).max(70).optional().default(0),
  biography: z.string().trim().max(2000).optional().default(""),
  certification_details: z.string().trim().max(2000).optional().default(""),
  certificates: z.array(z.string().url()).max(10).default([]),
  id_doc_url: z.string().url().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  social_links: z.array(z.string().url()).max(10).default([]),
  requested_price: z.coerce.number().min(0).max(999).optional().default(19.99),
  payout_info: z.string().trim().max(500).optional(),
  agreement_accepted: z.literal(true),
});
export type TrainerApplication = z.infer<typeof trainerApplicationSchema>;

export const profileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  full_name: z.string().nullable(),
  avatar_url: z.string().url().nullable().or(z.literal("")),
  bio: z.string().nullable(),
});

export const adminBookingWithUserSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  class_id: z.string().uuid(),
  status: bookingStatusSchema,
  booked_at: datetimeWithOffset,
  class: sportsClassSchema,
  user: z.object({
    id: z.string().uuid(),
    email: z.string().email(),
    raw_user_meta_data: z.record(z.any()).nullable(),
  }),
});
