import { useState } from 'react';
import { Search, CheckCircle2, Clock } from 'lucide-react';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { Input } from '@/components/ui/input';
import { mockVoters } from '@/api/mockData';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const AdminVoters = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filteredVoters = mockVoters.filter((voter) => {
    const matchesSearch =
      voter.name.toLowerCase().includes(search.toLowerCase()) ||
      voter.studentId.toLowerCase().includes(search.toLowerCase()) ||
      voter.email.toLowerCase().includes(search.toLowerCase());
    
    const matchesFilter =
      filter === 'all' ||
      (filter === 'voted' && voter.hasVoted) ||
      (filter === 'pending' && !voter.hasVoted);

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Voters</h1>
          <p className="text-muted-foreground">View and manage registered voters</p>
        </header>

        <div className="voting-card">
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search voters..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Voters</SelectItem>
                <SelectItem value="voted">Voted</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Student ID</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Voted At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredVoters.map((voter) => (
                <TableRow key={voter.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium">
                          {voter.name.charAt(0)}
                        </span>
                      </div>
                      <span className="font-medium">{voter.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{voter.studentId}</TableCell>
                  <TableCell className="text-muted-foreground">{voter.email}</TableCell>
                  <TableCell>
                    {voter.hasVoted ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
                        <CheckCircle2 className="w-3 h-3" />
                        Voted
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {voter.votedAt || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default AdminVoters;
