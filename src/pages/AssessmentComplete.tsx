import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import { useAuthStore } from '@/stores/authStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const AssessmentComplete = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { currentAssessmentId, questions, resetAssessment } = useAssessmentStore();
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (!currentAssessmentId) {
      navigate('/dashboard');
      return;
    }
    processResults();
  }, [user, currentAssessmentId]);

  const processResults = async () => {
    try {
      // Submit answers for evaluation
      const { data, error } = await supabase.functions.invoke('evaluate-assessment', {
        body: {
          assessmentId: currentAssessmentId,
          answers: questions.map((q) => ({
            questionId: q.id,
            userAnswer: q.userAnswer,
            correctAnswer: q.correctAnswer,
          })),
        },
      });

      if (error) throw error;

      // Update assessment status
      await supabase
        .from('assessments')
        .update({ status: 'completed' })
        .eq('id', currentAssessmentId);

      setProcessing(false);
      toast.success('Assessment completed successfully!');
    } catch (error: any) {
      toast.error('Failed to process assessment');
      console.error(error);
      setProcessing(false);
    }
  };

  const handleViewResults = () => {
    navigate(`/result/${currentAssessmentId}`);
    resetAssessment();
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        <Card className="p-12 text-center gradient-card animate-fade-in">
          {processing ? (
            <>
              <Loader2 className="h-16 w-16 text-primary mx-auto mb-6 animate-spin" />
              <h1 className="text-3xl font-bold mb-4">
                Processing Your Assessment
              </h1>
              <p className="text-muted-foreground mb-6">
                Our AI is evaluating your responses and checking for plagiarism...
              </p>
            </>
          ) : (
            <>
              <CheckCircle className="h-16 w-16 text-accent mx-auto mb-6" />
              <h1 className="text-3xl font-bold mb-4">
                Assessment Completed!
              </h1>
              <p className="text-muted-foreground mb-8">
                Your project has been successfully evaluated. Click below to view your results.
              </p>
              <div className="flex gap-4 justify-center">
                <Button
                  onClick={handleViewResults}
                  size="lg"
                  className="gradient-primary text-white"
                >
                  View Results
                </Button>
                <Button
                  onClick={() => {
                    resetAssessment();
                    navigate('/dashboard');
                  }}
                  size="lg"
                  variant="outline"
                >
                  Back to Dashboard
                </Button>
              </div>
            </>
          )}
        </Card>
      </main>
    </div>
  );
};

export default AssessmentComplete;
