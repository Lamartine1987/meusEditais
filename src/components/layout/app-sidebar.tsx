
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
import { Home } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar'; 

export function AppSidebar() {
  const pathname = usePathname();
  const { setOpenMobile, isMobile } = useSidebar(); 

  const closeMobileSidebar = () => {
    if (isMobile && typeof setOpenMobile === 'function') {
       setOpenMobile(false);
    }
  };

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon">
      <SidebarHeader className="border-b">
         <div className="flex items-center justify-center p-4 md:hidden"> {/* Ensure logo is visible on mobile */}
          <AppLogo />
        </div>
         <div className="hidden md:flex items-center justify-start p-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2"> {/* Adjust for collapsed state */}
          <div className="group-data-[collapsible=icon]:hidden"><AppLogo /></div>
          <Link href="/" className="hidden group-data-[collapsible=icon]:block">
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
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
