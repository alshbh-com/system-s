import { useAdminAuth } from '@/contexts/AdminAuthContext';
import UserLogin from '@/components/admin/UserLogin';

const ProtectedAdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser } = useAdminAuth();

  if (!currentUser) {
    return <UserLogin />;
  }

  return <>{children}</>;
};

export default ProtectedAdminRoute;
