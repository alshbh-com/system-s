import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Plus, Trash2, Pencil, ArrowLeft, Key, Eye, EyeOff, ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAdminAuth } from '@/contexts/AdminAuthContext';
import AdminPasswordDialog from '@/components/admin/AdminPasswordDialog';

const PERMISSIONS = [
  { id: 'orders', label: 'الأوردرات' },
  { id: 'products', label: 'المنتجات' },
  { id: 'categories', label: 'الأقسام' },
  { id: 'customers', label: 'العملاء' },
  { id: 'agents', label: 'المندوبين' },
  { id: 'agent_orders', label: 'طلبات المندوب' },
  { id: 'agent_payments', label: 'دفعات المندوب' },
  { id: 'governorates', label: 'المحافظات' },
  { id: 'statistics', label: 'الإحصائيات' },
  { id: 'invoices', label: 'الفواتير' },
  { id: 'all_orders', label: 'كل الطلبات' },
  { id: 'settings', label: 'الإعدادات' },
  { id: 'reset_data', label: 'مسح البيانات' },
  { id: 'user_management', label: 'إدارة المستخدمين' },
  { id: 'cashbox', label: 'الخزنة' },
  { id: 'treasury', label: 'الخزانة (قديم)' },
  { id: 'barcode_scanner', label: 'قراءة الباركود' },
];

interface PermissionSetting {
  permission: string;
  type: 'none' | 'view' | 'edit';
}

const UserManagement = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { logActivity } = useAdminAuth();
  
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [permDialogOpen, setPermDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [adminDeleteDialogOpen, setAdminDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [permissionSettings, setPermissionSettings] = useState<PermissionSetting[]>([]);
  const [showPasswords, setShowPasswords] = useState(false);
  
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [passwordForm, setPasswordForm] = useState({ master: '', payment: '', admin_delete: '' });

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin_users'],
    queryFn: async () => {
      const { data: usersData, error } = await supabase
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      const usersWithPermissions = await Promise.all(
        (usersData || []).map(async (user) => {
          const { data: perms } = await supabase
            .from('admin_user_permissions')
            .select('permission, permission_type')
            .eq('user_id', user.id);
          return { 
            ...user, 
            permissions: perms?.map(p => ({ 
              permission: p.permission, 
              type: p.permission_type 
            })) || [] 
          };
        })
      );

      return usersWithPermissions;
    }
  });

  // Fetch system passwords
  const { data: systemPasswords } = useQuery({
    queryKey: ['system_passwords'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_passwords')
        .select('*');
      if (error) throw error;
      return data;
    }
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async ({ username, password }: { username: string; password: string }) => {
      const { data, error } = await supabase
        .from('admin_users')
        .insert({ username, password })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('تم إنشاء المستخدم');
      logActivity('إنشاء مستخدم', 'user_management', { username: data.username });
      setNewUser({ username: '', password: '' });
      setSelectedUser(data);
      // Initialize all permissions as 'none'
      setPermissionSettings(PERMISSIONS.map(p => ({ permission: p.id, type: 'none' })));
      setCreateDialogOpen(false);
      setPermDialogOpen(true);
    },
    onError: (error: any) => {
      if (error.message?.includes('unique')) {
        toast.error('اسم المستخدم أو كلمة المرور موجودة مسبقاً');
      } else {
        toast.error('حدث خطأ أثناء الإنشاء');
      }
    }
  });

  // Save permissions mutation
  const savePermissionsMutation = useMutation({
    mutationFn: async ({ userId, permissions }: { userId: string; permissions: PermissionSetting[] }) => {
      // Delete existing permissions
      await supabase.from('admin_user_permissions').delete().eq('user_id', userId);
      
      // Insert new permissions (only those that are not 'none')
      const toInsert = permissions
        .filter(p => p.type !== 'none')
        .map(p => ({ 
          user_id: userId, 
          permission: p.permission,
          permission_type: p.type
        }));
      
      if (toInsert.length > 0) {
        const { error } = await supabase.from('admin_user_permissions').insert(toInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('تم حفظ الصلاحيات');
      logActivity('تعديل صلاحيات', 'user_management', { 
        userId: selectedUser?.id, 
        permissions: permissionSettings.filter(p => p.type !== 'none')
      });
      setPermDialogOpen(false);
    },
    onError: () => {
      toast.error('حدث خطأ أثناء الحفظ');
    }
  });

  // Toggle user status mutation
  const toggleUserMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('تم تحديث حالة المستخدم');
    }
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('admin_users').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      toast.success('تم حذف المستخدم بنجاح');
      logActivity('حذف مستخدم', 'user_management');
    },
    onError: (error: any) => {
      console.error('Delete error:', error);
      if (error.code === '23503') {
        toast.error('لا يمكن حذف المستخدم لأنه مرتبط ببيانات أخرى');
      } else {
        toast.error('حدث خطأ أثناء حذف المستخدم');
      }
    }
  });

  // Update passwords mutation
  const updatePasswordsMutation = useMutation({
    mutationFn: async ({ master, payment, admin_delete }: { master: string; payment: string; admin_delete: string }) => {
      if (master) {
        const { error: masterError } = await supabase
          .from('system_passwords')
          .update({ password: master })
          .eq('id', 'master');
        if (masterError) throw masterError;
      }
      if (payment) {
        const { error: paymentError } = await supabase
          .from('system_passwords')
          .update({ password: payment })
          .eq('id', 'payment');
        if (paymentError) throw paymentError;
      }
      if (admin_delete) {
        const { error: adminDeleteError } = await supabase
          .from('system_passwords')
          .update({ password: admin_delete })
          .eq('id', 'admin_delete');
        if (adminDeleteError) throw adminDeleteError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system_passwords'] });
      toast.success('تم تحديث كلمات المرور');
      logActivity('تغيير كلمات مرور النظام', 'user_management');
      setPasswordDialogOpen(false);
      setPasswordForm({ master: '', payment: '', admin_delete: '' });
    },
    onError: () => {
      toast.error('حدث خطأ أثناء التحديث');
    }
  });

  const handleCreateUser = () => {
    if (!newUser.username || !newUser.password) {
      toast.error('أدخل اسم المستخدم وكلمة المرور');
      return;
    }
    createUserMutation.mutate(newUser);
  };

  const handleEditPermissions = (user: any) => {
    setSelectedUser(user);
    // Map existing permissions to permission settings
    const settings: PermissionSetting[] = PERMISSIONS.map(p => {
      const existing = user.permissions?.find((up: any) => up.permission === p.id);
      return {
        permission: p.id,
        type: existing ? existing.type : 'none'
      };
    });
    setPermissionSettings(settings);
    setPermDialogOpen(true);
  };

  const updatePermissionType = (permId: string, type: 'none' | 'view' | 'edit') => {
    setPermissionSettings(prev =>
      prev.map(p => p.permission === permId ? { ...p, type } : p)
    );
  };

  const selectAllEdit = () => {
    setPermissionSettings(PERMISSIONS.map(p => ({ permission: p.id, type: 'edit' })));
  };

  const selectAllView = () => {
    setPermissionSettings(PERMISSIONS.map(p => ({ permission: p.id, type: 'view' })));
  };

  const clearAll = () => {
    setPermissionSettings(PERMISSIONS.map(p => ({ permission: p.id, type: 'none' })));
  };

  const getPermissionCount = (user: any) => {
    const viewCount = user.permissions?.filter((p: any) => p.type === 'view').length || 0;
    const editCount = user.permissions?.filter((p: any) => p.type === 'edit').length || 0;
    if (viewCount === 0 && editCount === 0) return 'لا توجد صلاحيات';
    return `${editCount} تعديل، ${viewCount} مشاهدة`;
  };

  if (isLoading) {
    return <div className="p-8 text-center">جاري التحميل...</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-accent/20 py-8">
      <div className="container mx-auto px-4">
        <Button onClick={() => navigate('/admin')} variant="ghost" className="mb-4">
          <ArrowLeft className="ml-2 h-4 w-4" />
          رجوع
        </Button>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>إدارة المستخدمين</CardTitle>
            <div className="flex gap-2">
              <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Key className="ml-2 h-4 w-4" />
                    كلمات المرور
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>تغيير كلمات مرور النظام</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>كلمة المرور الرئيسية (الحالية: {systemPasswords?.find(p => p.id === 'master')?.password})</Label>
                      <Input
                        value={passwordForm.master}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, master: e.target.value }))}
                        placeholder="اترك فارغ للإبقاء كما هي"
                      />
                    </div>
                    <div>
                      <Label>كلمة مرور الدفعات (الحالية: {systemPasswords?.find(p => p.id === 'payment')?.password})</Label>
                      <Input
                        value={passwordForm.payment}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, payment: e.target.value }))}
                        placeholder="اترك فارغ للإبقاء كما هي"
                      />
                    </div>
                    <div>
                      <Label>كلمة مرور الحذف الإدارية (الحالية: {systemPasswords?.find(p => p.id === 'admin_delete')?.password})</Label>
                      <Input
                        value={passwordForm.admin_delete}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, admin_delete: e.target.value }))}
                        placeholder="اترك فارغ للإبقاء كما هي"
                      />
                    </div>
                    <Button 
                      onClick={() => updatePasswordsMutation.mutate(passwordForm)}
                      className="w-full"
                      disabled={!passwordForm.master && !passwordForm.payment && !passwordForm.admin_delete}
                    >
                      حفظ التغييرات
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="ml-2 h-4 w-4" />
                    إنشاء مستخدم
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>إنشاء مستخدم جديد</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>اسم المستخدم (للتعريف فقط)</Label>
                      <Input
                        value={newUser.username}
                        onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="اسم المستخدم"
                      />
                    </div>
                    <div>
                      <Label>كلمة المرور (للدخول)</Label>
                      <div className="relative">
                        <Input
                          type={showPasswords ? 'text' : 'password'}
                          value={newUser.password}
                          onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                          placeholder="كلمة المرور الفريدة"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPasswords(!showPasswords)}
                          className="absolute left-3 top-1/2 -translate-y-1/2"
                        >
                          {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        كلمة المرور يجب أن تكون فريدة - سيتم استخدامها للدخول
                      </p>
                    </div>
                    <Button onClick={handleCreateUser} className="w-full">
                      إنشاء وتحديد الصلاحيات
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم المستخدم</TableHead>
                  <TableHead>كلمة المرور</TableHead>
                  <TableHead>الصلاحيات</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.username}</TableCell>
                    <TableCell className="font-mono text-sm">{user.password}</TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {getPermissionCount(user)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={user.is_active}
                        onCheckedChange={(checked) => toggleUserMutation.mutate({ id: user.id, isActive: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => handleEditPermissions(user)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="text-destructive"
                          onClick={() => {
                            setUserToDelete(user);
                            setAdminDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Permissions Dialog */}
        <Dialog open={permDialogOpen} onOpenChange={setPermDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>صلاحيات {selectedUser?.username}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllEdit}>
                  تحديد الكل (تعديل)
                </Button>
                <Button variant="outline" size="sm" onClick={selectAllView}>
                  تحديد الكل (مشاهدة)
                </Button>
                <Button variant="outline" size="sm" onClick={clearAll}>
                  إلغاء الكل
                </Button>
              </div>
              
              <div className="max-h-80 overflow-y-auto space-y-3">
                {PERMISSIONS.map((perm) => {
                  const setting = permissionSettings.find(p => p.permission === perm.id);
                  return (
                    <div key={perm.id} className="flex items-center justify-between border-b pb-2">
                      <span className="text-sm font-medium">{perm.label}</span>
                      <RadioGroup
                        value={setting?.type || 'none'}
                        onValueChange={(value) => updatePermissionType(perm.id, value as 'none' | 'view' | 'edit')}
                        className="flex gap-3"
                      >
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="none" id={`${perm.id}-none`} />
                          <Label htmlFor={`${perm.id}-none`} className="text-xs cursor-pointer">لا</Label>
                        </div>
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="view" id={`${perm.id}-view`} />
                          <Label htmlFor={`${perm.id}-view`} className="text-xs cursor-pointer">مشاهدة</Label>
                        </div>
                        <div className="flex items-center gap-1">
                          <RadioGroupItem value="edit" id={`${perm.id}-edit`} />
                          <Label htmlFor={`${perm.id}-edit`} className="text-xs cursor-pointer">تعديل</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  );
                })}
              </div>
              
              <Button 
                onClick={() => savePermissionsMutation.mutate({ userId: selectedUser?.id, permissions: permissionSettings })}
                className="w-full"
              >
                حفظ الصلاحيات
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Admin Password Dialog for Delete */}
        <AdminPasswordDialog
          open={adminDeleteDialogOpen}
          onOpenChange={setAdminDeleteDialogOpen}
          onConfirm={() => {
            if (userToDelete) {
              deleteUserMutation.mutate(userToDelete.id);
              setUserToDelete(null);
            }
          }}
          title="حذف المستخدم"
          description={`لحذف المستخدم "${userToDelete?.username}" يجب إدخال كلمة المرور الإدارية`}
          itemType="user_management"
        />
      </div>
    </div>
  );
};

export default UserManagement;
