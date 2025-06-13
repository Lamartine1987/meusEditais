
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserNav } from './user-nav';
import { AppLogo } from './app-logo';
import { useAuth } from '@/hooks/use-auth';
import { Briefcase, Gem } from 'lucide-react';

export function AppHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      {/* SidebarTrigger agora visível em todas as telas */}
      <div className="flex items-center gap-2">
        <SidebarTrigger />
      </div>
      {/* AppLogo visível apenas em desktop (md e maior) */}
      <div className="hidden md:block">
         <AppLogo />
      </div>
      
      <div className="ml-auto flex items-center gap-2 sm:gap-4">
        {user && (
          <Button variant="outline" asChild>
            <Link href="/meus-editais">
              <Briefcase className="mr-2 h-4 w-4" />
              Meus Cargos
            </Link>
          </Button>
        )}
        <Button variant="premium" asChild>
          <Link href="/planos">
            <Gem className="mr-2 h-4 w-4" />
            Ver Planos
          </Link>
        </Button>
        <UserNav />
      </div>
    </header>
  );
}
