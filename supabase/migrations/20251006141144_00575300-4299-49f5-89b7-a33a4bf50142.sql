-- Create enum for assessment status
CREATE TYPE assessment_status AS ENUM ('in_progress', 'completed', 'expired');

-- Create assessments table
CREATE TABLE public.assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  status assessment_status NOT NULL DEFAULT 'in_progress',
  total_score INTEGER,
  plagiarism_score INTEGER,
  plagiarism_report JSONB,
  assessment_result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT valid_scores CHECK (
    (total_score IS NULL OR (total_score >= 0 AND total_score <= 100)) AND
    (plagiarism_score IS NULL OR (plagiarism_score >= 0 AND plagiarism_score <= 100))
  )
);

-- Create questions table
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  question_number INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  user_answer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT valid_question_number CHECK (question_number >= 1 AND question_number <= 10)
);

-- Create project_files table to store uploaded file metadata
CREATE TABLE public.project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES public.assessments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  content_preview TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for assessments
CREATE POLICY "Users can view their own assessments"
  ON public.assessments FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own assessments"
  ON public.assessments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own assessments"
  ON public.assessments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for questions
CREATE POLICY "Users can view questions for their assessments"
  ON public.questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE assessments.id = questions.assessment_id
      AND assessments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert questions for their assessments"
  ON public.questions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE assessments.id = questions.assessment_id
      AND assessments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update questions for their assessments"
  ON public.questions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE assessments.id = questions.assessment_id
      AND assessments.user_id = auth.uid()
    )
  );

-- RLS Policies for project_files
CREATE POLICY "Users can view files for their assessments"
  ON public.project_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE assessments.id = project_files.assessment_id
      AND assessments.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert files for their assessments"
  ON public.project_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessments
      WHERE assessments.id = project_files.assessment_id
      AND assessments.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX idx_assessments_user_id ON public.assessments(user_id);
CREATE INDEX idx_assessments_status ON public.assessments(status);
CREATE INDEX idx_questions_assessment_id ON public.questions(assessment_id);
CREATE INDEX idx_project_files_assessment_id ON public.project_files(assessment_id);

-- Create function to update completed_at timestamp
CREATE OR REPLACE FUNCTION update_assessment_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for assessments
CREATE TRIGGER trigger_update_assessment_completed_at
BEFORE UPDATE ON public.assessments
FOR EACH ROW
EXECUTE FUNCTION update_assessment_completed_at();