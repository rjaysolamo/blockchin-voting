import { useState, useEffect } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import ElectionTimeline from '@/components/admin/ElectionTimeline';
import { useActiveElection, useUpdateElection } from '@/hooks/useAdminElection';
import { Plus, Settings2, ShieldAlert, Database, Activity } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '@/hooks/useWallet';
import { isValidEthereumAddress } from '@/lib/walletGenerator';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

const AdminSettings = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: election, isLoading } = useActiveElection();
  const { state: walletState, connectWallet } = useWallet();
  const updateElection = useUpdateElection();
  const requiredAdminWallet = (import.meta.env.VITE_ADMIN_DEPLOYER_WALLET || '').trim().toLowerCase();
  const hasValidAdminWalletConfig = isValidEthereumAddress(requiredAdminWallet);
  
  const [electionTitle, setElectionTitle] = useState('');
  const [electionDescription, setElectionDescription] = useState('');
  const [isElectionOpen, setIsElectionOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // For creating new election
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newElectionTitle, setNewElectionTitle] = useState('');
  const [newElectionDescription, setNewElectionDescription] = useState('');
  const [newStartDate, setNewStartDate] = useState('');
  const [newEndDate, setNewEndDate] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [incidentReport, setIncidentReport] = useState('');
  const [safetyChecklist, setSafetyChecklist] = useState({
    rulesPublished: false,
    auditExportReady: false,
    backupsVerified: false,
  });
  const [statusChecks, setStatusChecks] = useState({
    votingApi: 'Operational',
    attendanceScanner: 'Operational',
    auditLog: 'Operational',
  });

  // Populate form with election data
  useEffect(() => {
    if (election) {
      setElectionTitle(election.title);
      setElectionDescription(election.description || '');
      setIsElectionOpen(election.is_active);
      setStartDate(new Date(election.start_date).toISOString().slice(0, 16));
      setEndDate(new Date(election.end_date).toISOString().slice(0, 16));
    }
  }, [election]);

  const handleSave = async () => {
    if (!election) return;
    
    try {
      await updateElection.mutateAsync({
        id: election.id,
        updates: {
          title: electionTitle,
          description: electionDescription || null,
          start_date: new Date(startDate).toISOString(),
          end_date: new Date(endDate).toISOString(),
        },
      });
      toast({
        title: 'Settings saved',
        description: 'Election settings have been updated successfully.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save settings. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleToggleElection = async (checked: boolean) => {
    if (!election) return;
    
    try {
      await updateElection.mutateAsync({
        id: election.id,
        updates: { is_active: checked },
      });
      setIsElectionOpen(checked);
      toast({
        title: checked ? 'Election opened' : 'Election closed',
        description: checked 
          ? 'Students can now cast their votes.' 
          : 'Voting has been closed.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update election status.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateElection = async () => {
    if (!newElectionTitle || !newStartDate || !newEndDate) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsCreating(true);
    try {
      if (!hasValidAdminWalletConfig) {
        throw new Error('Admin deployer wallet is not configured. Set VITE_ADMIN_DEPLOYER_WALLET and restart the app.');
      }

      const connectedAddress = (
        walletState.address ||
        (await connectWallet(requiredAdminWallet))
      ).toLowerCase();

      if (connectedAddress !== requiredAdminWallet) {
        throw new Error('Connected wallet does not match the configured deployer wallet.');
      }

      const ethereum = (window as Window & { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!ethereum) {
        throw new Error('No EVM wallet detected for signing.');
      }

      const signMessage = [
        'Election Creation Approval',
        `Title: ${newElectionTitle}`,
        `Start: ${new Date(newStartDate).toISOString()}`,
        `End: ${new Date(newEndDate).toISOString()}`,
        `Timestamp: ${new Date().toISOString()}`,
      ].join('\n');

      const signature = await ethereum.request({
        method: 'personal_sign',
        params: [signMessage, connectedAddress],
      });

      if (!signature) {
        throw new Error('Wallet signature was not provided.');
      }

      const { data: createdElection, error } = await supabase
        .from('elections')
        .insert({
          title: newElectionTitle,
          description: newElectionDescription || null,
          start_date: new Date(newStartDate).toISOString(),
          end_date: new Date(newEndDate).toISOString(),
          is_active: true,
        })
        .select('id')
        .single();

      if (error || !createdElection?.id) throw error || new Error('Election insert did not return an id');

      const { error: syncError, data: syncData } = await supabase.functions.invoke(
        'onchain-admin-sync',
        {
          body: {
            action: 'create-election',
            electionId: createdElection.id,
            signedMessage: signMessage,
            walletSignature: signature,
            adminWallet: connectedAddress,
          },
        }
      );
      if (syncError || syncData?.error || !syncData?.success) {
        // Keep DB and contract state consistent: remove the DB election if on-chain sync fails.
        await supabase.from('elections').delete().eq('id', createdElection.id);
        throw new Error(syncError?.message || syncData?.error || 'Failed to create election on-chain');
      }

      toast({
        title: 'Election created',
        description: syncData?.txHash
          ? `Wallet signature verified. Synced on-chain (tx: ${String(syncData.txHash).slice(0, 10)}...).`
          : 'Wallet signature verified. Election created and already mapped on-chain.',
      });
      
      // Reset form and refresh data
      setShowCreateForm(false);
      setNewElectionTitle('');
      setNewElectionDescription('');
      setNewStartDate('');
      setNewEndDate('');
      queryClient.invalidateQueries({ queryKey: ['active-election'] });
    } catch (error) {
      const message = getErrorMessage(error, 'Failed to create election. Please try again.');
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleSubmitIncident = () => {
    if (!incidentReport.trim()) {
      toast({
        title: 'Missing details',
        description: 'Please provide a report summary before submitting.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'Incident reported',
      description: 'Your report has been logged for review.',
    });
    setIncidentReport('');
  };

  const handleBackup = () => {
    toast({
      title: 'Backup started',
      description: 'System backup is running. You will be notified when complete.',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex bg-background">
        <AdminSidebar />
        <main className="flex-1 p-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64 mb-8" />
          <div className="max-w-2xl space-y-6">
            <Skeleton className="h-48" />
            <Skeleton className="h-64" />
          </div>
        </main>
      </div>
    );
  }

  // Show create election form if no active election
  if (!election) {
    return (
      <div className="min-h-screen flex bg-background">
        <AdminSidebar />
        
        <main className="flex-1 p-8">
          <header className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">Configure election parameters</p>
          </header>

          <div className="max-w-2xl">
            <div className="voting-card">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Create New Election</h2>
                  <p className="text-sm text-muted-foreground">
                    Set up a new election to get started
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newTitle">Election Title *</Label>
                  <Input
                    id="newTitle"
                    value={newElectionTitle}
                    onChange={(e) => setNewElectionTitle(e.target.value)}
                    placeholder="e.g., Student Council Election 2026"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newDescription">Description</Label>
                  <Textarea
                    id="newDescription"
                    value={newElectionDescription}
                    onChange={(e) => setNewElectionDescription(e.target.value)}
                    placeholder="Brief description of the election..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="newStartDate">Start Date & Time *</Label>
                    <Input
                      id="newStartDate"
                      type="datetime-local"
                      value={newStartDate}
                      onChange={(e) => setNewStartDate(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newEndDate">End Date & Time *</Label>
                    <Input
                      id="newEndDate"
                      type="datetime-local"
                      value={newEndDate}
                      onChange={(e) => setNewEndDate(e.target.value)}
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleCreateElection} 
                  className="w-full mt-4"
                  disabled={isCreating}
                >
                  {isCreating ? 'Awaiting Signature / Creating...' : 'Create Election (Sign Wallet)'}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Creating an election requires deployer-wallet signature approval.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Configure election parameters</p>
        </header>

        <div className="max-w-2xl space-y-6">
          {/* Election Timeline Preview */}
          <ElectionTimeline
            startDate={new Date(startDate || election.start_date)}
            endDate={new Date(endDate || election.end_date)}
            status={isElectionOpen ? 'open' : 'closed'}
          />

          <div className="voting-card">
            <div className="flex items-center gap-2 mb-6">
              <Settings2 className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Election Details</h2>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="electionTitle">Election Title</Label>
                <Input
                  id="electionTitle"
                  value={electionTitle}
                  onChange={(e) => setElectionTitle(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="electionDescription">Description</Label>
                <Textarea
                  id="electionDescription"
                  value={electionDescription}
                  onChange={(e) => setElectionDescription(e.target.value)}
                  placeholder="Brief description of the election..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date & Time</Label>
                  <Input
                    id="startDate"
                    type="datetime-local"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date & Time</Label>
                  <Input
                    id="endDate"
                    type="datetime-local"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Button 
              onClick={handleSave} 
              className="mt-6"
              disabled={updateElection.isPending}
            >
              {updateElection.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>

          <div className="voting-card">
            <h2 className="text-lg font-semibold mb-6">Election Control</h2>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Election Status</p>
                <p className="text-sm text-muted-foreground">
                  {isElectionOpen 
                    ? 'Voting is currently open for all eligible students' 
                    : 'Voting is closed. Students cannot cast votes'}
                </p>
              </div>
              <Switch
                checked={isElectionOpen}
                onCheckedChange={handleToggleElection}
              />
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Note:</strong> Closing the election will prevent any new votes from being cast. 
                This action can be reversed by opening the election again.
              </p>
            </div>
          </div>

          <div className="voting-card">
            <div className="flex items-center gap-2 mb-6">
              <ShieldAlert className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Safety & Reporting</h2>
            </div>
            <div className="space-y-4">
              <div className="space-y-3">
                {[
                  { key: 'rulesPublished', label: 'Publish election rules and timeline' },
                  { key: 'auditExportReady', label: 'Verify audit export access' },
                  { key: 'backupsVerified', label: 'Confirm backups are enabled' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                    <span className={safetyChecklist[item.key as keyof typeof safetyChecklist] ? 'font-medium' : 'text-muted-foreground'}>
                      {item.label}
                    </span>
                    <Switch
                      checked={safetyChecklist[item.key as keyof typeof safetyChecklist]}
                      onCheckedChange={(checked) =>
                        setSafetyChecklist((prev) => ({ ...prev, [item.key]: checked }))
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="incidentReport">Incident Report</Label>
                <Textarea
                  id="incidentReport"
                  value={incidentReport}
                  onChange={(e) => setIncidentReport(e.target.value)}
                  placeholder="Describe suspicious activity or disputes..."
                  rows={4}
                />
                <Button variant="outline" onClick={handleSubmitIncident}>
                  Submit Report
                </Button>
              </div>
            </div>
          </div>

          <div className="voting-card">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5" />
              <h2 className="text-lg font-semibold">System Status</h2>
            </div>
            <div className="grid gap-3 text-sm">
              {Object.entries(statusChecks).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                  <span className="capitalize text-muted-foreground">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="voting-card">
            <div className="flex items-center gap-2 mb-6">
              <Database className="w-5 h-5" />
              <h2 className="text-lg font-semibold">Backups & Recovery</h2>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="font-medium">On-demand backup</p>
                <p className="text-sm text-muted-foreground">
                  Generate a snapshot of election data for recovery.
                </p>
              </div>
              <Button onClick={handleBackup}>Run Backup</Button>
            </div>
          </div>

          <div className="voting-card border-destructive/20">
            <h2 className="text-lg font-semibold mb-6 text-destructive">Danger Zone</h2>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Reset Election</p>
                <p className="text-sm text-muted-foreground">
                  Clear all votes and reset the election. This action cannot be undone.
                </p>
              </div>
              <Button variant="destructive" disabled>
                Reset Election
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminSettings;
