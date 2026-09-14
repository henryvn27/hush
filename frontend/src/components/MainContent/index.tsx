'use client';

import React from 'react';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';

interface MainContentProps {
  children: React.ReactNode;
}

const MainContent: React.FC<MainContentProps> = ({ children }) => {
  const { isCollapsed } = useSidebar();

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className={`hush-main-content h-dvh min-w-0 overflow-hidden bg-background transition-[margin,width] duration-200 ease-out ${
        isCollapsed
          ? 'ml-[4.5rem] w-[calc(100%-4.5rem)]'
          : 'ml-[15rem] w-[calc(100%-15rem)]'
      }`}
    >
      <div className="flex h-full min-w-0 flex-col">
        <header aria-hidden="true" className="titlebar h-8 shrink-0 border-b border-border/65 bg-background/85 backdrop-blur-xl" />
        <div className="min-h-0 flex-1 overflow-auto custom-scrollbar">
          {children}
        </div>
      </div>
    </main>
  );
};

export default MainContent;
