import { create } from 'zustand';

export interface UploadedFile {
  name: string;
  path: string;
  size: number;
  content?: string;
}

export interface Question {
  id: string;
  questionNumber: number;
  questionText: string;
  options: string[];
  correctAnswer: string;
  userAnswer?: string;
}

export interface AssessmentState {
  currentAssessmentId: string | null;
  uploadedFiles: UploadedFile[];
  permissions: {
    camera: boolean;
    microphone: boolean;
  };
  questions: Question[];
  currentQuestionIndex: number;
  timeRemaining: number;
  isAssessmentComplete: boolean;
  
  setCurrentAssessmentId: (id: string | null) => void;
  setUploadedFiles: (files: UploadedFile[]) => void;
  setPermissions: (permissions: { camera: boolean; microphone: boolean }) => void;
  setQuestions: (questions: Question[]) => void;
  setCurrentQuestionIndex: (index: number) => void;
  setTimeRemaining: (time: number) => void;
  setUserAnswer: (questionIndex: number, answer: string) => void;
  setAssessmentComplete: (complete: boolean) => void;
  resetAssessment: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set) => ({
  currentAssessmentId: null,
  uploadedFiles: [],
  permissions: {
    camera: false,
    microphone: false,
  },
  questions: [],
  currentQuestionIndex: 0,
  timeRemaining: 30,
  isAssessmentComplete: false,
  
  setCurrentAssessmentId: (id) => set({ currentAssessmentId: id }),
  setUploadedFiles: (files) => set({ uploadedFiles: files }),
  setPermissions: (permissions) => set({ permissions }),
  setQuestions: (questions) => set({ questions }),
  setCurrentQuestionIndex: (index) => set({ currentQuestionIndex: index }),
  setTimeRemaining: (time) => set({ timeRemaining: time }),
  setUserAnswer: (questionIndex, answer) =>
    set((state) => ({
      questions: state.questions.map((q, i) =>
        i === questionIndex ? { ...q, userAnswer: answer } : q
      ),
    })),
  setAssessmentComplete: (complete) => set({ isAssessmentComplete: complete }),
  resetAssessment: () =>
    set({
      currentAssessmentId: null,
      uploadedFiles: [],
      questions: [],
      currentQuestionIndex: 0,
      timeRemaining: 30,
      isAssessmentComplete: false,
    }),
}));
