import { useEffect } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import FileUpload from "./pages/FileUpload";
import Permissions from "./pages/Permissions";
import Questions from "./pages/Questions";
import AssessmentComplete from "./pages/AssessmentComplete";
import Result from "./pages/Result";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  const { setSession } = useAuthStore();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, [setSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/upload" element={<FileUpload />} />
            <Route path="/permissions" element={<Permissions />} />
            <Route path="/questions" element={<Questions />} />
            <Route path="/assessment-complete" element={<AssessmentComplete />} />
            <Route path="/result/:id" element={<Result />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
