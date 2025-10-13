import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, Camera, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [faceEmbedding, setFaceEmbedding] = useState<number[] | null>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!isLogin) {
      loadModels();
    }
  }, [isLogin]);

  const loadModels = async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
    } catch (error) {
      console.error('Error loading face detection models:', error);
    }
  };

  const capturePhoto = async () => {
    if (!webcamRef.current || !modelsLoaded) {
      toast.error('Camera not ready. Please try again.');
      return;
    }

    const imageSrc = webcamRef.current.getScreenshot();
    if (!imageSrc) {
      toast.error('Failed to capture photo');
      return;
    }

    try {
      const img = await faceapi.fetchImage(imageSrc);
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error('No face detected. Please ensure your face is clearly visible.');
        return;
      }

      const descriptor = Array.from(detection.descriptor);
      setFaceEmbedding(descriptor);
      setProfilePhoto(imageSrc);
      setShowCamera(false);
      toast.success('Profile photo captured successfully!');
    } catch (error) {
      console.error('Error processing photo:', error);
      toast.error('Failed to process photo');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        toast.success('Logged in successfully');
        navigate('/dashboard');
      } else {
        if (!username.trim()) {
          toast.error('Username is required');
          setLoading(false);
          return;
        }

        if (!profilePhoto || !faceEmbedding) {
          toast.error('Profile photo is required for identity verification');
          setLoading(false);
          return;
        }

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              username: username.trim(),
            },
          },
        });

        if (signUpError) throw signUpError;

        if (authData.user) {
          const blob = await (await fetch(profilePhoto)).blob();
          const fileName = `${authData.user.id}/profile.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('profile-photos')
            .upload(fileName, blob, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) {
            console.error('Error uploading photo:', uploadError);
          }

          const { data: urlData } = supabase.storage
            .from('profile-photos')
            .getPublicUrl(fileName);

          await supabase
            .from('profiles')
            .update({
              profile_photo_url: urlData.publicUrl,
              face_embedding: faceEmbedding,
            })
            .eq('id', authData.user.id);
        }

        toast.success('Account created! Please check your email to confirm.');
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 gradient-hero">
      <Card className="w-full max-w-md p-8 shadow-lg animate-fade-in">
        <div className="flex justify-center mb-6">
          <Shield className="h-12 w-12 text-primary" />
        </div>
        
        <h1 className="text-3xl font-bold text-center mb-2">
          {isLogin ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className="text-center text-muted-foreground mb-6">
          {isLogin ? 'Sign in to continue' : 'Sign up to get started'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Choose a username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required={!isLogin}
                minLength={3}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {!isLogin && (
            <div className="space-y-2">
              <Label>Profile Photo (Required)</Label>
              {!profilePhoto ? (
                <div className="space-y-2">
                  {!showCamera ? (
                    <Button
                      type="button"
                      onClick={() => setShowCamera(true)}
                      className="w-full"
                      variant="outline"
                    >
                      <Camera className="h-4 w-4 mr-2" />
                      Take Profile Photo
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                        <Webcam
                          ref={webcamRef}
                          audio={false}
                          screenshotFormat="image/jpeg"
                          videoConstraints={{
                            width: 640,
                            height: 480,
                            facingMode: 'user',
                          }}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={capturePhoto}
                          className="flex-1"
                          disabled={!modelsLoaded}
                        >
                          <Camera className="h-4 w-4 mr-2" />
                          {modelsLoaded ? 'Capture Photo' : 'Loading...'}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => setShowCamera(false)}
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Ensure your face is clearly visible and well-lit
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
                    <img
                      src={profilePhoto}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2 bg-green-500 text-white p-2 rounded-full">
                      <Check className="h-4 w-4" />
                    </div>
                  </div>
                  <Button
                    type="button"
                    onClick={() => {
                      setProfilePhoto(null);
                      setFaceEmbedding(null);
                      setShowCamera(true);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Retake Photo
                  </Button>
                </div>
              )}
            </div>
          )}

          <Button
            type="submit"
            className="w-full gradient-primary text-white"
            disabled={loading || (!isLogin && !profilePhoto)}
          >
            {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Sign Up'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-primary hover:underline"
          >
            {isLogin
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </Card>
    </div>
  );
};

export default Auth;
