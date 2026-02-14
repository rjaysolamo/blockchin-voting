import { ReactNode } from 'react';
import DashboardLayout from './DashboardLayout';

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
}

const AdminLayout = ({ children, title, subtitle }: AdminLayoutProps) => {
  return (
    <DashboardLayout title={title} subtitle={subtitle}>
      {children}
    </DashboardLayout>
  );
};

export default AdminLayout;
