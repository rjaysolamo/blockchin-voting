import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, GraduationCap, Target, Award, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { mockCandidates } from '@/api/mockData';
import { Candidate } from '@/@types';
import DashboardLayout from '@/templates/DashboardLayout';

const CandidateComparePage = () => {
  const navigate = useNavigate();
  const [leftCandidateId, setLeftCandidateId] = useState<string>('');
  const [rightCandidateId, setRightCandidateId] = useState<string>('');
  const [majorFilter, setMajorFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');

  const positions = useMemo(() => [...new Set(mockCandidates.map(c => c.position))], []);
  const majors = useMemo(() => [...new Set(mockCandidates.map(c => c.major).filter(Boolean))], []);
  const years = useMemo(() => [...new Set(mockCandidates.map(c => c.year).filter(Boolean))], []);

  const filteredCandidates = useMemo(() => {
    return mockCandidates.filter((candidate) => {
      const matchesMajor = majorFilter === 'all' || candidate.major === majorFilter;
      const matchesYear = yearFilter === 'all' || candidate.year === yearFilter;
      return matchesMajor && matchesYear;
    });
  }, [majorFilter, yearFilter]);
  
  const leftCandidate = mockCandidates.find(c => c.id === leftCandidateId);
  const rightCandidate = mockCandidates.find(c => c.id === rightCandidateId);

  const CandidateColumn = ({ 
    candidate, 
    onClear, 
    onSelect, 
    selectedId,
    excludeId 
  }: { 
    candidate?: Candidate; 
    onClear: () => void;
    onSelect: (id: string) => void;
    selectedId: string;
    excludeId: string;
  }) => {
    if (!candidate) {
      return (
        <div className="flex-1 border border-dashed border-border rounded-lg p-6 flex flex-col items-center justify-center min-h-[400px]">
          <User className="w-16 h-16 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground mb-4">Select a candidate to compare</p>
          <Select value={selectedId} onValueChange={onSelect}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="Choose a candidate" />
            </SelectTrigger>
            <SelectContent>
              {positions.map(position => (
                <div key={position}>
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{position}</div>
                  {filteredCandidates
                    .filter(c => c.position === position && c.id !== excludeId)
                    .map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div className="flex-1 bg-card border border-border rounded-lg overflow-hidden flex flex-col h-full">
        <div className="relative shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 z-10 bg-background/80 hover:bg-background"
            onClick={onClear}
          >
            <X className="w-4 h-4" />
          </Button>
          <div className="aspect-[3/2] bg-muted flex items-center justify-center">
            {candidate.photo && candidate.photo !== '/placeholder.svg' ? (
              <img src={candidate.photo} alt={candidate.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-20 h-20 text-muted-foreground/40" />
            )}
          </div>
        </div>
        
        <div className="p-6 flex-1 flex flex-col">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-foreground">{candidate.name}</h3>
            <Badge variant="secondary" className="mt-2">{candidate.position}</Badge>
            {candidate.major && candidate.year && (
              <p className="text-sm text-muted-foreground mt-2">
                {candidate.major} • {candidate.year}
              </p>
            )}
          </div>

          <div className="space-y-6 flex-1">
            {candidate.description && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">{candidate.description}</p>
              </div>
            )}

            {candidate.manifesto && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <GraduationCap className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-sm">Manifesto</h4>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg text-sm">
                  {candidate.manifesto}
                </div>
              </div>
            )}

            {candidate.qualifications && candidate.qualifications.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-sm">Qualifications</h4>
                </div>
                <ul className="space-y-2">
                  {candidate.qualifications.map((qualification, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className="font-medium">{qualification.title}</span>
                        <p className="text-xs text-muted-foreground">{qualification.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {candidate.goals && candidate.goals.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-primary" />
                  <h4 className="font-semibold text-sm">Goals</h4>
                </div>
                <ul className="space-y-2">
                  {candidate.goals.map((goal, i) => (
                    <li key={i} className="text-sm flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className="font-medium">{goal.title}</span>
                        <p className="text-xs text-muted-foreground">{goal.description}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout title="Compare Candidates">
      <div className="mb-6 flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
        <div className="flex flex-wrap gap-3">
          <Select value={majorFilter} onValueChange={setMajorFilter}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="All departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All departments</SelectItem>
              {majors.map((major) => (
                <SelectItem key={major} value={major}>
                  {major}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All years</SelectItem>
              {years.map((year) => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setMajorFilter('all');
            setYearFilter('all');
          }}
        >
          Clear Filters
        </Button>
      </div>

      <div className="flex flex-col md:flex-row gap-6 min-h-[600px]">
        <CandidateColumn 
          candidate={leftCandidate}
          selectedId={leftCandidateId}
          excludeId={rightCandidateId}
          onSelect={setLeftCandidateId}
          onClear={() => setLeftCandidateId('')}
        />
        
        <div className="hidden md:flex flex-col items-center justify-center">
          <div className="w-px h-full bg-border absolute" />
          <div className="bg-background border border-border rounded-full p-2 z-10 font-bold text-muted-foreground">
            VS
          </div>
        </div>

        <CandidateColumn 
          candidate={rightCandidate}
          selectedId={rightCandidateId}
          excludeId={leftCandidateId}
          onSelect={setRightCandidateId}
          onClear={() => setRightCandidateId('')}
        />
      </div>
    </DashboardLayout>
  );
};

export default CandidateComparePage;
