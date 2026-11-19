import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, Gift } from 'lucide-react';

interface VoucherApplied {
  voucher_code: string;
  voucher_type: string;
  voucher_plan: string;
  duration_months: number;
  voucher_description: string | null;
  voucher_created_at: string;
  voucher_expires_at: string | null;
  user_id: string | null;
  user_plan: string | null;
  subscription_expires_at: string | null;
  subscription_active: boolean | null;
  applied_at: string | null;
  user_name: string | null;
  user_email: string | null;
  auth_email: string | null;
  coach_plan_type?: string | null;
  coach_max_students?: number | null;
  coach_price?: number | null;
  coach_status?: string | null;
}

export const VouchersAppliedList: React.FC = () => {
  const { data: vouchersApplied, isLoading, error } = useQuery({
    queryKey: ['vouchers-applied'],
    queryFn: async () => {
      // Consultar a view vouchers_applied_with_users
      const { data, error } = await (supabase as any)
        .from('vouchers_applied_with_users')
        .select('*')
        .order('voucher_created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as VoucherApplied[];
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Vouchers Aplicados
          </CardTitle>
          <CardDescription>
            Lista de vouchers de assinatura aplicados pelos usuários
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center p-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            Vouchers Aplicados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground p-8">
            Erro ao carregar vouchers aplicados
          </p>
        </CardContent>
      </Card>
    );
  }

  // Agrupar vouchers por código (um voucher pode ter sido usado por vários usuários se for permitido no futuro)
  // Mas como implementamos uso único, cada voucher terá apenas um usuário
  const groupedVouchers = vouchersApplied?.reduce((acc, voucher) => {
    if (!acc[voucher.voucher_code]) {
      acc[voucher.voucher_code] = {
        voucher: voucher,
        users: []
      };
    }
    if (voucher.user_id) {
      acc[voucher.voucher_code].users.push(voucher);
    }
    return acc;
  }, {} as Record<string, { voucher: VoucherApplied; users: VoucherApplied[] }>);

  const vouchersList = groupedVouchers ? Object.values(groupedVouchers) : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gift className="h-5 w-5" />
          Vouchers Aplicados
        </CardTitle>
        <CardDescription>
          Lista de vouchers de assinatura aplicados pelos usuários. Cada voucher só pode ser usado por um usuário.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!vouchersList || vouchersList.length === 0 ? (
          <p className="text-center text-muted-foreground p-8">
            Nenhum voucher aplicado ainda
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código do Voucher</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Data de Aplicação</TableHead>
                  <TableHead>Expira em</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchersList.map((group) => {
                  const { voucher, users } = group;
                  const user = users[0]; // Como cada voucher só pode ser usado por um usuário, pegamos o primeiro
                  
                  return (
                    <TableRow key={voucher.voucher_code}>
                      <TableCell className="font-mono text-sm">
                        {voucher.voucher_code}
                      </TableCell>
                      <TableCell>
                        <Badge variant={voucher.voucher_plan === 'pro' ? 'default' : 'secondary'}>
                          {voucher.voucher_plan === 'pro' ? 'Pro' : 
                           voucher.voucher_plan === 'coach_starter' ? 'Coach Inicial' :
                           voucher.voucher_plan === 'coach_professional' ? 'Coach Intermediário' :
                           voucher.voucher_plan === 'coach_enterprise' ? 'Coach Avançado' :
                           voucher.voucher_plan === 'free' ? 'Gratuito' : voucher.voucher_plan}
                        </Badge>
                        {user?.coach_plan_type && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({user.coach_plan_type})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {voucher.duration_months} {voucher.duration_months === 1 ? 'mês' : 'meses'}
                      </TableCell>
                      <TableCell>
                        {user?.user_name || user?.auth_email?.split('@')[0] || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {user?.auth_email || user?.user_email || 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {user?.applied_at 
                          ? new Date(user.applied_at).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })
                          : 'N/A'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {user?.subscription_expires_at
                          ? new Date(user.subscription_expires_at).toLocaleDateString('pt-BR')
                          : 'Sem expiração'}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={user?.subscription_active ? 'default' : 'secondary'}
                        >
                          {user?.subscription_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

