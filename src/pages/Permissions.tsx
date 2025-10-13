import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Navbar from '@/components/Navbar';
import { useAuthStore } from '@/stores/authStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import { FaceRegistration } from '@/components/FaceRegistration';
import { supabase } from '@/integrations/supabase/client';
import { Camera, CheckCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const Permissions = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { permissions, setPermissions, currentAssessmentId, faceEmbedding, setFaceEmbedding } = useAssessmentStore();
  const [requesting, setRequesting] = useState(false);
  const [showFaceRegistration, setShowFaceRegistration] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  const handleGrantAccess = async () => {
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      stream.getTracks().forEach(track => track.stop());

      setPermissions({ camera: true, microphone: false });
      toast.success('Camera access granted. Please register your face.');
      setShowFaceRegistration(true);
    } catch (error) {
      toast.error('Camera access denied. Please enable camera to continue.');
      setPermissions({ camera: false, microphone: false });
    } finally {
      setRequesting(false);
    }
  };

  const handleFaceRegistrationComplete = async (embeddings: number[]) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('face_embedding')
        .eq('id', user?.id)
        .single();

      if (error) throw error;

      if (!profile?.face_embedding) {
        toast.error('No profile photo found. Please contact support.');
        return;
      }

      const storedEmbedding = profile.face_embedding as number[];
      const distance = calculateDistance(storedEmbedding, embeddings);

      if (distance > 0.6) {
        toast.error('Face does not match your profile photo. Only the registered user can take this assessment.');
        setShowFaceRegistration(false);
        return;
      }

      setFaceEmbedding(embeddings);
      setShowFaceRegistration(false);
      toast.success('Identity verified! You can now continue to the assessment.');
    } catch (error) {
      console.error('Error verifying face:', error);
      toast.error('Failed to verify identity');
    }
  };

  const calculateDistance = (embedding1: number[], embedding2: number[]): number => {
    let sum = 0;
    for (let i = 0; i < embedding1.length; i++) {
      const diff = embedding1[i] - embedding2[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  };

  const handleContinue = () => {
    if (!permissions.camera) {
      toast.error('Camera access is required to continue');
      return;
    }
    if (!faceEmbedding) {
      toast.error('Face registration is required to continue');
      return;
    }
    navigate('/questions');
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12 max-w-2xl">
        <div className="mb-8 animate-fade-in text-center">
          <h1 className="text-4xl font-bold mb-2">Permissions Required</h1>
          <p className="text-muted-foreground">
            We need access to your camera to verify your identity during the assessment
          </p>
        </div>

        <Card className="p-8 gradient-card">
          <div className="space-y-6">
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
              <Camera className="h-6 w-6 text-primary mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold mb-2">Camera Access</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Required for identity verification and test integrity
                </p>
                {permissions.camera ? (
                  <div className="flex items-center gap-2 text-accent">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Access Granted</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertCircle className="h-5 w-5" />
                    <span>Not Granted</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-primary" />
                Important Information
              </h4>
              <ul className="text-sm space-y-2 text-muted-foreground">
                <li>• Your camera feed is used only for verification</li>
                <li>• Face registration is required before starting</li>
                <li>• Multiple faces detected will pause the assessment</li>
                <li>• Only the registered user can take the assessment</li>
                <li>• Recordings are not stored permanently</li>
              </ul>
            </div>

            {showFaceRegistration && currentAssessmentId && (
              <FaceRegistration
                assessmentId={currentAssessmentId}
                onRegistrationComplete={handleFaceRegistrationComplete}
              />
            )}

            <div className="flex gap-4">
              {!permissions.camera && (
                <Button
                  onClick={handleGrantAccess}
                  disabled={requesting}
                  className="flex-1 gradient-primary text-white"
                >
                  {requesting ? 'Requesting...' : 'Grant Camera Access & Register Face'}
                </Button>
              )}
              {permissions.camera && !faceEmbedding && !showFaceRegistration && (
                <Button
                  onClick={() => setShowFaceRegistration(true)}
                  className="flex-1 gradient-primary text-white"
                >
                  Register Face
                </Button>
              )}
              <Button
                onClick={handleContinue}
                disabled={!permissions.camera || !faceEmbedding}
                className="flex-1 gradient-primary text-white"
              >
                Continue to Assessment
              </Button>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
};

export default Permissions;
