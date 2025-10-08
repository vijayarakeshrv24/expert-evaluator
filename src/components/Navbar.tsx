import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/authStore';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Shield, LogOut, LayoutDashboard } from 'lucide-react';

const Navbar = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error('Failed to logout');
    } else {
      toast.success('Logged out successfully');
      navigate('/');
    }
  };

  return (
    <nav className="fixed top-0 w-full bg-card/80 backdrop-blur-lg border-b border-border z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 group">
          <Shield className="h-5 w-5 md:h-6 md:w-6 text-primary transition-transform group-hover:scale-110" />
          <span className="text-lg md:text-xl font-bold text-gradient">Expert Evaluator</span>
        </Link>
        
        <div className="flex items-center gap-2 md:gap-4">
          {user ? (
            <>
              <Button
                variant="ghost"
                onClick={() => navigate('/dashboard')}
                className="gap-1 md:gap-2 text-sm md:text-base"
                size="sm"
              >
                <LayoutDashboard className="h-4 w-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="gap-1 md:gap-2 text-sm md:text-base"
                size="sm"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </>
          ) : (
            <Button onClick={() => navigate('/auth')} size="sm">
              Login
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
