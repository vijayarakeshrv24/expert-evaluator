import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Loader2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from './ui/card';

interface FaceRegistrationProps {
  assessmentId: string;
  onRegistrationComplete: (embeddings: number[]) => void;
}

type DetectionStatus = 'loading' | 'no_face' | 'multiple_faces' | 'object_detected' | 'ready' | 'registered';

export const FaceRegistration = ({ assessmentId, onRegistrationComplete }: FaceRegistrationProps) => {
  const webcamRef = useRef<Webcam>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [detectionStatus, setDetectionStatus] = useState<DetectionStatus>('loading');
  const [isRegistering, setIsRegistering] = useState(false);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadModels();
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (modelsLoaded) {
      startDetection();
    }
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, [modelsLoaded]);

  const loadModels = async () => {
    try {
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      toast.success('Face detection models loaded');
    } catch (error) {
      console.error('Error loading models:', error);
      toast.error('Failed to load face detection models');
    }
  };

  const startDetection = () => {
    detectionIntervalRef.current = setInterval(async () => {
      await detectFace();
    }, 1000);
  };

  const detectFace = async () => {
    if (!webcamRef.current || !modelsLoaded || isRegistering) return;

    const video = webcamRef.current.video;
    if (!video) return;

    try {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        setDetectionStatus('no_face');
      } else if (detections.length > 1) {
        setDetectionStatus('multiple_faces');
        logProctorEvent('multiple_faces', 'warning', { count: detections.length });
      } else {
        setDetectionStatus('ready');
      }
    } catch (error) {
      console.error('Detection error:', error);
    }
  };

  const logProctorEvent = async (eventType: string, severity: string, details: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('proctoring_logs').insert({
        assessment_id: assessmentId,
        user_id: user.id,
        event_type: eventType,
        severity,
        details,
      });
    } catch (error) {
      console.error('Error logging proctor event:', error);
    }
  };

  const registerFace = async () => {
    if (!webcamRef.current || !modelsLoaded || detectionStatus !== 'ready') return;

    setIsRegistering(true);
    const video = webcamRef.current.video;
    if (!video) {
      setIsRegistering(false);
      return;
    }

    try {
      const detection = await faceapi
        .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (!detection) {
        toast.error('No face detected. Please try again.');
        setIsRegistering(false);
        return;
      }

      const descriptor = Array.from(detection.descriptor);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('User not authenticated');
        setIsRegistering(false);
        return;
      }

      const { error } = await supabase.from('face_embeddings').insert({
        user_id: user.id,
        assessment_id: assessmentId,
        embedding_data: descriptor,
      });

      if (error) throw error;

      setDetectionStatus('registered');
      toast.success('Face registered successfully');
      onRegistrationComplete(descriptor);

      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    } catch (error) {
      console.error('Error registering face:', error);
      toast.error('Failed to register face');
    } finally {
      setIsRegistering(false);
    }
  };

  const getStatusMessage = () => {
    switch (detectionStatus) {
      case 'loading':
        return { icon: Loader2, text: 'Loading face detection...', color: 'text-blue-500' };
      case 'no_face':
        return { icon: AlertCircle, text: 'No face detected. Please position yourself in the frame.', color: 'text-yellow-500' };
      case 'multiple_faces':
        return { icon: AlertCircle, text: 'Multiple faces detected! Only one person allowed.', color: 'text-red-500' };
      case 'object_detected':
        return { icon: AlertCircle, text: 'Unwanted object detected. Please remove phones or earbuds.', color: 'text-red-500' };
      case 'ready':
        return { icon: CheckCircle, text: 'Face detected. Ready to register.', color: 'text-green-500' };
      case 'registered':
        return { icon: UserCheck, text: 'Face registered successfully!', color: 'text-green-500' };
      default:
        return { icon: AlertCircle, text: 'Unknown status', color: 'text-gray-500' };
    }
  };

  const status = getStatusMessage();
  const StatusIcon = status.icon;

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Face Registration</h3>
          <div className={`flex items-center gap-2 ${status.color}`}>
            <StatusIcon className={`h-5 w-5 ${detectionStatus === 'loading' ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">{status.text}</span>
          </div>
        </div>

        <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
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

        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold mb-2 flex items-center gap-2 text-blue-900 dark:text-blue-100">
            <AlertCircle className="h-5 w-5" />
            Registration Instructions
          </h4>
          <ul className="text-sm space-y-1 text-blue-800 dark:text-blue-200">
            <li>• Ensure your face is clearly visible</li>
            <li>• Look directly at the camera</li>
            <li>• Make sure you are alone in the frame</li>
            <li>• Remove any phones or earbuds from the frame</li>
            <li>• Good lighting helps with accurate detection</li>
          </ul>
        </div>

        <button
          onClick={registerFace}
          disabled={detectionStatus !== 'ready' || isRegistering}
          className="w-full py-3 px-4 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
        >
          {isRegistering ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Registering...
            </span>
          ) : (
            'Register Face'
          )}
        </button>
      </div>
    </Card>
  );
};
