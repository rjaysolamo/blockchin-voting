import { ReactNode } from 'react';
import { Shield } from 'lucide-react';

interface AuthLayoutProps {
  children: ReactNode;
}

const AuthLayout = ({ children }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        {children}
        <p className="mt-8 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} Blockchain Voting System
        </p>
      </div>
    </div>
  );
};

export default AuthLayout;
