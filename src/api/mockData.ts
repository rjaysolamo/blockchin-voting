import { Candidate, ElectionStats, Voter } from '@/@types';

export const mockCandidates: Candidate[] = [
  {
    id: '1',
    name: 'Sarah Johnson',
    position: 'Student President',
    photo: '/placeholder.svg',
    voteCount: 156,
    description: 'Committed to improving campus life and student welfare.',
    major: 'Political Science',
    year: 'Junior',
    email: 'sarah.johnson@student.edu',
    manifesto: `As your Student President, I am committed to creating a campus environment where every student feels heard, supported, and empowered to succeed.

My vision centers on three core pillars: accessibility, community, and innovation. I believe that our university should be a place where financial barriers do not determine academic success, where diversity is celebrated, and where new ideas are welcomed.

Over the past three years, I have worked tirelessly in student government, serving on multiple committees and advocating for policy changes that directly benefit our student body. I understand the challenges we face, from rising tuition costs to mental health resources, and I am ready to tackle them head-on.

Together, we can build a stronger, more inclusive campus community. Your vote is your voice – let it be heard.`,
    qualifications: [
      { title: 'Student Senate Member', description: '2 years of experience in student governance' },
      { title: 'Debate Team Captain', description: 'Led team to regional championships' },
      { title: 'Community Service Leader', description: 'Organized 50+ volunteer events' },
      { title: 'Academic Excellence', description: "Dean's List for 5 consecutive semesters" },
    ],
    goals: [
      { title: 'Increase Mental Health Resources', description: 'Expand counseling services and add 24/7 crisis support hotline' },
      { title: 'Reduce Student Fees', description: 'Negotiate with administration to freeze tuition increases' },
      { title: 'Improve Campus Safety', description: 'Install better lighting and emergency stations across campus' },
      { title: 'Enhance Career Services', description: 'Partner with more companies for internship and job opportunities' },
    ],
  },
  {
    id: '2',
    name: 'Michael Chen',
    position: 'Student President',
    photo: '/placeholder.svg',
    voteCount: 142,
    description: 'Focused on academic excellence and career opportunities.',
    major: 'Computer Science',
    year: 'Senior',
    email: 'michael.chen@student.edu',
    manifesto: `Innovation drives progress, and as your Student President, I will bring a fresh, technology-forward approach to student governance.

In today's rapidly changing world, our university must evolve to prepare students for the careers of tomorrow. I believe in leveraging technology to improve campus services, streamline administrative processes, and create new opportunities for learning and collaboration.

My background in computer science has taught me the power of problem-solving and efficiency. I will apply these skills to address the real issues facing our student body: outdated systems, lack of transparency, and missed opportunities for growth.

Vote for innovation. Vote for progress. Vote for a better future.`,
    qualifications: [
      { title: 'Tech Club President', description: "Founded and led university's largest tech organization" },
      { title: 'Hackathon Winner', description: '3-time winner of national coding competitions' },
      { title: 'Research Assistant', description: 'Published work in AI and machine learning' },
      { title: 'Startup Founder', description: 'Created app used by 10,000+ students' },
    ],
    goals: [
      { title: 'Digital Campus Initiative', description: 'Modernize all university systems and create unified student portal' },
      { title: 'Tech Industry Partnerships', description: 'Bring more tech companies to campus for recruitment' },
      { title: 'Innovation Lab', description: 'Create space for students to work on entrepreneurial projects' },
      { title: 'Online Resources', description: 'Expand digital library and online tutoring services' },
    ],
  },
  {
    id: '3',
    name: 'Emily Davis',
    position: 'Vice President',
    photo: '/placeholder.svg',
    voteCount: 189,
    description: 'Dedicated to fostering inclusive campus community.',
    major: 'Sociology',
    year: 'Junior',
    email: 'emily.davis@student.edu',
    manifesto: `Inclusion is not just a buzzword – it is the foundation of a thriving campus community.

As Vice President, I will work to ensure that every student, regardless of their background, identity, or circumstances, has an equal opportunity to succeed. Our diversity is our strength, and I am committed to creating programs and policies that celebrate and support all members of our community.

I have spent my college career advocating for underrepresented groups, organizing cultural events, and building bridges between different student organizations. I bring experience, passion, and a genuine commitment to making our campus a welcoming place for everyone.`,
    qualifications: [
      { title: 'Diversity Council Chair', description: 'Led initiatives for campus inclusion' },
      { title: 'Cultural Festival Organizer', description: 'Coordinated annual celebration of diversity' },
      { title: 'Peer Mentor', description: 'Supported first-generation college students' },
      { title: 'Social Justice Advocate', description: 'Organized awareness campaigns and workshops' },
    ],
    goals: [
      { title: 'Inclusive Programming', description: 'Increase funding for cultural and identity-based organizations' },
      { title: 'Accessibility Improvements', description: 'Ensure all campus facilities are fully accessible' },
      { title: 'Bias Training', description: 'Implement mandatory diversity training for all student leaders' },
      { title: 'Safe Spaces', description: 'Create designated spaces for underrepresented communities' },
    ],
  },
  {
    id: '4',
    name: 'James Wilson',
    position: 'Vice President',
    photo: '/placeholder.svg',
    voteCount: 167,
    description: 'Passionate about sustainability and environmental initiatives.',
    major: 'Environmental Science',
    year: 'Senior',
    email: 'james.wilson@student.edu',
    manifesto: `Our planet needs action, and our campus can lead the way.

Climate change is the defining challenge of our generation, and I believe our university has a responsibility to be a leader in sustainability. As Vice President, I will push for ambitious environmental policies, from reducing our carbon footprint to eliminating single-use plastics.

I have worked with local environmental organizations, led campus recycling initiatives, and advocated for green energy adoption. Now, I want to bring that experience to student government and create lasting change.`,
    qualifications: [
      { title: 'Environmental Club President', description: 'Grew membership by 200%' },
      { title: 'Campus Sustainability Report', description: 'Authored comprehensive environmental assessment' },
      { title: 'Community Garden Founder', description: 'Created organic garden serving campus food bank' },
      { title: 'Climate Action Network', description: 'Regional coordinator for youth climate movement' },
    ],
    goals: [
      { title: 'Carbon Neutral by 2030', description: 'Push for aggressive timeline to eliminate campus emissions' },
      { title: 'Sustainable Dining', description: 'Transition cafeterias to local, organic, plant-based options' },
      { title: 'Green Transportation', description: 'Expand bike lanes and electric shuttle services' },
      { title: 'Environmental Curriculum', description: 'Add sustainability requirements to all degree programs' },
    ],
  },
  {
    id: '5',
    name: 'Olivia Martinez',
    position: 'Secretary',
    photo: '/placeholder.svg',
    voteCount: 201,
    description: 'Experienced in student governance and administration.',
    major: 'Business Administration',
    year: 'Junior',
    email: 'olivia.martinez@student.edu',
    manifesto: `Effective governance requires organization, transparency, and dedication.

As your Secretary, I will ensure that student government operates efficiently and that every voice is heard and documented. I believe in open communication and accountability, and I will work to make our proceedings accessible to all students.

My experience in administrative roles has prepared me to handle the responsibilities of this position with professionalism and care. I am ready to serve our student body.`,
    qualifications: [
      { title: 'Student Senate Secretary', description: 'Managed all official records and communications' },
      { title: 'Honor Society Vice President', description: 'Coordinated academic excellence programs' },
      { title: 'Administrative Intern', description: "Worked in university president's office" },
      { title: 'Event Planning Certified', description: 'Professional certification in event management' },
    ],
    goals: [
      { title: 'Digital Records', description: 'Create searchable online archive of all student government activities' },
      { title: 'Meeting Accessibility', description: 'Live stream and caption all public meetings' },
      { title: 'Communication Hub', description: 'Launch weekly newsletter keeping students informed' },
      { title: 'Feedback System', description: 'Implement easy-to-use platform for student suggestions' },
    ],
  },
  {
    id: '6',
    name: 'Daniel Brown',
    position: 'Treasurer',
    photo: '/placeholder.svg',
    voteCount: 178,
    description: 'Finance major with budget management experience.',
    major: 'Finance',
    year: 'Senior',
    email: 'daniel.brown@student.edu',
    manifesto: `Your student fees deserve responsible stewardship.

As Treasurer, I will bring financial expertise and integrity to managing our student government budget. Every dollar you contribute should be spent wisely and transparently, and I am committed to ensuring that our funds support programs that benefit the entire student body.

With my background in finance and experience managing organization budgets, I am prepared to handle the fiscal responsibilities of this role while advocating for smart investments in student services.`,
    qualifications: [
      { title: 'Finance Club Treasurer', description: 'Managed $50,000 annual budget' },
      { title: 'Investment Portfolio Manager', description: 'Led student-run investment fund' },
      { title: 'Accounting Intern', description: 'Experience at Big Four accounting firm' },
      { title: 'Budget Committee Member', description: 'Reviewed and approved student organization funding' },
    ],
    goals: [
      { title: 'Budget Transparency', description: 'Publish detailed monthly spending reports online' },
      { title: 'Emergency Fund', description: 'Create reserve for unexpected student needs' },
      { title: 'Fair Funding', description: 'Revise allocation process to support smaller organizations' },
      { title: 'Financial Literacy', description: 'Offer workshops on personal finance for students' },
    ],
  },
];

export const mockStats: ElectionStats = {
  totalVoters: 1250,
  totalCandidates: 6,
  votesCast: 847,
  electionStatus: 'open',
  startDate: '2025-12-30T08:00:00',
  endDate: '2026-01-03T18:00:00',
};

export const mockVoters: Voter[] = [
  {
    id: '1',
    name: 'John Smith',
    studentId: 'STU2026001',
    email: 'john.smith@student.edu',
    hasVoted: true,
    votedAt: '2026-01-15 14:32',
  },
  {
    id: '2',
    name: 'Emma Wilson',
    studentId: 'STU2026002',
    email: 'emma.wilson@student.edu',
    hasVoted: true,
    votedAt: '2026-01-15 10:15',
  },
  {
    id: '3',
    name: 'Liam Johnson',
    studentId: 'STU2026003',
    email: 'liam.johnson@student.edu',
    hasVoted: false,
  },
  {
    id: '4',
    name: 'Sophia Brown',
    studentId: 'STU2026004',
    email: 'sophia.brown@student.edu',
    hasVoted: true,
    votedAt: '2026-01-15 16:45',
  },
  {
    id: '5',
    name: 'Noah Davis',
    studentId: 'STU2026005',
    email: 'noah.davis@student.edu',
    hasVoted: false,
  },
];
