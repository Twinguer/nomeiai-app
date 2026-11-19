import React from 'react';
import { useNavigate } from 'react-router-dom';
import { adminResourcePath, type AdminResource } from '@/config/adminRoutes';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, FileText, Users, Gift } from 'lucide-react';

type AdminNavLinks = Record<AdminResource, string>;

interface AdminMenuProps {
  links: AdminNavLinks;
  loading?: boolean;
}

const AdminMenu = ({ links, loading = false }: AdminMenuProps) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="sm" disabled>
          <LayoutDashboard className="h-4 w-4 mr-2" />
          Carregando...
        </Button>
      </div>
    );
  }

  const fallbackLinks: AdminNavLinks = {
    dashboard: adminResourcePath('dashboard'),
    concursos: adminResourcePath('concursos'),
    usuarios: adminResourcePath('usuarios'),
    vouchers: adminResourcePath('vouchers'),
  };

  const secureUrls = { ...fallbackLinks, ...links };

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(secureUrls.dashboard)}
        className="flex items-center"
      >
        <LayoutDashboard className="h-4 w-4 mr-2" />
        Dashboard
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(secureUrls.concursos)}
        className="flex items-center"
      >
        <FileText className="h-4 w-4 mr-2" />
        Concursos
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(secureUrls.usuarios)}
        className="flex items-center"
      >
        <Users className="h-4 w-4 mr-2" />
        Usuários
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate(secureUrls.vouchers)}
        className="flex items-center"
      >
        <Gift className="h-4 w-4 mr-2" />
        Vouchers
      </Button>
    </div>
  );
};

export default AdminMenu;
