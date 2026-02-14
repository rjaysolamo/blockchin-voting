import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, User, Filter, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import DeleteConfirmDialog from '@/components/admin/DeleteConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  useActiveElection,
  useElectionCandidates,
  useCreateCandidate,
  useUpdateCandidate,
  useDeleteCandidate,
} from '@/hooks/useAdminElection';
import { DbCandidate } from '@/@types/blockchain';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const AdminCandidates = () => {
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<string[]>([]);
  
  // Get active election and candidates
  const { data: election, isLoading: electionLoading } = useActiveElection();
  const { data: candidates = [], isLoading: candidatesLoading } = useElectionCandidates(election?.id);
  
  // Mutations
  const createCandidate = useCreateCandidate();
  const updateCandidate = useUpdateCandidate();
  const deleteCandidate = useDeleteCandidate();
  
  // Dialog states
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<DbCandidate | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    position: '',
    department: '',
    year_level: '',
    manifesto: '',
    photo_url: '',
  });

  const isLoading = electionLoading || candidatesLoading;

  // Get unique positions for suggestions and filters
  const positions = [...new Set(candidates.map((c) => c.position))];

  const filteredCandidates = candidates.filter(
    (candidate) => {
      const matchesSearch = 
        candidate.name.toLowerCase().includes(search.toLowerCase()) ||
        candidate.position.toLowerCase().includes(search.toLowerCase()) ||
        (candidate.department && candidate.department.toLowerCase().includes(search.toLowerCase()));
      
      const matchesPosition = positionFilter.length === 0 || positionFilter.includes(candidate.position);
      
      return matchesSearch && matchesPosition;
    }
  );

  const handleAddCandidate = () => {
    setSelectedCandidate(null);
    setFormData({
      name: '',
      position: '',
      department: '',
      year_level: '',
      manifesto: '',
      photo_url: '',
    });
    setFormDialogOpen(true);
  };

  const handleEditCandidate = (candidate: DbCandidate) => {
    setSelectedCandidate(candidate);
    setFormData({
      name: candidate.name,
      position: candidate.position,
      department: candidate.department || '',
      year_level: candidate.year_level || '',
      manifesto: candidate.manifesto || '',
      photo_url: candidate.photo_url || '',
    });
    setFormDialogOpen(true);
  };

  const handleDeleteClick = (candidate: DbCandidate) => {
    setSelectedCandidate(candidate);
    setDeleteDialogOpen(true);
  };

  const handleSaveCandidate = async () => {
    if (!election?.id) return;
    
    try {
      if (selectedCandidate) {
        await updateCandidate.mutateAsync({
          id: selectedCandidate.id,
          updates: {
            name: formData.name,
            position: formData.position,
            department: formData.department || null,
            year_level: formData.year_level || null,
            manifesto: formData.manifesto || null,
            photo_url: formData.photo_url || null,
          },
        });
        toast({
          title: 'Candidate updated',
          description: `${formData.name} has been updated successfully.`,
        });
      } else {
        await createCandidate.mutateAsync({
          election_id: election.id,
          name: formData.name,
          position: formData.position,
          department: formData.department || undefined,
          year_level: formData.year_level || undefined,
          manifesto: formData.manifesto || undefined,
          photo_url: formData.photo_url || undefined,
        });
        toast({
          title: 'Candidate added',
          description: `${formData.name} has been added as a candidate.`,
        });
      }
      setFormDialogOpen(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save candidate. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCandidate || !election?.id) return;
    
    try {
      await deleteCandidate.mutateAsync({
        id: selectedCandidate.id,
        electionId: election.id,
      });
      toast({
        title: 'Candidate deleted',
        description: `${selectedCandidate.name} has been removed.`,
      });
      setDeleteDialogOpen(false);
      setSelectedCandidate(null);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete candidate. Please try again.',
        variant: 'destructive',
      });
    }
  };

  if (!election && !electionLoading) {
    return (
      <div className="min-h-screen flex bg-background">
        <AdminSidebar />
        <main className="flex-1 p-8">
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <User className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-xl font-semibold">No Active Election</h2>
            <p className="text-muted-foreground">Create an election in Settings first.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">Candidates</h1>
              <p className="text-muted-foreground mt-1">Manage election candidates and their information</p>
            </div>
            <Button onClick={handleAddCandidate} disabled={!election} size="lg" className="shadow-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Candidate
            </Button>
          </header>

          <Card className="border-none shadow-md bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle className="text-lg font-medium">Candidate List</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by name, position, or dept..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 bg-background"
                    />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="shrink-0">
                        <Filter className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Filter by Position</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {positions.map((pos) => (
                        <DropdownMenuCheckboxItem
                          key={pos}
                          checked={positionFilter.includes(pos)}
                          onCheckedChange={(checked) => {
                            setPositionFilter(prev => 
                              checked 
                                ? [...prev, pos] 
                                : prev.filter(p => p !== pos)
                            );
                          }}
                        >
                          {pos}
                        </DropdownMenuCheckboxItem>
                      ))}
                      {positions.length === 0 && (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                          No positions available
                        </div>
                      )}
                      {positionFilter.length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full justify-center text-xs"
                            onClick={() => setPositionFilter([])}
                          >
                            Clear Filters
                          </Button>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <CardDescription>
                Showing {filteredCandidates.length} of {candidates.length} candidates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center space-x-4">
                      <Skeleton className="h-12 w-12 rounded-full" />
                      <div className="space-y-2">
                        <Skeleton className="h-4 w-[250px]" />
                        <Skeleton className="h-4 w-[200px]" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="w-[80px]">Photo</TableHead>
                        <TableHead>Candidate</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Stats</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCandidates.map((candidate) => (
                        <TableRow key={candidate.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell>
                            <Avatar className="h-10 w-10 border shadow-sm">
                              <AvatarImage src={candidate.photo_url} alt={candidate.name} />
                              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                                {candidate.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium text-foreground">{candidate.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {candidate.year_level || 'No year level'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-medium">
                              {candidate.position}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {candidate.department || '—'}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground">{candidate.vote_count}</span>
                              <span className="text-xs text-muted-foreground">votes</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditCandidate(candidate)}
                                className="h-8 w-8 text-muted-foreground hover:text-primary"
                              >
                                <Pencil className="w-4 h-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                onClick={() => handleDeleteClick(candidate)}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </div>
                          </TableCell>
                      </TableRow>
                      ))}

                      {filteredCandidates.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-[400px] text-center">
                            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground">
                              <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mb-2">
                                <User className="h-6 w-6" />
                              </div>
                              <p className="text-lg font-medium text-foreground">No candidates found</p>
                              <p className="text-sm">
                                {search || positionFilter.length > 0
                                  ? "Try adjusting your search or filters"
                                  : "Get started by adding a candidate"}
                              </p>
                              {(search || positionFilter.length > 0) && (
                                <Button 
                                  variant="link" 
                                  onClick={() => {
                                    setSearch('');
                                    setPositionFilter([]);
                                  }}
                                  className="mt-2"
                                >
                                  Clear all filters
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add/Edit Dialog */}
      <Dialog open={formDialogOpen} onOpenChange={setFormDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selectedCandidate ? 'Edit Candidate' : 'Add New Candidate'}
            </DialogTitle>
            <DialogDescription>
              {selectedCandidate 
                ? 'Update candidate details below.' 
                : 'Fill in the details to register a new candidate.'}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name" className="font-semibold">Full Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Juan Dela Cruz"
                className="col-span-3"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="position" className="font-semibold">Position *</Label>
                <div className="relative">
                  <Input
                    id="position"
                    value={formData.position}
                    onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                    placeholder="e.g. President"
                    list="positions"
                  />
                  <datalist id="positions">
                    {positions.map((pos) => (
                      <option key={pos} value={pos} />
                    ))}
                  </datalist>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="year_level" className="font-semibold">Year Level</Label>
                <Input
                  id="year_level"
                  value={formData.year_level}
                  onChange={(e) => setFormData(prev => ({ ...prev, year_level: e.target.value }))}
                  placeholder="e.g. 4th Year"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="department" className="font-semibold">Department</Label>
              <Input
                id="department"
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                placeholder="e.g. College of Science"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="photo_url" className="font-semibold">Photo URL</Label>
              <Input
                id="photo_url"
                value={formData.photo_url}
                onChange={(e) => setFormData(prev => ({ ...prev, photo_url: e.target.value }))}
                placeholder="https://example.com/photo.jpg"
              />
              <p className="text-[0.8rem] text-muted-foreground">
                Provide a direct link to the candidate's photo.
              </p>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="manifesto" className="font-semibold">Manifesto / Platform</Label>
              <Textarea
                id="manifesto"
                value={formData.manifesto}
                onChange={(e) => setFormData(prev => ({ ...prev, manifesto: e.target.value }))}
                placeholder="Describe the candidate's goals and platform..."
                className="min-h-[100px]"
              />
            </div>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setFormDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSaveCandidate}
              disabled={!formData.name || !formData.position || createCandidate.isPending || updateCandidate.isPending}
            >
              {(createCandidate.isPending || updateCandidate.isPending) ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Candidate"
        description={`Are you sure you want to remove ${selectedCandidate?.name}? This will permanently delete their data and vote records.`}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default AdminCandidates;