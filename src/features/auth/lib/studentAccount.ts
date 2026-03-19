import { isValidEthereumAddress } from '@/lib/walletGenerator';

type SupabaseLike = {
  from: (table: string) => {
    // Supabase returns a thenable Postgrest builder; treat as awaitable.
    insert: (values: any) => any;
    upsert: (values: any, options?: any) => any;
  };
};

export type SmartAccountProvider = {
  getAddress: (email: string) => Promise<string>;
};

export type CreateStudentAccountInput = {
  userId: string;
  email: string;
  fullName: string;
  studentId: string;
  department?: string;
};

export async function createStudentAccountWithAutoWallet(
  supabaseClient: SupabaseLike,
  input: CreateStudentAccountInput,
  smartAccountProvider: SmartAccountProvider
): Promise<{ walletAddress: string }> {
  const walletAddress = (await smartAccountProvider.getAddress(input.email)).toLowerCase();

  if (!isValidEthereumAddress(walletAddress)) {
    throw new Error('Generated an invalid smart account address');
  }

  const { error: profileError } = await supabaseClient.from('profiles').upsert(
    {
      user_id: input.userId,
      full_name: input.fullName,
      student_id: input.studentId,
      department: input.department ?? null,
      wallet_address: walletAddress,
    },
    {
      onConflict: 'user_id',
    }
  );

  if (profileError) {
    throw new Error(profileError?.message || 'Failed to create profile');
  }

  return { walletAddress };
}
