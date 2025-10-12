import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { CheckCircle, XCircle, Shield, ArrowLeft, TrendingUp, Award, Download, Lock, Sparkles, AlertTriangle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeCanvas } from 'qrcode.react';

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

interface AssessmentReport {
  plagiarism_score: number;
  code_quality_analysis: {
    architecture: string;
    codeOrganization: string;
    bestPractices: string;
    overallRating: number;
  };
  security_suggestions: string[];
  performance_metrics: {
    totalQuestions: number;
    correctAnswers: number;
    incorrectAnswers: number;
    score: number;
  };
  certificate_data: any;
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
  const [report, setReport] = useState<AssessmentReport | null>(null);
  const [generatingReport, setGeneratingReport] = useState(false);

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

      const { data: reportData, error: reportError } = await supabase
        .from('assessment_reports')
        .select('*')
        .eq('assessment_id', id)
        .maybeSingle();

      if (!reportError && reportData) {
        setReport({
          plagiarism_score: reportData.plagiarism_score,
          code_quality_analysis: reportData.code_quality_analysis,
          security_suggestions: reportData.security_suggestions,
          performance_metrics: reportData.performance_metrics,
          certificate_data: reportData.certificate_data,
        });
      }
    } catch (error: any) {
      toast.error('Failed to load results');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const generateAIReport = async () => {
    if (!assessment || !questions.length) return;

    setGeneratingReport(true);
    try {
      const { data: filesData } = await supabase
        .from('project_files')
        .select('file_name')
        .eq('assessment_id', id!);

      const projectFiles = filesData?.map(f => f.file_name) || [];

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/evaluate-assessment`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assessmentId: id,
          projectName: assessment.project_name,
          questions,
          projectFiles,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate report');

      const reportData = await response.json();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error: insertError } = await supabase
        .from('assessment_reports')
        .insert({
          assessment_id: id,
          user_id: user.id,
          plagiarism_score: reportData.plagiarismScore,
          code_quality_analysis: reportData.codeQualityAnalysis,
          security_suggestions: reportData.securitySuggestions,
          performance_metrics: reportData.performanceMetrics,
          certificate_data: {
            userName: user.email,
            projectName: assessment.project_name,
            score: reportData.score,
          },
        });

      if (insertError) throw insertError;

      setReport({
        plagiarism_score: reportData.plagiarismScore,
        code_quality_analysis: reportData.codeQualityAnalysis,
        security_suggestions: reportData.securitySuggestions,
        performance_metrics: reportData.performanceMetrics,
        certificate_data: {
          userName: user.email,
          projectName: assessment.project_name,
          score: reportData.score,
        },
      });

      toast.success('AI report generated successfully');
    } catch (error: any) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate AI report');
    } finally {
      setGeneratingReport(false);
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
      const certificateElement = document.getElementById('certificate-section');
      if (!reportElement || !certificateElement) return;

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();

      const reportCanvas = await html2canvas(reportElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const reportImgData = reportCanvas.toDataURL('image/png');
      const reportHeight = (reportCanvas.height * pdfWidth) / reportCanvas.width;
      pdf.addImage(reportImgData, 'PNG', 0, 0, pdfWidth, reportHeight);

      pdf.addPage();

      const certCanvas = await html2canvas(certificateElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const certImgData = certCanvas.toDataURL('image/png');
      const certHeight = (certCanvas.height * pdfWidth) / certCanvas.width;
      pdf.addImage(certImgData, 'PNG', 0, 0, pdfWidth, certHeight);

      pdf.save(`Assessment_Report_${assessment?.project_name}_${assessment?.id}.pdf`);
      toast.success('Report and certificate downloaded successfully');
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

          <div className="flex gap-2">
            {!report && (
              <Button
                onClick={generateAIReport}
                disabled={generatingReport}
                className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
              >
                <Sparkles className={`h-4 w-4 ${generatingReport ? 'animate-spin' : ''}`} />
                {generatingReport ? 'Generating AI Report...' : 'Generate AI Report'}
              </Button>
            )}
            <Button
              onClick={downloadPDF}
              disabled={downloading || !report}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {downloading ? 'Generating...' : 'Download Report & Certificate'}
            </Button>
          </div>
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

          {report && (
            <>
              <Card className="p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 border-blue-200 dark:border-blue-800">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-6 w-6 text-blue-600" />
                  <h2 className="text-2xl font-semibold">AI-Powered Code Quality Analysis</h2>
                </div>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2 flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        Architecture
                      </h3>
                      <p className="text-sm text-muted-foreground">{report.code_quality_analysis.architecture}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Code Organization</h3>
                      <p className="text-sm text-muted-foreground">{report.code_quality_analysis.codeOrganization}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Best Practices</h3>
                      <p className="text-sm text-muted-foreground">{report.code_quality_analysis.bestPractices}</p>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg">
                      <h3 className="font-semibold mb-2">Overall Rating</h3>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-cyan-600 h-2 rounded-full"
                            style={{ width: `${report.code_quality_analysis.overallRating * 10}%` }}
                          />
                        </div>
                        <span className="font-bold text-blue-600">{report.code_quality_analysis.overallRating}/10</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                <Card className="p-6 bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2 mb-4">
                    <Lock className="h-6 w-6 text-red-600" />
                    <h3 className="text-xl font-semibold">Security Suggestions</h3>
                  </div>
                  <ul className="space-y-2">
                    {report.security_suggestions.map((suggestion, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <span>{suggestion}</span>
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="p-6 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="h-6 w-6 text-green-600" />
                    <h3 className="text-xl font-semibold">Optimization Suggestions</h3>
                  </div>
                  <ul className="space-y-2">
                    {Array.isArray(report.security_suggestions) && report.security_suggestions.length > 0 ? (
                      report.security_suggestions.slice(0, 3).map((suggestion, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          <span>{suggestion}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-sm text-muted-foreground">No optimization suggestions at this time.</li>
                    )}
                  </ul>
                </Card>
              </div>
            </>
          )}
        </div>

        {report && (
          <div id="certificate-section" className="mt-8 bg-white p-12 rounded-lg shadow-2xl">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-8 border-b-4 border-blue-600 pb-6">
                <h1 className="text-5xl font-bold text-gray-900 mb-2">Certificate of Completion</h1>
                <p className="text-gray-600">Expert Evaluator Assessment System</p>
              </div>

              <div className="text-center space-y-6 mb-8">
                <p className="text-gray-700 text-lg">This is to certify that</p>
                <h2 className="text-4xl font-bold text-blue-600">{user?.email}</h2>
                <p className="text-gray-700 text-lg">has successfully completed the assessment for</p>
                <h3 className="text-3xl font-semibold text-gray-900">{assessment?.project_name}</h3>
              </div>

              <div className="grid grid-cols-3 gap-6 my-8 p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg">
                <div className="text-center">
                  <div className="text-4xl font-bold text-blue-600">{assessment?.total_score}%</div>
                  <div className="text-sm text-gray-600 mt-1">Overall Score</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-green-600">{report.plagiarism_score}%</div>
                  <div className="text-sm text-gray-600 mt-1">Originality</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-cyan-600">{report.code_quality_analysis.overallRating}/10</div>
                  <div className="text-sm text-gray-600 mt-1">Code Quality</div>
                </div>
              </div>

              <div className="flex justify-between items-end mt-12">
                <div className="text-center">
                  <div className="w-48 border-t-2 border-gray-400 pt-2">
                    <p className="text-sm text-gray-600">Date of Completion</p>
                    <p className="font-semibold text-gray-900">{new Date(assessment?.completed_at).toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="flex flex-col items-center">
                  <QRCodeCanvas
                    value={`${window.location.origin}/result/${assessment?.id}`}
                    size={120}
                    level="H"
                    includeMargin
                  />
                  <p className="text-xs text-gray-600 mt-2">Scan to verify</p>
                </div>

                <div className="text-center">
                  <div className="w-48 border-t-2 border-gray-400 pt-2">
                    <p className="text-sm text-gray-600">Verified by</p>
                    <p className="font-semibold text-gray-900">Expert Evaluator Assistant</p>
                    <p className="text-xs text-gray-600">(Gemini AI)</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center text-sm text-gray-500">
                <p>This certificate validates the completion and evaluation of the assessment</p>
                <p>Certificate ID: {assessment?.id}</p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Result;
