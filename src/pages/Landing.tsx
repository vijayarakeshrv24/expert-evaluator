import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Shield, CheckCircle, Zap, Lock } from 'lucide-react';
import Navbar from '@/components/Navbar';
import { useAuthStore } from '@/stores/authStore';

const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto text-center">
          <div className="animate-fade-in">
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="text-gradient">AI-Powered</span>
              <br />
              Project Evaluation
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Comprehensive hackathon project assessment with intelligent plagiarism detection
              and real-time monitoring
            </p>
            <div className="flex gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate(user ? '/dashboard' : '/auth')}
                className="gradient-primary text-white shadow-lg hover:shadow-glow transition-all"
              >
                {user ? 'Go to Dashboard' : 'Get Started'}
              </Button>
              <Button size="lg" variant="outline">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Choose Expert Evaluator?
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="p-6 gradient-card hover-lift border-primary/20">
              <Shield className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">AI Assessment</h3>
              <p className="text-muted-foreground">
                Advanced AI generates contextual questions based on your project
              </p>
            </Card>
            
            <Card className="p-6 gradient-card hover-lift border-secondary/20">
              <CheckCircle className="h-12 w-12 text-secondary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Plagiarism Detection</h3>
              <p className="text-muted-foreground">
                Comprehensive code analysis to ensure authenticity
              </p>
            </Card>
            
            <Card className="p-6 gradient-card hover-lift border-accent/20">
              <Zap className="h-12 w-12 text-accent mb-4" />
              <h3 className="text-xl font-semibold mb-2">Real-Time Monitoring</h3>
              <p className="text-muted-foreground">
                Camera verification ensures test integrity
              </p>
            </Card>
            
            <Card className="p-6 gradient-card hover-lift border-primary/20">
              <Lock className="h-12 w-12 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
              <p className="text-muted-foreground">
                Your data is encrypted and protected at all times
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto">
          <Card className="p-12 gradient-primary text-white text-center shadow-glow">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Validate Your Project?
            </h2>
            <p className="text-lg mb-8 opacity-90 max-w-2xl mx-auto">
              Join thousands of developers who trust Expert Evaluator for authentic project assessment
            </p>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate(user ? '/dashboard' : '/auth')}
              className="shadow-lg"
            >
              Start Assessment
            </Button>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Landing;
