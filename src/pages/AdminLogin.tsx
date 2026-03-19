import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { isValidEthereumAddress } from '@/lib/walletGenerator';
import { ArrowLeft, Shield, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const AdminLogin = () => {
  const navigate = useNavigate();
  const { loginWithWallet } = useAuth();
  const { state: walletState, connectWallet } = useWallet();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const requiredAdminWallet = (import.meta.env.VITE_ADMIN_DEPLOYER_WALLET || '').trim().toLowerCase();
  const hasValidAdminWalletConfig = isValidEthereumAddress(requiredAdminWallet);
  const connectedWallet = walletState.address?.toLowerCase() || '';
  const isAuthorizedAdminWallet = walletState.isConnected && connectedWallet === requiredAdminWallet;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasValidAdminWalletConfig) {
      toast({
        title: 'Admin wallet not configured',
        description: 'Set VITE_ADMIN_DEPLOYER_WALLET in your environment before signing in as admin.',
        variant: 'destructive',
      });
      return;
    }

    if (!walletState.isConnected) {
      toast({
        title: 'Wallet required',
        description: 'Connect the EVM wallet used to deploy the contract before admin login.',
        variant: 'destructive',
      });
      return;
    }

    if (!isAuthorizedAdminWallet) {
      toast({
        title: 'Unauthorized wallet',
        description: 'Connected wallet is not the configured contract creator/deployer account.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const success = await loginWithWallet('admin', connectedWallet);

      if (success) {
        toast({
          title: 'Admin wallet verified',
          description: 'Welcome back, Contract Admin',
        });
        navigate('/admin/dashboard');
        return;
      }

      toast({
        title: 'Login failed',
        description: 'Unable to authenticate admin wallet',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectWallet = async () => {
    try {
      const address = await connectWallet(requiredAdminWallet);
      const normalized = address.toLowerCase();

      if (normalized === requiredAdminWallet) {
        toast({
          title: 'Wallet connected',
          description: 'Deployer wallet matched. You can now enter the admin dashboard.',
        });
      } else {
        toast({
          title: 'Wallet connected',
          description: 'Connected account is not the deployer wallet. Switch account in MetaMask and reconnect.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect wallet.';
      toast({
        title: 'Wallet connection failed',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

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
            <Shield className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Admin Login</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Access the election management panel
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <div className="text-sm font-medium">Admin Deployer Wallet</div>
            <div className="rounded-md border border-border p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Required wallet</span>
                <span className="text-sm font-mono">
                  {hasValidAdminWalletConfig ? formatAddress(requiredAdminWallet) : 'Not configured'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-muted-foreground">Connected wallet</span>
                <span className="text-sm font-mono">
                  {walletState.address ? formatAddress(walletState.address) : 'Not connected'}
                </span>
              </div>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleConnectWallet}
                disabled={walletState.isConnecting}
              >
                <Wallet className="w-4 h-4 mr-2" />
                {walletState.isConnecting ? 'Connecting Wallet...' : walletState.isConnected ? 'Reconnect Wallet' : 'Connect Wallet'}
              </Button>
              {walletState.isConnected && !isAuthorizedAdminWallet && hasValidAdminWalletConfig && (
                <p className="text-xs text-destructive">Connected wallet does not match deployer account. Switch account in your wallet, then reconnect.</p>
              )}
              {!hasValidAdminWalletConfig && (
                <p className="text-xs text-destructive">`VITE_ADMIN_DEPLOYER_WALLET` is missing/invalid. Restart dev server after updating `.env`.</p>
              )}
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isLoading || !isAuthorizedAdminWallet || !hasValidAdminWalletConfig}
          >
            {isLoading ? 'Verifying...' : 'Enter Admin Dashboard'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
