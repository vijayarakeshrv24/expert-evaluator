import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import Navbar from '@/components/Navbar';
import FaceDetection from '@/components/FaceDetection';
import { FaceVerification } from '@/components/FaceVerification';
import { useAuthStore } from '@/stores/authStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Questions = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    questions,
    setQuestions,
    currentQuestionIndex,
    setCurrentQuestionIndex,
    timeRemaining,
    setTimeRemaining,
    setUserAnswer,
    uploadedFiles,
    currentAssessmentId,
    setCurrentAssessmentId,
    faceEmbedding,
  } = useAssessmentStore();
  const [loading, setLoading] = useState(true);
  const [selectedAnswer, setSelectedAnswer] = useState('');
  const [violations, setViolations] = useState<string[]>([]);
  const [isMonitoringValid, setIsMonitoringValid] = useState(false);
  const [bluetoothWarning, setBluetoothWarning] = useState(false);
  const [assessmentPaused, setAssessmentPaused] = useState(false);

  const handleViolation = (type: 'multiple_faces' | 'no_face' | 'phone_detected') => {
    const messages = {
      multiple_faces: 'Multiple faces detected',
      no_face: 'No face detected',
      phone_detected: 'Mobile device detected'
    };

    if (!violations.includes(messages[type])) {
      setViolations(prev => [...prev, messages[type]]);
      toast.warning(messages[type]);
    }
  };

  const handleProctorViolation = (severity: 'warning' | 'critical') => {
    if (severity === 'critical') {
      setAssessmentPaused(true);
      setIsMonitoringValid(false);
      toast.error('Assessment paused due to proctoring violation. Please resolve the issue.');
    } else {
      if (!violations.includes('Proctoring warning')) {
        setViolations(prev => [...prev, 'Proctoring warning']);
      }
    }
  };

  const checkBluetooth = async () => {
    try {
      if ('bluetooth' in navigator) {
        const devices = await (navigator.bluetooth as any).getDevices();
        if (devices && devices.length > 0) {
          setBluetoothWarning(true);
          toast.error('Bluetooth devices detected! Please disable Bluetooth.');
        } else {
          setBluetoothWarning(false);
        }
      }
    } catch (error) {
      console.log('Bluetooth check not available');
    }
  };

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (uploadedFiles.length === 0) {
      navigate('/upload');
      return;
    }
    initializeAssessment();
  }, [user, navigate]);

  useEffect(() => {
    const bluetoothInterval = setInterval(checkBluetooth, 5000);
    checkBluetooth();
    return () => clearInterval(bluetoothInterval);
  }, []);

  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      handleNextQuestion();
    }
  }, [timeRemaining]);

  const initializeAssessment = async () => {
    try {
      // Create assessment
      const { data: assessment, error: assessmentError } = await supabase
        .from('assessments')
        .insert({
          user_id: user?.id,
          project_name: 'Test Project',
          status: 'in_progress',
        })
        .select()
        .single();

      if (assessmentError) throw assessmentError;
      setCurrentAssessmentId(assessment.id);

      // Generate questions using AI
      const fileContents = uploadedFiles
        .slice(0, 5)
        .map(f => `File: ${f.name}\n${f.content}`)
        .join('\n\n');

      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: {
          assessmentId: assessment.id,
          projectFiles: fileContents,
        },
      });

      if (error) throw error;
      
      if (data.questions) {
        setQuestions(data.questions);
      }
      setLoading(false);
    } catch (error: any) {
      toast.error('Failed to initialize assessment');
      console.error(error);
      navigate('/dashboard');
    }
  };

  const handleAnswerSelect = (answer: string) => {
    if (!isMonitoringValid) {
      toast.error('Cannot select answer - monitoring violation detected');
      return;
    }
    setSelectedAnswer(answer);
  };

  const handleNextQuestion = async () => {
    if (selectedAnswer) {
      setUserAnswer(currentQuestionIndex, selectedAnswer);
      
      // Update in database
      await supabase
        .from('questions')
        .update({ user_answer: selectedAnswer })
        .eq('id', questions[currentQuestionIndex].id);
    }

    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
      setSelectedAnswer('');
      setTimeRemaining(30);
    } else {
      navigate('/assessment-complete');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="p-8">
          <p className="text-center">Generating questions...</p>
        </Card>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-4xl">
        <div className="mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold">
              Question {currentQuestionIndex + 1} of {questions.length}
            </h1>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">
                {timeRemaining}s
              </div>
              <p className="text-sm text-muted-foreground">remaining</p>
            </div>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Card className="p-8 bg-gradient-to-br from-background via-primary/5 to-accent/5 border-primary/20 shadow-xl">
              <div className="mb-8">
                <div className="inline-block px-4 py-2 bg-primary/10 rounded-full mb-4">
                  <span className="text-sm font-semibold text-primary">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </span>
                </div>
                <h2 className="text-2xl md:text-3xl font-bold leading-relaxed">
                  {currentQuestion?.questionText}
                </h2>
              </div>
              
              <div className="space-y-4">
                {currentQuestion?.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(option)}
                    disabled={!isMonitoringValid}
                    className={`w-full text-left p-5 rounded-xl border-2 transition-all duration-300 ${
                      !isMonitoringValid
                        ? 'opacity-50 cursor-not-allowed bg-muted'
                        : selectedAnswer === option 
                        ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground border-primary shadow-lg scale-[1.02] transform' 
                        : 'bg-card hover:bg-accent/30 border-border hover:border-primary/50 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        selectedAnswer === option
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-primary/10 text-primary'
                      }`}>
                        {String.fromCharCode(65 + index)}
                      </div>
                      <span className={`text-base md:text-lg leading-relaxed pt-1 ${
                        selectedAnswer === option ? 'font-medium' : ''
                      }`}>
                        {option}
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              <Button
                onClick={handleNextQuestion}
                disabled={!selectedAnswer}
                className="w-full mt-8 h-14 text-lg font-semibold bg-gradient-to-r from-primary to-accent hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {currentQuestionIndex < questions.length - 1
                  ? 'Next Question →'
                  : 'Finish Assessment ✓'}
              </Button>
            </Card>
            
            {violations.length > 0 && (
              <Card className="p-4 bg-destructive/5 border-destructive/20">
                <h4 className="font-semibold text-destructive mb-2">Warnings ({violations.length})</h4>
                <ul className="text-sm space-y-1">
                  {violations.map((v, i) => (
                    <li key={i} className="text-destructive/80">• {v}</li>
                  ))}
                </ul>
              </Card>
            )}
            
            {bluetoothWarning && (
              <Card className="p-4 bg-destructive/5 border-destructive/20">
                <h4 className="font-semibold text-destructive mb-2">Bluetooth Alert</h4>
                <p className="text-sm text-destructive/80">Bluetooth is enabled. Please disable it.</p>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <FaceDetection
              onViolation={handleViolation}
              onValidityChange={setIsMonitoringValid}
            />
          </div>
        </div>

        {faceEmbedding && currentAssessmentId && (
          <FaceVerification
            assessmentId={currentAssessmentId}
            registeredEmbedding={faceEmbedding}
            onViolation={handleProctorViolation}
          />
        )}

        {assessmentPaused && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <Card className="p-8 max-w-md mx-4">
              <h3 className="text-2xl font-bold text-destructive mb-4">Assessment Paused</h3>
              <p className="text-muted-foreground mb-6">
                A proctoring violation has been detected. Please ensure:
              </p>
              <ul className="space-y-2 mb-6 text-sm">
                <li>• Only you are visible in the camera</li>
                <li>• No other people are in the frame</li>
                <li>• Your face matches the registered face</li>
                <li>• No phones or unauthorized devices are visible</li>
              </ul>
              <Button
                onClick={() => {
                  setAssessmentPaused(false);
                  setIsMonitoringValid(true);
                }}
                className="w-full"
              >
                Resume Assessment
              </Button>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Questions;
