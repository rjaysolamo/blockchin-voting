import { describe, expect, it, vi } from 'vitest';
import { createStudentAccountWithAutoWallet } from './studentAccount';
import { isValidEthereumAddress } from '@/lib/walletGenerator';

function makeSupabaseMock() {
  const insertProfiles = vi.fn(async () => ({ error: null }));
  const insertRoles = vi.fn(async () => ({ error: null }));

  const from = vi.fn((table: string) => {
    if (table === 'profiles') return { insert: insertProfiles };
    if (table === 'user_roles') return { insert: insertRoles };
    return { insert: vi.fn(async () => ({ error: null })) };
  });

  return { from, insertProfiles, insertRoles };
}

describe('createStudentAccountWithAutoWallet', () => {
  it('creates profile + student role and auto-assigns a smart account address for Gmail email', async () => {
    const supabase = makeSupabaseMock();
    const smartAccountProvider = {
      getAddress: vi.fn(async (_email: string) => '0x1111111111111111111111111111111111111111'),
    };

    const res = await createStudentAccountWithAutoWallet(
      supabase as any,
      {
        userId: 'user-123',
        email: 'student.name@gmail.com',
        fullName: 'Student Name',
        studentId: 'STU2026001',
        department: 'Computer Science',
      },
      smartAccountProvider as any
    );

    expect(isValidEthereumAddress(res.walletAddress)).toBe(true);
    expect(smartAccountProvider.getAddress).toHaveBeenCalledWith('student.name@gmail.com');

    expect(supabase.from).toHaveBeenCalledWith('profiles');
    expect(supabase.from).toHaveBeenCalledWith('user_roles');

    expect(supabase.insertProfiles).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        full_name: 'Student Name',
        student_id: 'STU2026001',
        department: 'Computer Science',
        wallet_address: res.walletAddress,
      })
    );

    expect(supabase.insertRoles).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-123',
        role: 'student',
      })
    );
  });
});

