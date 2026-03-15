import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Blocks, UserPlus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateSimpleWalletAddress } from '@/lib/walletGenerator';

const StudentRegister = () => {
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

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

    setIsLoading(true);

    // Include all user metadata in the signup call
    const { error } = await signUp(formData.email, formData.password, {
      full_name: formData.fullName,
      student_id: formData.studentId,
      department: formData.department,
    });
    
    if (!error) {
      // Generate automatic wallet address for the user
      const walletAddress = generateSimpleWalletAddress(formData.email);
      
      toast({
        title: 'Registration successful',
        description: `Welcome to the blockchain voting system! Check your email to confirm your account. Your wallet address ${walletAddress.address} will be automatically assigned.`,
      });
      
      // Navigate to login page instead of directly to voting
      // The profile and role assignment will be handled by a database trigger or backend function
      navigate('/student/login');
    } else {
      toast({
        title: 'Registration failed',
        description: error.message || 'Unable to create account',
        variant: 'destructive',
      });
    }
    
    setIsLoading(false);
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
              required
            />
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
            {isLoading ? 'Creating Account...' : 'Register'}
          </Button>
        </form>

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

export default StudentRegister;
