/*
  # Add Proctoring System Tables

  1. New Tables
    - `face_embeddings`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `assessment_id` (uuid, references assessments)
      - `embedding_data` (jsonb) - stores face embedding vector
      - `registered_at` (timestamptz)
      - `created_at` (timestamptz)
    
    - `proctoring_logs`
      - `id` (uuid, primary key)
      - `assessment_id` (uuid, references assessments)
      - `user_id` (uuid, references auth.users)
      - `event_type` (text) - types: 'multiple_faces', 'face_mismatch', 'object_detected', 'bluetooth_active', 'face_not_found'
      - `severity` (text) - 'warning', 'violation'
      - `details` (jsonb) - additional event data
      - `timestamp` (timestamptz)
      - `created_at` (timestamptz)
    
    - `assessment_reports`
      - `id` (uuid, primary key)
      - `assessment_id` (uuid, references assessments, unique)
      - `user_id` (uuid, references auth.users)
      - `plagiarism_score` (integer) - 0-100
      - `code_quality_analysis` (jsonb)
      - `security_suggestions` (jsonb)
      - `performance_metrics` (jsonb)
      - `certificate_data` (jsonb)
      - `generated_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create face_embeddings table
CREATE TABLE IF NOT EXISTS public.face_embeddings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  embedding_data jsonb NOT NULL,
  registered_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create proctoring_logs table
CREATE TABLE IF NOT EXISTS public.proctoring_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  details jsonb DEFAULT '{}',
  timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Create assessment_reports table
CREATE TABLE IF NOT EXISTS public.assessment_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid REFERENCES public.assessments(id) ON DELETE CASCADE UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plagiarism_score integer DEFAULT 0,
  code_quality_analysis jsonb DEFAULT '{}',
  security_suggestions jsonb DEFAULT '{}',
  performance_metrics jsonb DEFAULT '{}',
  certificate_data jsonb DEFAULT '{}',
  generated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.face_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_reports ENABLE ROW LEVEL SECURITY;

-- Policies for face_embeddings
CREATE POLICY "Users can view own face embeddings"
  ON public.face_embeddings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own face embeddings"
  ON public.face_embeddings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own face embeddings"
  ON public.face_embeddings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policies for proctoring_logs
CREATE POLICY "Users can view own proctoring logs"
  ON public.proctoring_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own proctoring logs"
  ON public.proctoring_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policies for assessment_reports
CREATE POLICY "Users can view own assessment reports"
  ON public.assessment_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own assessment reports"
  ON public.assessment_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assessment reports"
  ON public.assessment_reports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_face_embeddings_user_id ON public.face_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_face_embeddings_assessment_id ON public.face_embeddings(assessment_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_logs_assessment_id ON public.proctoring_logs(assessment_id);
CREATE INDEX IF NOT EXISTS idx_proctoring_logs_user_id ON public.proctoring_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reports_assessment_id ON public.assessment_reports(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_reports_user_id ON public.assessment_reports(user_id);