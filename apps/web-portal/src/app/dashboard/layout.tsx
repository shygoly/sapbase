'use client'

import KBar from '@sap/app-shared/components/kbar';
import Header from '@sap/app-shared/components/layout/header';
import { PiAgentShell } from '@sap/app-shared/components/piagent/assistant-shell';
import { InfoSidebar } from '@sap/app-shared/components/layout/info-sidebar';
import { InfobarProvider } from '@sap/app-shared/components/ui/infobar';
import { SidebarInset, SidebarProvider } from '@sap/app-shared/components/ui/sidebar';
import { UnifiedSidebar } from '@sap/app-shared/components/layout/unified-sidebar';
import { useEffect, useState } from 'react';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const [defaultOpen, setDefaultOpen] = useState(true);

  useEffect(() => {
    // Get sidebar state from cookie on client side
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith('sidebar_state='))
      ?.split('=')[1];
    setDefaultOpen(cookieValue === 'true');
  }, []);

  return (
    <KBar>
      <SidebarProvider defaultOpen={defaultOpen}>
        <InfobarProvider defaultOpen={false}>
          <UnifiedSidebar source="api" />
          <SidebarInset>
            <Header assistant={<PiAgentShell />} />
            {/* page main content */}
            {children}
            {/* page main content ends */}
          </SidebarInset>
          <InfoSidebar side='right' />
        </InfobarProvider>
      </SidebarProvider>
    </KBar>
  );
}
