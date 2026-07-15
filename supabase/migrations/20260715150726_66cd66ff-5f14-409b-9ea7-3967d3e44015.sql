
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'manager';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'verification_partner';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'viewer';
ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'kyc_uploaded';
ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'noc_initiated';
ALTER TYPE public.registration_status ADD VALUE IF NOT EXISTS 'noc_completed';

DO $$ BEGIN CREATE TYPE public.verification_status AS ENUM (
  'pending_assignment','assigned','in_progress','additional_documents_required',
  'on_hold','approved','rejected','completed'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.kyc_document_type AS ENUM (
  'aadhaar','pan','passport','driving_license','property_tax_receipt',
  'electricity_bill','property_documents','photograph','other'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN CREATE TYPE public.verification_document_type AS ENUM (
  'noc_certificate','police_verification','site_visit_photo','supporting'
); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
