
import type { ReactNode } from 'react';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { SidebarInset } from '@/components/ui/sidebar';

interface PageWrapperProps {
  children: ReactNode;
}

export function PageWrapper({ children }: PageWrapperProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40"> {/* Added bg-muted/40 for overall page background consistency with globals */}
      <AppSidebar />
      <SidebarInset> {/* SidebarInset handles the main content area positioning */}
        <AppHeader />
        <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-6 bg-background shadow-inner"> {/* Added bg-background to main content area for contrast */}
          {children}
        </main>
      </SidebarInset>
    </div>
  );
}
