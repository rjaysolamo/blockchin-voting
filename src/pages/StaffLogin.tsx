import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { useAuth } from '@/hooks/useAuth';
import { ArrowLeft, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

const StaffLogin = () => {
  const navigate = useNavigate();
  const { signIn } = useSupabaseAuth();
  const { login: mockLogin } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const mvpStaffEmail = 'staff@university.edu';
  const mvpStaffPassword = 'staff1234';

  useEffect(() => {
    if (window.location.hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const trimmedEmail = email.trim();
    
    // Check for MVP fallback first (bypass email validation)
    if (trimmedEmail === 'staff@university.edu' && password === 'staff1234') {
      mockLogin('staff', { email: trimmedEmail, password });
      toast({
        title: 'Login successful',
        description: 'Welcome to the attendance scanner (MVP Mode)',
      });
      navigate('/staff/dashboard');
      setIsLoading(false);
      return;
    }

    if (!trimmedEmail.includes('@')) {
      toast({
        title: 'Email required',
        description: 'Please sign in with your staff email address.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(trimmedEmail, password);
    if (!error) {
      mockLogin('staff', { email: trimmedEmail, password });
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (userId) {
        const { data: existingRole } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .eq('role', 'staff')
          .maybeSingle();

        if (!existingRole) {
          await supabase.from('user_roles').insert({
            user_id: userId,
            role: 'staff',
          });
        }
      }

      toast({
        title: 'Login successful',
        description: 'Welcome to the attendance scanner',
      });
      navigate('/staff/dashboard');
    } else {
      if (trimmedEmail.toLowerCase() === mvpStaffEmail && password === mvpStaffPassword) {
        mockLogin('staff', { email: trimmedEmail, password });
        toast({
          title: 'Login successful',
          description: 'Welcome to the attendance scanner',
        });
        navigate('/staff/dashboard');
      } else {
        toast({
          title: 'Login failed',
          description: error.message || 'Invalid credentials',
          variant: 'destructive',
        });
      }
    }
    
    setIsLoading(false);
  };

  const handleResetPassword = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail.includes('@')) {
      toast({
        title: 'Email required',
        description: 'Enter your staff email to reset your password.',
        variant: 'destructive',
      });
      return;
    }

    setIsResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      redirectTo: `${window.location.origin}/login/staff`,
    });

    if (error) {
      toast({
        title: 'Reset failed',
        description: error.message || 'Unable to send reset email.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Reset email sent',
        description: 'Check your inbox for a password reset link.',
      });
    }

    setIsResetting(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same.',
        variant: 'destructive',
      });
      return;
    }

    setIsResetting(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast({
        title: 'Update failed',
        description: error.message || 'Unable to update password.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Password updated',
        description: 'You can now log in with your new password.',
      });
      setIsRecovery(false);
      setNewPassword('');
      setConfirmPassword('');
      window.history.replaceState({}, document.title, '/login/staff');
    }

    setIsResetting(false);
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
            <QrCode className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Staff Login</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan attendance for campus events
          </p>
        </div>

        {isRecovery ? (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" size="lg" disabled={isResetting}>
              {isResetting ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="text"
              placeholder="staff@university.edu"
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

          <Button
            type="button"
            variant="link"
            size="sm"
            className="w-full"
            onClick={handleResetPassword}
            disabled={isResetting}
          >
            {isResetting ? 'Sending reset link...' : 'Forgot password?'}
          </Button>
        </form>
        )}
      </div>
    </div>
  );
};

export default StaffLogin;
