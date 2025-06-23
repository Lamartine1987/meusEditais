
"use client";

import Link from 'next/link';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from '@/hooks/use-auth';
import { LogOut, User as UserIcon, LogIn } from 'lucide-react';
import { Skeleton } from '../ui/skeleton';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { PlanId } from '@/types';

export function UserNav() {
  const { user, logout, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  if (loading) {
    return <Skeleton className="h-10 w-10 rounded-full sm:w-28" />;
  }

  const handleLogout = async () => {
    try {
      await logout();
      toast({ title: "Logout realizado", description: "Você foi desconectado."});
      // O redirecionamento já é feito dentro da função logout no AuthProvider
    } catch (error) {
      toast({ title: "Erro no Logout", description: "Não foi possível desconectar.", variant: "destructive"});
    }
  }

  if (!user) {
    return (
      <Button asChild variant="outline">
        <Link href="/login">
          <LogIn className="mr-2 h-4 w-4" />
          Entrar
        </Link>
      </Button>
    );
  }

  const getInitials = (name?: string) => {
    if (!name || name.trim() === '') return '?';
    const nameParts = name.split(' ').filter(part => part.length > 0);
    if (nameParts.length === 0) return '?';
    if (nameParts.length === 1) return nameParts[0][0].toUpperCase();
    return (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase();
  }

  const getDisplayName = (name?: string) => {
    if (!name || name.trim() === '') return 'Usuário';
    const nameParts = name.split(' ').filter(part => part.length > 0);
    if (nameParts.length <= 2) {
      return nameParts.join(' ');
    }
    return nameParts.slice(0, 2).join(' ');
  }

  const getPlanDisplayName = (planId: PlanId): string => {
    switch (planId) {
      case 'plano_cargo': return "Plano Cargo";
      case 'plano_edital': return "Plano Edital";
      case 'plano_anual': return "Plano Anual";
      case 'plano_trial': return "Teste Gratuito";
      default: return "Plano";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-auto py-1 px-2 space-x-2 rounded-full flex items-center">
            <div className="hidden sm:flex flex-col items-end text-right">
                {user.name && <span className="text-sm font-medium leading-none">{getDisplayName(user.name)}</span>}
                {user.activePlan && <span className="text-xs font-semibold leading-none bg-gradient-to-r from-purple-500 to-pink-500 text-transparent bg-clip-text">{getPlanDisplayName(user.activePlan)}</span>}
            </div>
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatarUrl} alt={user.name || 'Avatar'} data-ai-hint="user avatar" />
            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.name || 'Usuário'}</p>
            {user.email && 
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            }
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/perfil">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Perfil</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sair</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
