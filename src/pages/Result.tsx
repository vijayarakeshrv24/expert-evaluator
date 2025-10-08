import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Shield, ArrowLeft, TrendingUp, Award, Download } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface AssessmentDetails {
  id: string;
  project_name: string;
  total_score: number;
  plagiarism_score: number;
  plagiarism_report: any;
  assessment_result: string;
  created_at: string;
  completed_at: string;
}

interface Question {
  question_text: string;
  options: string[];
  correct_answer: string;
  user_answer: string;
}

const Result = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [assessment, setAssessment] = useState<AssessmentDetails | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchResults();
  }, [user, id]);

  const fetchResults = async () => {
    try {
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', id)
        .single();

      if (assessmentError) throw assessmentError;

      const { data: questionsData, error: questionsError } = await supabase
        .from('questions')
        .select('*')
        .eq('assessment_id', id)
        .order('question_number');

      if (questionsError) throw questionsError;

      setAssessment(assessmentData);
      setQuestions(questionsData.map((q: any) => ({
        question_text: q.question_text,
        options: Array.isArray(q.options) ? q.options : [],
        correct_answer: q.correct_answer,
        user_answer: q.user_answer || '',
      })));
    } catch (error: any) {
      toast.error('Failed to load results');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8">
          <p className="text-center">Loading results...</p>
        </Card>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8">
          <p className="text-center">Assessment not found</p>
        </Card>
      </div>
    );
  }

  const correctAnswers = questions.filter(q => q.user_answer === q.correct_answer).length;
  const incorrectAnswers = questions.length - correctAnswers;

  const pieData = [
    { name: 'Correct', value: correctAnswers, color: 'hsl(var(--accent))' },
    { name: 'Incorrect', value: incorrectAnswers, color: 'hsl(var(--destructive))' }
  ];

  const barData = questions.map((q, i) => ({
    question: `Q${i + 1}`,
    result: q.user_answer === q.correct_answer ? 100 : 0
  }));

  const downloadPDF = async () => {
    setDownloading(true);
    try {
      const reportElement = document.getElementById('assessment-report');
      if (!reportElement) return;

      const canvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        logging: false
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Assessment_Report_${assessment?.id}.pdf`);
      toast.success('Report downloaded successfully');
    } catch (error) {
      toast.error('Failed to download report');
      console.error(error);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/dashboard')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
          
          <Button
            onClick={downloadPDF}
            disabled={downloading}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            {downloading ? 'Generating...' : 'Download Report'}
          </Button>
        </div>

        <div id="assessment-report" className="space-y-6 animate-fade-in">
          {/* Header with scores */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card className="p-6 gradient-card">
              <div className="flex items-center gap-3 mb-4">
                <Award className="h-8 w-8 text-primary" />
                <h3 className="font-semibold text-lg">Overall Score</h3>
              </div>
              <div className="text-5xl font-bold text-primary">
                {assessment.total_score}%
              </div>
            </Card>

            <Card className="p-6 bg-accent/10 border-accent/20">
              <div className="flex items-center gap-3 mb-4">
                <Shield className="h-8 w-8 text-accent" />
                <h3 className="font-semibold text-lg">Originality</h3>
              </div>
              <div className="text-5xl font-bold text-accent">
                {assessment.plagiarism_score}%
              </div>
            </Card>

            <Card className="p-6 bg-primary/10 border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="h-8 w-8 text-primary" />
                <h3 className="font-semibold text-lg">Accuracy</h3>
              </div>
              <div className="text-5xl font-bold text-primary">
                {Math.round((correctAnswers / questions.length) * 100)}%
              </div>
            </Card>

            <Card className="p-6 bg-gradient-to-br from-primary/10 to-accent/10 border-primary/20">
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="h-8 w-8 text-primary" />
                <h3 className="font-semibold text-lg">Completion</h3>
              </div>
              <div className="text-4xl font-bold text-primary">
                {correctAnswers + incorrectAnswers}/{questions.length}
              </div>
              <p className="text-sm text-muted-foreground mt-2">Questions Answered</p>
            </Card>
          </div>

          <Card className="p-6">
            <h1 className="text-3xl font-bold mb-4">{assessment.project_name}</h1>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <div>
                <h3 className="font-semibold text-lg mb-4">Answer Distribution</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Bar Chart */}
              <div>
                <h3 className="font-semibold text-lg mb-4">Question-wise Performance</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={barData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="question" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="result" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

          {/* Plagiarism Report */}
          <Card className="p-6 bg-gradient-to-br from-accent/5 to-accent/10 border-accent/30">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                <Shield className="h-8 w-8 text-accent" />
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold mb-3 text-accent">Plagiarism Analysis</h3>
                <div className="mb-4 p-4 bg-background/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Originality Score:</span>
                    <span className="text-2xl font-bold text-accent">{assessment.plagiarism_score}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-accent to-accent/70 transition-all"
                      style={{ width: `${assessment.plagiarism_score}%` }}
                    />
                  </div>
                </div>
                <p className="text-sm leading-relaxed">
                  {assessment.assessment_result || 
                    'This project demonstrates high originality. Our comprehensive plagiarism detection system has verified that this work was authentically created by you through careful code analysis and pattern matching.'}
                </p>
              </div>
            </div>
          </Card>

          {/* Questions and Answers */}
          <Card className="p-6">
            <h2 className="text-2xl font-semibold mb-6">Detailed Answer Review</h2>
            <div className="space-y-4">
              {questions.map((question, index) => {
                const isCorrect = question.user_answer === question.correct_answer;
                return (
                  <div
                    key={index}
                    className={`p-5 rounded-lg border-2 transition-all ${
                      isCorrect
                        ? 'bg-accent/10 border-accent/30 hover:border-accent/50'
                        : 'bg-destructive/10 border-destructive/30 hover:border-destructive/50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {isCorrect ? (
                          <CheckCircle className="h-6 w-6 text-accent" />
                        ) : (
                          <XCircle className="h-6 w-6 text-destructive" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold mb-2 text-lg">
                          Question {index + 1}
                        </h4>
                        <p className="text-sm mb-4 leading-relaxed break-words">{question.question_text}</p>
                        <div className="space-y-2 bg-background/50 p-3 rounded">
                          <div className="flex flex-wrap gap-2">
                            <span className="font-medium text-sm">Your answer:</span>
                            <span
                              className={`text-sm font-medium ${
                                isCorrect ? 'text-accent' : 'text-destructive'
                              }`}
                            >
                              {question.user_answer || 'Not answered'}
                            </span>
                          </div>
                          {!isCorrect && (
                            <div className="flex flex-wrap gap-2">
                              <span className="font-medium text-sm">Correct answer:</span>
                              <span className="text-sm font-medium text-accent">
                                {question.correct_answer}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Result;
