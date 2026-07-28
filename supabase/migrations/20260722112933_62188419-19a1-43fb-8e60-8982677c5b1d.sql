-- Phase 1: Remove LMS surface tables and dependencies
-- Drop child tables first, then parents

DROP TABLE IF EXISTS public.assignment_submissions CASCADE;
DROP TABLE IF EXISTS public.class_assignments CASCADE;
DROP TABLE IF EXISTS public.class_materials CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.sports_classes CASCADE;
DROP TABLE IF EXISTS public.fitness_categories CASCADE;
DROP TABLE IF EXISTS public.coaching_disputes CASCADE;
DROP TABLE IF EXISTS public.coaching_messages CASCADE;
DROP TABLE IF EXISTS public.coaching_requests CASCADE;
