import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Users, QrCode, Search } from 'lucide-react';

const LoginSelection = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="voting-card w-full max-w-md text-center animate-fade-in">
        <div className="mb-8">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Web 2.5 Voting System</h1>
          <p className="text-muted-foreground">
            Secure, transparent elections with blockchain as an additional security layer
          </p>
        </div>

        <div className="space-y-4">
          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate('/login/admin')}
          >
            <Shield className="w-5 h-5" />
            Login as Admin
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => navigate('/login/student')}
          >
            <Users className="w-5 h-5" />
            Login as Student / Voter
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => navigate('/login/staff')}
          >
            <QrCode className="w-5 h-5" />
            Login as Event Staff
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() => navigate('/verify-vote')}
          >
            <Search className="w-5 h-5" />
            Verify a Vote
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">
          © 2026 University Election Commission
        </p>
      </div>
    </div>
  );
};

export default LoginSelection;
