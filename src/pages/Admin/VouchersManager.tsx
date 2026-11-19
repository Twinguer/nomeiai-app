import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const VouchersManager = () => {
  const [code, setCode] = useState('');
  const [voucherType, setVoucherType] = useState<'subscription' | 'discount'>('subscription');
  // Planos disponíveis: pro, coach_starter, coach_professional, coach_enterprise
  const [plan, setPlan] = useState<'pro' | 'coach_starter' | 'coach_professional' | 'coach_enterprise'>('pro');
  const [durationMonths, setDurationMonths] = useState('1');
  const [maxUses, setMaxUses] = useState('1');
  const [description, setDescription] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: vouchers, isLoading, refetch } = useQuery({
    queryKey: ['vouchers'],
    queryFn: async () => {
      const { data: vouchersData, error: vouchersError } = await supabase
        .from('vouchers')
        .select('*')
        .order('created_at', { ascending: false });

      if (vouchersError) throw vouchersError;

      // Buscar contagem real de usos de vouchers_applied
      const { data: appliedData, error: appliedError } = await supabase
        .from('vouchers_applied')
        .select('voucher_id');

      if (appliedError) {
        console.warn('Erro ao buscar vouchers aplicados:', appliedError);
      }

      // Contar usos por voucher
      const usesCountMap = new Map<string, number>();
      if (appliedData) {
        appliedData.forEach((applied) => {
          const count = usesCountMap.get(applied.voucher_id) || 0;
          usesCountMap.set(applied.voucher_id, count + 1);
        });
      }

      // Adicionar contagem real aos vouchers (usa uses_count como fallback)
      return vouchersData?.map((voucher) => ({
        ...voucher,
        current_uses: usesCountMap.get(voucher.id) ?? voucher.uses_count ?? 0,
      })) || [];
    },
  });

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) code += '-';
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setCode(code);
  };

  const handleCreate = async () => {
    if (!code) {
      toast({
        title: 'Erro',
        description: 'O código do voucher é obrigatório',
        variant: 'destructive',
      });
      return;
    }

    // Validar campos de desconto se for voucher de desconto
    if (voucherType === 'discount') {
      if (!discountType || !discountValue) {
        toast({
          title: 'Erro',
          description: 'Para cupom de desconto, tipo e valor são obrigatórios',
          variant: 'destructive',
        });
        return;
      }

      const discountVal = parseFloat(discountValue);
      if (isNaN(discountVal) || discountVal < 0) {
        toast({
          title: 'Erro',
          description: 'Valor do desconto inválido',
          variant: 'destructive',
        });
        return;
      }

      if (discountType === 'percentage' && (discountVal < 0 || discountVal > 100)) {
        toast({
          title: 'Erro',
          description: 'Desconto percentual deve estar entre 0 e 100',
          variant: 'destructive',
        });
        return;
      }
    }

    setIsCreating(true);
    try {
      // ✅ CORREÇÃO: A coluna plan foi alterada de enum para TEXT na migração
      // Os tipos TypeScript foram atualizados para aceitar string
      const voucherData: any = {
        code: code.trim(),
        voucher_type: voucherType,
        plan: plan, // ✅ Agora aceita string (coach_starter, coach_professional, coach_enterprise)
        duration_months: parseInt(durationMonths) || 1,
        max_uses: parseInt(maxUses) || 1,
        is_active: true, // ✅ Ativar voucher por padrão
        description: description.trim() || null,
        expires_at: expiresAt || null,
      };
      
      // ✅ Não especificar contador de usos - deixar o DEFAULT do banco (0)
      // O banco tem DEFAULT 0 para uses_count ou current_uses dependendo da migração aplicada
      
      // ✅ Remover campos undefined/null desnecessários
      Object.keys(voucherData).forEach(key => {
        if (voucherData[key] === undefined || voucherData[key] === '') {
          delete voucherData[key];
        }
      });

      // Adicionar campos de desconto apenas se for voucher de desconto
      if (voucherType === 'discount') {
        voucherData.discount_type = discountType;
        voucherData.discount_value = parseFloat(discountValue);
      }

      // ✅ CORREÇÃO: Usar INSERT direto (a coluna plan é TEXT e aceita planos coach)
      // A migração alterou plan de enum para TEXT, então podemos inserir diretamente
      const { data, error } = await supabase
        .from('vouchers')
        .insert(voucherData as any)
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar voucher:', error);
        console.error('Dados enviados:', voucherData);
        
        // Mensagem de erro mais detalhada
        let errorMessage = error.message || 'Erro ao criar voucher';
        
        // Verificar se é erro de constraint (plano inválido)
        if (error.message?.includes('vouchers_plan_check') || error.message?.includes('check constraint')) {
          errorMessage = `Plano inválido: "${plan}". Planos permitidos: free, pro, coach_starter, coach_professional, coach_enterprise. Verifique se a migração foi aplicada.`;
        } else if (error.message?.includes('violates check constraint')) {
          errorMessage = `O plano "${plan}" não é válido. Planos permitidos: free, pro, coach_starter, coach_professional, coach_enterprise`;
        } else if (error.code === '23514') {
          errorMessage = `Erro de validação: O plano "${plan}" não está na lista de planos permitidos. Verifique se a migração foi aplicada.`;
        } else if (error.code === '23505') {
          errorMessage = 'Código de voucher já existe. Use outro código.';
        } else if (error.code === '42501') {
          errorMessage = 'Sem permissão para criar vouchers. Verifique se você é administrador.';
        }
        
        throw new Error(errorMessage);
      }

      toast({
        title: 'Voucher criado',
        description: 'O voucher foi criado com sucesso',
      });

      // Limpar formulário
      setCode('');
      setDescription('');
      setExpiresAt('');
      setDiscountValue('');
      setVoucherType('subscription');
      setPlan('pro');
      refetch();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar voucher',
        variant: 'destructive',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const toggleVoucherStatus = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('vouchers')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: `Voucher ${!currentStatus ? 'ativado' : 'desativado'}`,
      });

      refetch();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const deleteVoucher = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este voucher?')) return;

    try {
      const { error } = await supabase.from('vouchers').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Voucher excluído',
        description: 'O voucher foi excluído com sucesso',
      });

      refetch();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Gerenciar Vouchers</h1>

      <Card>
        <CardHeader>
          <CardTitle>Criar Novo Voucher</CardTitle>
          <CardDescription>
            Crie vouchers para oferecer benefícios aos usuários
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label htmlFor="code">Código do Voucher</Label>
              <div className="flex gap-2">
                <Input
                  id="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                />
                <Button onClick={generateRandomCode} variant="outline">
                  Gerar
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="voucherType">Tipo de Voucher</Label>
              <Select value={voucherType} onValueChange={(v: 'subscription' | 'discount') => {
                setVoucherType(v);
                if (v === 'subscription') {
                  setDiscountType('percentage');
                  setDiscountValue('');
                }
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="subscription">Voucher de Assinatura (Grátis)</SelectItem>
                  <SelectItem value="discount">Cupom de Desconto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">Plano</Label>
              <Select 
                key={`plan-select-${plan}`}
                value={plan} 
                onValueChange={(v: 'pro' | 'coach_starter' | 'coach_professional' | 'coach_enterprise') => setPlan(v)}
              >
                <SelectTrigger id="plan">
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="coach_starter">Coach Inicial</SelectItem>
                  <SelectItem value="coach_professional">Coach Intermediário</SelectItem>
                  <SelectItem value="coach_enterprise">Coach Avançado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {voucherType === 'discount' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="discountType">Tipo de Desconto</Label>
                  <Select value={discountType} onValueChange={(v: 'percentage' | 'fixed') => setDiscountType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentual (%)</SelectItem>
                      <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="discountValue">
                    Valor do Desconto {discountType === 'percentage' ? '(%)' : '(R$)'}
                  </Label>
                  <Input
                    id="discountValue"
                    type="number"
                    min="0"
                    max={discountType === 'percentage' ? '100' : undefined}
                    step={discountType === 'percentage' ? '1' : '0.01'}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'percentage' ? 'Ex: 10' : 'Ex: 5.50'}
                  />
                </div>
              </>
            )}

            {voucherType === 'subscription' && (
              <div className="space-y-2">
                <Label htmlFor="duration">Duração (meses)</Label>
                <Input
                  id="duration"
                  type="number"
                  min="1"
                  value={durationMonths}
                  onChange={(e) => setDurationMonths(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="maxUses">Máximo de Usos</Label>
              <Input
                id="maxUses"
                type="number"
                min="1"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expires">Data de Expiração</Label>
              <Input
                id="expires"
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descrição do voucher (opcional)"
              rows={3}
            />
          </div>

          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando...
              </>
            ) : (
              <>
                <Plus className="w-4 h-4 mr-2" />
                Criar Voucher
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vouchers Criados</CardTitle>
          <CardDescription>Gerencie os vouchers existentes</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : !vouchers || vouchers.length === 0 ? (
            <p className="text-center text-muted-foreground p-8">
              Nenhum voucher criado ainda
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Desconto/Duração</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead>Expira em</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vouchers.map((voucher: any) => (
                    <TableRow key={voucher.id}>
                      <TableCell className="font-mono">{voucher.code}</TableCell>
                      <TableCell>
                        <Badge variant={voucher.voucher_type === 'discount' ? 'default' : 'outline'}>
                          {voucher.voucher_type === 'discount' ? 'Cupom' : 'Assinatura'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={voucher.plan === 'pro' ? 'default' : 'secondary'}>
                          {voucher.plan === 'pro' ? 'Pro' : 
                           voucher.plan === 'coach_starter' ? 'Coach Inicial' :
                           voucher.plan === 'coach_professional' ? 'Coach Intermediário' :
                           voucher.plan === 'coach_enterprise' ? 'Coach Avançado' : 
                           voucher.plan === 'free' ? 'Gratuito' : voucher.plan}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {voucher.voucher_type === 'discount' ? (
                          voucher.discount_type === 'percentage' 
                            ? `${voucher.discount_value}% OFF`
                            : `R$ ${parseFloat(voucher.discount_value || 0).toFixed(2)} OFF`
                        ) : (
                          `${voucher.duration_months} meses`
                        )}
                      </TableCell>
                      <TableCell>
                        {voucher.current_uses ?? voucher.uses_count ?? 0} / {voucher.max_uses}
                      </TableCell>
                      <TableCell>
                        {voucher.expires_at
                          ? new Date(voucher.expires_at).toLocaleDateString()
                          : 'Sem expiração'}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={voucher.is_active}
                          onCheckedChange={() =>
                            toggleVoucherStatus(voucher.id, voucher.is_active)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteVoucher(voucher.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VouchersManager;
