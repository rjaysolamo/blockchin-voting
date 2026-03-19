import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { ArrowLeft, Blocks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const StudentLoginPage = () => {
  const navigate = useNavigate();
  const { signIn } = useSupabaseAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);

      if (!error) {
        toast({
          title: 'Login successful',
          description: 'Welcome to the blockchain voting portal',
        });
        navigate('/student/blockchain-voting');
        return;
      }

      const errorMessage = error.message?.toLowerCase() || '';
      const isInvalidCredential = errorMessage.includes('invalid login credentials') || errorMessage.includes('invalid credentials');

      toast({
        title: 'Login failed',
        description: isInvalidCredential
          ? 'Invalid credentials or your email is not confirmed yet. Check your inbox/spam for the confirmation email.'
          : error.message || 'Unable to sign in right now',
        variant: 'destructive',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Network error while signing in';
      toast({
        title: 'Sign-in request failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="voting-card w-full max-w-md animate-fade-in">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Blocks className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Student Login</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Secure blockchain-powered voting
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="student@university.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Login'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link to="/student/register" className="text-primary hover:underline">
              Register here
            </Link>
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <Blocks className="w-4 h-4" />
            <span>Your vote is cryptographically secured</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentLoginPage;
