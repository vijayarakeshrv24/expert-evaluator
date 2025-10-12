import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, CheckCircle, Shield, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface FaceVerificationProps {
  assessmentId: string;
  registeredEmbedding: number[];
  onViolation: (severity: 'warning' | 'critical') => void;
}

type VerificationStatus = 'verifying' | 'verified' | 'mismatch' | 'multiple_faces' | 'no_face';

export const FaceVerification = ({
  assessmentId,
  registeredEmbedding,
  onViolation
}: FaceVerificationProps) => {
  const webcamRef = useRef<Webcam>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('verifying');
  const [violationCount, setViolationCount] = useState(0);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastViolationRef = useRef<number>(0);

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
      startVerification();
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
    } catch (error) {
      console.error('Error loading models:', error);
      toast.error('Failed to load verification models');
    }
  };

  const startVerification = () => {
    detectionIntervalRef.current = setInterval(async () => {
      await verifyFace();
    }, 2000);
  };

  const verifyFace = async () => {
    if (!webcamRef.current || !modelsLoaded) return;

    const video = webcamRef.current.video;
    if (!video) return;

    try {
      const detections = await faceapi
        .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
        .withFaceLandmarks()
        .withFaceDescriptors();

      if (detections.length === 0) {
        handleViolation('no_face', 'warning', { message: 'No face detected' });
        setVerificationStatus('no_face');
      } else if (detections.length > 1) {
        handleViolation('multiple_faces', 'critical', { count: detections.length });
        setVerificationStatus('multiple_faces');
      } else {
        const currentDescriptor = Array.from(detections[0].descriptor);
        const distance = faceapi.euclideanDistance(registeredEmbedding, currentDescriptor);

        if (distance < 0.6) {
          setVerificationStatus('verified');
          if (violationCount > 0) {
            setViolationCount(0);
          }
        } else {
          handleViolation('face_mismatch', 'critical', { distance });
          setVerificationStatus('mismatch');
        }
      }
    } catch (error) {
      console.error('Verification error:', error);
    }
  };

  const handleViolation = (eventType: string, severity: 'warning' | 'critical', details: any) => {
    const now = Date.now();

    if (now - lastViolationRef.current < 5000) {
      return;
    }

    lastViolationRef.current = now;

    logProctorEvent(eventType, severity, details);

    const newCount = violationCount + 1;
    setViolationCount(newCount);

    if (severity === 'critical') {
      onViolation(severity);

      if (eventType === 'multiple_faces') {
        toast.error('Multiple faces detected! Assessment paused.');
      } else if (eventType === 'face_mismatch') {
        toast.error('Face mismatch detected! Assessment paused.');
      }
    } else {
      onViolation('warning');
      toast.warning(`Proctoring warning: ${eventType}`);
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

  const getStatusDisplay = () => {
    switch (verificationStatus) {
      case 'verifying':
        return {
          icon: Shield,
          text: 'Verifying identity...',
          color: 'text-blue-500',
          bg: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800'
        };
      case 'verified':
        return {
          icon: CheckCircle,
          text: 'Identity verified',
          color: 'text-green-500',
          bg: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800'
        };
      case 'no_face':
        return {
          icon: AlertCircle,
          text: 'No face detected',
          color: 'text-yellow-500',
          bg: 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800'
        };
      case 'multiple_faces':
        return {
          icon: XCircle,
          text: 'Multiple faces detected!',
          color: 'text-red-500',
          bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
        };
      case 'mismatch':
        return {
          icon: XCircle,
          text: 'Face mismatch detected!',
          color: 'text-red-500',
          bg: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800'
        };
      default:
        return {
          icon: Shield,
          text: 'Monitoring...',
          color: 'text-gray-500',
          bg: 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800'
        };
    }
  };

  const status = getStatusDisplay();
  const StatusIcon = status.icon;

  return (
    <div className="fixed top-20 right-4 z-50 w-80">
      <div className={`border ${status.bg} rounded-lg p-4 shadow-lg`}>
        <div className="flex items-center gap-2 mb-3">
          <StatusIcon className={`h-5 w-5 ${status.color}`} />
          <span className={`text-sm font-medium ${status.color}`}>{status.text}</span>
        </div>

        <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-3">
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/jpeg"
            videoConstraints={{
              width: 320,
              height: 240,
              facingMode: 'user',
            }}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="text-xs space-y-1 text-muted-foreground">
          <p>• Stay in frame during assessment</p>
          <p>• Only registered face allowed</p>
          <p>• Violations: {violationCount}</p>
        </div>

        {verificationStatus === 'mismatch' || verificationStatus === 'multiple_faces' ? (
          <div className="mt-3 p-2 bg-red-100 dark:bg-red-900 rounded text-xs text-red-900 dark:text-red-100">
            Assessment is paused. Please resolve the issue to continue.
          </div>
        ) : null}
      </div>
    </div>
  );
};
