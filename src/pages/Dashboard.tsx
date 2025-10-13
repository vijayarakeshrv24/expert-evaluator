import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/stores/authStore';
import { useAssessmentStore } from '@/stores/assessmentStore';
import Navbar from '@/components/Navbar';
import { toast } from 'sonner';
import { FileText, Plus, Clock, CheckCircle, XCircle, User } from 'lucide-react';

interface Assessment {
  id: string;
  project_name: string;
  status: string;
  total_score: number | null;
  created_at: string;
  completed_at: string | null;
}

interface Profile {
  username: string;
  profile_photo_url?: string;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { resetAssessment } = useAssessmentStore();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchAssessments();
  }, [user, navigate]);

  const fetchAssessments = async () => {
    try {
      const [assessmentsResult, profileResult] = await Promise.all([
        supabase
          .from('assessments')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('profiles')
          .select('username, profile_photo_url')
          .eq('id', user?.id)
          .single()
      ]);

      if (assessmentsResult.error) throw assessmentsResult.error;
      setAssessments(assessmentsResult.data || []);
      
      if (profileResult.data) {
        setProfile(profileResult.data);
      }
    } catch (error: any) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAssessment = () => {
    resetAssessment();
    navigate('/upload');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-accent" />;
      case 'in_progress':
        return <Clock className="h-5 w-5 text-primary" />;
      case 'expired':
        return <XCircle className="h-5 w-5 text-destructive" />;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 pt-24 pb-12">
        <div className="mb-8 animate-fade-in">
          <Card className="p-6 gradient-card mb-6">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                {profile?.profile_photo_url ? (
                  <img
                    src={profile.profile_photo_url}
                    alt={profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-2xl font-bold text-primary">
                    {profile?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold">{profile?.username || 'User'}</h1>
                <p className="text-muted-foreground">{user?.email}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="mb-8">
          <Button
            size="lg"
            onClick={handleStartAssessment}
            className="gradient-primary text-white shadow-lg hover:shadow-glow gap-2"
          >
            <Plus className="h-5 w-5" />
            Start New Assessment
          </Button>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Assessment History</h2>
          
          {loading ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">Loading...</p>
            </Card>
          ) : assessments.length === 0 ? (
            <Card className="p-8 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No assessments yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Start your first assessment to see it here
              </p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {assessments.map((assessment) => (
                <Card
                  key={assessment.id}
                  className="p-6 hover-lift cursor-pointer gradient-card"
                  onClick={() => navigate(`/result/${assessment.id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusIcon(assessment.status)}
                        <h3 className="text-xl font-semibold">
                          {assessment.project_name}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Created: {new Date(assessment.created_at).toLocaleDateString()}
                      </p>
                      {assessment.completed_at && (
                        <p className="text-sm text-muted-foreground">
                          Completed: {new Date(assessment.completed_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    
                    {assessment.total_score !== null && (
                      <div className="text-right">
                        <div className="text-3xl font-bold text-primary">
                          {assessment.total_score}%
                        </div>
                        <p className="text-sm text-muted-foreground">Score</p>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
