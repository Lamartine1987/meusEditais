
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import { AppLogo } from './app-logo';
import { Home, Briefcase, BarChart3, Gem } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar'; 
import { useAuth } from '@/hooks/use-auth';

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { setOpenMobile, isMobile } = useSidebar(); 

  const closeMobileSidebar = () => {
    if (isMobile && typeof setOpenMobile === 'function') {
       setOpenMobile(false);
    }
  };

  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="border-b">
         <div className="flex items-center justify-center p-4 md:hidden"> {/* Ensure logo is visible on mobile */}
          <AppLogo />
        </div>
         <div className="hidden md:flex items-center justify-start p-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2 group-data-[collapsible=offcanvas]:p-4"> {/* Adjust for collapsed state */}
          <div className="group-data-[collapsible=icon]:hidden group-data-[collapsible=offcanvas]:block"><AppLogo /></div>
          <Link href="/" className="hidden group-data-[collapsible=icon]:block group-data-[collapsible=offcanvas]:hidden">
            <Home className="h-6 w-6 text-primary"/>
          </Link>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/'}
              tooltip={{content: "Página Inicial", side:"right", align:"center"}}
              onClick={closeMobileSidebar}
            >
              <Link href="/">
                <Home />
                <span>Página Inicial</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {user && (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/meus-editais'}
                  tooltip={{content: "Meus Cargos", side:"right", align:"center"}}
                  onClick={closeMobileSidebar}
                >
                  <Link href="/meus-editais">
                    <Briefcase />
                    <span>Meus Cargos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === '/estatisticas'}
                  tooltip={{content: "Estatísticas", side:"right", align:"center"}}
                  onClick={closeMobileSidebar}
                >
                  <Link href="/estatisticas">
                    <BarChart3 />
                    <span>Estatísticas</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/planos'}
              tooltip={{content: "Nossos Planos", side:"right", align:"center"}}
              onClick={closeMobileSidebar}
              variant={pathname === '/planos' ? 'default' : 'ghost'} 
              className={pathname === '/planos' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}
            >
              <Link href="/planos">
                <Gem />
                <span>Nossos Planos</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
