import { useEffect, useRef, useState } from 'react';
import Webcam from 'react-webcam';
import * as faceapi from 'face-api.js';
import { AlertTriangle, Camera, CheckCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';

interface FaceDetectionProps {
  onViolation?: (type: 'multiple_faces' | 'no_face' | 'phone_detected') => void;
  onValidityChange?: (isValid: boolean) => void;
}

const FaceDetection = ({ onViolation, onValidityChange }: FaceDetectionProps) => {
  const webcamRef = useRef<Webcam>(null);
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [faceCount, setFaceCount] = useState(0);
  const [warning, setWarning] = useState<string | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    loadModels();
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
    };
  }, []);

  const loadModels = async () => {
    try {
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      ]);
      setModelsLoaded(true);
      startDetection();
    } catch (error) {
      console.error('Error loading face detection models:', error);
    }
  };

  const startDetection = () => {
    detectionIntervalRef.current = setInterval(async () => {
      if (webcamRef.current?.video?.readyState === 4) {
        const video = webcamRef.current.video;
        const detections = await faceapi
          .detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks();

        setFaceCount(detections.length);

        if (detections.length === 0) {
          setWarning('No face detected! Please stay in frame.');
          onViolation?.('no_face');
          onValidityChange?.(false);
        } else if (detections.length > 1) {
          setWarning('Multiple faces detected! Only one person allowed.');
          onViolation?.('multiple_faces');
          onValidityChange?.(false);
        } else {
          setWarning(null);
          onValidityChange?.(true);
        }
      }
    }, 2000);
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Camera className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Live Monitor</h3>
        {modelsLoaded && faceCount === 1 && !warning && (
          <CheckCircle className="h-4 w-4 text-accent ml-auto" />
        )}
      </div>
      
      <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/jpeg"
          className="w-full h-full object-cover"
          videoConstraints={{
            width: 640,
            height: 480,
            facingMode: "user"
          }}
        />
        
        {modelsLoaded && (
          <div className="absolute top-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
            {faceCount === 1 ? '✓ Verified' : `${faceCount} face(s)`}
          </div>
        )}
      </div>

      {warning && (
        <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-semibold text-destructive">Warning</p>
              <p className="text-destructive/80">{warning}</p>
            </div>
          </div>
        </div>
      )}
      
      {!modelsLoaded && (
        <p className="text-xs text-muted-foreground mt-2">Loading detection models...</p>
      )}
    </Card>
  );
};

export default FaceDetection;
