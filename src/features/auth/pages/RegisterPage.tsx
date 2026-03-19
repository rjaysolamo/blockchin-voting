import { useCallback, useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabaseAuth } from '../hooks/useSupabaseAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Blocks, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { CreateStudentAccountInput, createStudentAccountWithAutoWallet } from '@/features/auth/lib/studentAccount';
import { useSmartWallet } from '@/hooks/useSmartWallet';
import { getEmbeddedSmartAccountAddress } from '@/lib/embeddedSmartAccountProvider';

const RegisterPage = () => {
  const navigate = useNavigate();
  const { signUp } = useSupabaseAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    studentId: '',
    department: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const { state: smartWalletState, enrollPasskey } = useSmartWallet();
  const [pendingAccountData, setPendingAccountData] = useState<CreateStudentAccountInput | null>(null);
  const [isEnrollmentInProgress, setIsEnrollmentInProgress] = useState(false);
  const [isSmartAccountSetup, setIsSmartAccountSetup] = useState(false);
  const [isSettingUpSmartAccount, setIsSettingUpSmartAccount] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleEnrollPasskeyClick = useCallback(async (): Promise<void> => {
    if (!pendingAccountData) {
      setSetupError('Complete the sign-up form first.');
      return;
    }

    setIsEnrollmentInProgress(true);
    try {
      await enrollPasskey();
    } finally {
      setIsEnrollmentInProgress(false);
    }
  }, [enrollPasskey, pendingAccountData]);

  const finalizeSmartAccountSetup = useCallback(async (): Promise<void> => {
    if (
      !pendingAccountData ||
      isSmartAccountSetup ||
      isSettingUpSmartAccount ||
      !smartWalletState.isEnrolled
    ) {
      return;
    }

    setIsSettingUpSmartAccount(true);
    setSetupError(null);

    try {
      const apiKey = import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined;
      if (!apiKey) {
        throw new Error('Missing VITE_ALCHEMY_API_KEY for smart account creation');
      }

      const { walletAddress } = await createStudentAccountWithAutoWallet(
        supabase,
        pendingAccountData,
        {
          getAddress: async (_email: string) =>
            getEmbeddedSmartAccountAddress({ apiKey, userId: pendingAccountData.userId }),
        }
      );

      const { error: bootstrapError, data: bootstrapData } = await supabase.functions.invoke(
        'onchain-bootstrap-voter',
        { body: {} }
      );
      if (bootstrapError || bootstrapData?.error) {
        throw new Error(
          bootstrapError?.message ||
            bootstrapData?.error ||
            'Failed to complete on-chain voter bootstrap'
        );
      }

      setIsSmartAccountSetup(true);
      toast({
        title: 'Smart account ready',
        description: `Wallet ${walletAddress} is linked and on-chain voter setup is complete.`,
      });
      navigate('/student/blockchain-voting');
    } catch (error) {
      setSetupError(
        error instanceof Error ? error.message : 'Failed to finalize smart account setup'
      );
    } finally {
      setIsSettingUpSmartAccount(false);
    }
  }, [
    pendingAccountData,
    isSmartAccountSetup,
    isSettingUpSmartAccount,
    smartWalletState.isEnrolled,
    toast,
    navigate,
  ]);

  useEffect(() => {
    if (
      pendingAccountData &&
      smartWalletState.isEnrolled &&
      !isSmartAccountSetup &&
      !isSettingUpSmartAccount
    ) {
      void finalizeSmartAccountSetup();
    }
  }, [
    pendingAccountData,
    smartWalletState.isEnrolled,
    isSmartAccountSetup,
    isSettingUpSmartAccount,
    finalizeSmartAccountSetup,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords are the same',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters',
        variant: 'destructive',
      });
      return;
    }

    const missingConfig: string[] = [];
    if (!(import.meta.env.VITE_ALCHEMY_API_KEY as string | undefined)) {
      missingConfig.push('VITE_ALCHEMY_API_KEY');
    }
    if (!(import.meta.env.VITE_ALCHEMY_ACCOUNT_POLICY_ID as string | undefined)) {
      missingConfig.push('VITE_ALCHEMY_ACCOUNT_POLICY_ID');
    }
    if (missingConfig.length > 0) {
      toast({
        title: 'Smart account configuration missing',
        description: `Set ${missingConfig.join(', ')} before registering students.`,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const { error, user, session, emailConfirmationSent } = await signUp(formData.email, formData.password, {
        full_name: formData.fullName,
        student_id: formData.studentId,
      });

      if (error) {
        toast({
          title: 'Registration failed',
          description: error.message || 'Unable to create account',
          variant: 'destructive',
        });
        return;
      }

      if (emailConfirmationSent) {
        toast({
          title: 'Confirmation email sent',
          description: 'Verify your email first, then log in to continue smart-account setup.',
        });
        navigate('/student/login');
        return;
      }

      if (user && session) {
        setPendingAccountData({
          userId: user.id,
          email: formData.email,
          fullName: formData.fullName,
          studentId: formData.studentId,
          department: formData.department,
        });
        setSetupError(null);
        setIsSmartAccountSetup(false);
      }

      toast({
        title: 'Email not sent (not required)',
        description: 'Account created with immediate access. Enroll a passkey to finalize your smart account.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="voting-card w-full max-w-md animate-fade-in">
        <button
          onClick={() => navigate('/student/login')}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </button>

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <UserPlus className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Student Registration</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create your account to vote
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              name="fullName"
              type="text"
              placeholder="John Smith"
              value={formData.fullName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="student@university.edu"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <Input
                id="studentId"
                name="studentId"
                type="text"
                placeholder="STU2026001"
                value={formData.studentId}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              <Input
                id="department"
                name="department"
                type="text"
                placeholder="Computer Science"
                value={formData.department}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="At least 6 characters"
              value={formData.password}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="Confirm your password"
              value={formData.confirmPassword}
              onChange={handleChange}
              autoComplete="new-password"
              required
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Register'}
          </Button>
        </form>

        {pendingAccountData && (
          <div className="mt-6 space-y-3 rounded-lg border border-dashed border-primary/30 bg-background/80 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-base font-semibold text-foreground">Passkey enrollment required</p>
                <p className="text-sm text-muted-foreground">
                  Enroll a passkey on this device so we can generate your smart account. Once saved,
                  the wallet address is stored and we automatically redirect you to voting.
                </p>
              </div>
              <Button
                size="sm"
                onClick={handleEnrollPasskeyClick}
                disabled={smartWalletState.isEnrolled || isEnrollmentInProgress}
              >
                {smartWalletState.isEnrolled
                  ? 'Passkey enrolled'
                  : isEnrollmentInProgress
                    ? 'Enrolling passkey…'
                    : 'Enroll passkey'}
              </Button>
            </div>

            {smartWalletState.isEnrolled && (
              <p className="text-sm text-emerald-600">
                Passkey stored. We are finalizing your smart account now.
              </p>
            )}

            {isSettingUpSmartAccount && (
              <p className="text-sm text-muted-foreground">Saving wallet address…</p>
            )}

            {setupError && (
              <p className="text-sm text-destructive">
                {setupError}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link to="/student/login" className="text-primary hover:underline">
              Login here
            </Link>
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
            <Blocks className="w-4 h-4" />
            <span>Your vote will be secured with blockchain technology</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
