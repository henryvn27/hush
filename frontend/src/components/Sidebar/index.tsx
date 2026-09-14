'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { ConfirmationModal } from '@/components/ConfirmationModel/confirmation-modal';
import Logo from '@/components/Logo';
import Info from '@/components/Info';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { useConfig } from '@/contexts/ConfigContext';
import { useImportDialog } from '@/contexts/ImportDialogContext';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { cn } from '@/lib/utils';
import Analytics from '@/lib/analytics';
import { APP_VERSION_LABEL } from '@/lib/app-version';
import { MeetilyGlyph } from '@/components/app-shell/MeetilyGlyph';
import { useSidebar } from './SidebarProvider';

const primaryNavigation = [
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'New dictation', href: '/new-meeting', icon: 'capture' },
  { label: 'History', href: '/meetings', icon: 'library' },
  { label: 'Timeline', href: '/timeline', icon: 'library' },
  { label: 'Ask your archive', href: '/chat', icon: 'recall' },
] as const;

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    currentMeeting,
    setCurrentMeeting,
    isCollapsed,
    toggleCollapse,
    handleRecordingToggle,
    meetings,
    setMeetings,
  } = useSidebar();
  const { isRecording, isStopping, isProcessing, isSaving } = useRecordingState();
  const isPostProcessing = isStopping || isProcessing || isSaving;
  const { openImportDialog } = useImportDialog();
  const { betaFeatures } = useConfig();
  const [deleteMeetingId, setDeleteMeetingId] = useState<string | null>(null);
  const [editingMeeting, setEditingMeeting] = useState<{ id: string; title: string } | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isMobileSidebar, setIsMobileSidebar] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const sidebarCollapsed = isMobileSidebar ? !mobileSidebarOpen : isCollapsed;
  const toggleSidebar = () => {
    if (isMobileSidebar) setMobileSidebarOpen((open) => !open);
    else toggleCollapse();
  };

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 720px)');
    const syncMobileSidebar = () => {
      setIsMobileSidebar(mediaQuery.matches);
      setMobileSidebarOpen(false);
    };
    syncMobileSidebar();
    setMobileSidebarOpen(false);
    mediaQuery.addEventListener('change', syncMobileSidebar);
    return () => mediaQuery.removeEventListener('change', syncMobileSidebar);
  }, []);

  const openSettings = useCallback(() => {
    router.push('/settings');
  }, [router]);

  useEffect(() => {
    window.openSettings = openSettings;
    return () => {
      delete window.openSettings;
    };
  }, [openSettings]);

  const openMeeting = (id: string, title: string) => {
    if (isPostProcessing) return;
    setCurrentMeeting({ id, title });
    router.push(`/meeting-details?id=${id}`);
  };

  const handleDelete = async () => {
    if (!deleteMeetingId || isPostProcessing) return;

    try {
      await invoke('api_delete_meeting', { meetingId: deleteMeetingId });
      setMeetings(meetings.filter((meeting) => meeting.id !== deleteMeetingId));
      Analytics.trackMeetingDeleted(deleteMeetingId);
      if (currentMeeting?.id === deleteMeetingId) router.push('/');
      toast.success('Meeting deleted');
    } catch (error) {
      toast.error('Could not delete meeting', {
        description: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setDeleteMeetingId(null);
    }
  };

  const beginEditing = (id: string, title: string) => {
    if (isPostProcessing) return;
    setEditingMeeting({ id, title });
    setEditingTitle(title);
  };

  const saveTitle = async () => {
    if (isPostProcessing) return;
    const title = editingTitle.trim();
    if (!editingMeeting || !title) {
      toast.error('Meeting title cannot be empty');
      return;
    }

    try {
      await invoke('api_save_meeting_title', { meetingId: editingMeeting.id, title });
      setMeetings(meetings.map((meeting) => meeting.id === editingMeeting.id ? { ...meeting, title } : meeting));
      if (currentMeeting?.id === editingMeeting.id) setCurrentMeeting({ id: editingMeeting.id, title });
      toast.success('Meeting title updated');
      setEditingMeeting(null);
    } catch (error) {
      toast.error('Could not update meeting title', {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/meetings') return pathname === '/meetings' || pathname === '/meeting-details';
    return pathname === href;
  };

  const navigationButton = (item: typeof primaryNavigation[number]) => {
    const button = (
      <button
        key={item.href}
        type="button"
        onClick={() => !isPostProcessing && router.push(item.href)}
        disabled={isPostProcessing}
        aria-label={item.label}
        aria-disabled={isPostProcessing}
        aria-current={isActive(item.href) ? 'page' : undefined}
        className={cn(
          'hush-sidebar-nav-button group flex min-h-9 items-center rounded-[5px] text-[13px] font-medium tracking-[-0.01em] transition-colors disabled:cursor-not-allowed disabled:opacity-45',
          sidebarCollapsed ? 'w-10 justify-center' : 'w-full gap-3 px-3',
          isActive(item.href)
            ? 'bg-[hsl(var(--accent-soft))] text-[hsl(var(--sidebar-foreground))]'
            : 'text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-foreground))]',
        )}
      >
        <MeetilyGlyph name={item.icon} className={cn('size-[1.1rem] shrink-0', isActive(item.href) && 'text-accent')} />
        {!sidebarCollapsed && <span>{item.label}</span>}
      </button>
    );

    if (!sidebarCollapsed) return button;
    return (
      <Tooltip key={item.href}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      aria-label="Hush workspace"
      className={cn(
        'hush-sidebar fixed inset-y-0 left-0 z-40 flex bg-[hsl(var(--sidebar)/0.94)] text-[hsl(var(--sidebar-foreground))] transition-[width] duration-200 ease-out',
        sidebarCollapsed ? 'w-[4.5rem]' : 'w-[15rem]',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col px-3 pb-4 pt-4">
        <div className={cn('flex min-h-11 items-center border-b border-[hsl(var(--sidebar-border))] pb-3', sidebarCollapsed ? 'justify-center' : 'justify-between gap-2 px-0')}>
          <Logo isCollapsed={sidebarCollapsed} />
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Collapse sidebar"
              className="grid size-9 place-items-center rounded-[3px] text-[hsl(var(--sidebar-muted))] transition-colors hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-foreground))]"
            >
              <MeetilyGlyph name="chevron-left" className="size-[1.1rem]" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Expand sidebar"
            aria-expanded={!sidebarCollapsed}
            className="mx-auto mt-3 grid size-10 place-items-center rounded-[3px] text-[hsl(var(--sidebar-muted))] transition-colors hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-foreground))]"
          >
            <MeetilyGlyph name="chevron-right" className="size-[1.1rem]" />
          </button>
        )}

        {!sidebarCollapsed && <p className="hush-sidebar-section-label mt-5 px-2">Workspace</p>}
        <nav aria-label="Primary" className={cn('space-y-1', sidebarCollapsed ? 'mt-4' : 'mt-2')}>
          {primaryNavigation.map(navigationButton)}
        </nav>

        {!sidebarCollapsed && (
          <div className="mt-6 flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between px-1">
              <p className="hush-sidebar-section-label">Recent flows</p>
            </div>

            <div className="app-rail-scrollbar mt-1.5 min-h-0 flex-1 overflow-y-auto custom-scrollbar">
              {meetings.length === 0 ? (
                <p className="px-2 py-4 text-xs leading-5 text-[hsl(var(--sidebar-muted))]">
                  Your local history will appear here.
                </p>
              ) : (
                <ul className="space-y-0.5">
                  {meetings.map((meeting) => (
                    <li key={meeting.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => openMeeting(meeting.id, meeting.title)}
                        disabled={isPostProcessing}
                        className={cn(
                          'min-h-10 w-full truncate rounded-[3px] py-2 pl-3 pr-16 text-left text-[13px] tracking-[-0.01em] text-[hsl(var(--sidebar-muted))] transition-colors hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-foreground))] disabled:cursor-not-allowed disabled:opacity-45',
                          currentMeeting?.id === meeting.id && pathname === '/meeting-details' && 'bg-[hsl(var(--accent-soft))] font-medium text-[hsl(var(--sidebar-foreground))]',
                        )}
                      >
                        {meeting.title}
                      </button>
                      <div className="absolute right-1 top-1/2 flex -translate-y-1/2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                        <button type="button" onClick={() => beginEditing(meeting.id, meeting.title)} disabled={isPostProcessing} aria-label={`Rename ${meeting.title}`} className="grid size-7 place-items-center rounded-md text-[hsl(var(--sidebar-muted))] hover:bg-white/10 hover:text-[hsl(var(--sidebar-foreground))] disabled:cursor-not-allowed disabled:opacity-50">
                          <MeetilyGlyph name="pencil" className="size-3.5" />
                        </button>
                        <button type="button" onClick={() => setDeleteMeetingId(meeting.id)} disabled={isPostProcessing} aria-label={`Delete ${meeting.title}`} className="grid size-7 place-items-center rounded-md text-[hsl(var(--sidebar-muted))] hover:bg-white/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-50">
                          <MeetilyGlyph name="trash" className="size-3.5" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className={cn('hush-sidebar-footer mt-auto border-t border-[hsl(var(--sidebar-border))] pt-4', sidebarCollapsed ? 'space-y-1.5' : 'space-y-2')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={handleRecordingToggle}
                disabled={isRecording || isPostProcessing}
                aria-label={isPostProcessing ? 'Finishing meeting' : isRecording ? 'Recording active' : 'Open recorder'}
                className={cn(
                  'hush-sidebar-start-button flex min-h-10 items-center justify-center rounded-md text-[13px] font-semibold tracking-[-0.01em] transition-[background,color,transform] active:translate-y-px disabled:cursor-default',
                  sidebarCollapsed ? 'w-10' : 'w-full gap-2.5 px-3',
                  isRecording
                    ? 'bg-accent text-accent-foreground'
                    : isPostProcessing
                      ? 'bg-[hsl(var(--sidebar-hover))] text-[hsl(var(--sidebar-foreground))]'
                      : 'bg-primary text-primary-foreground hover:bg-primary/88',
                )}
              >
                {isPostProcessing ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" aria-hidden="true" /> : <MeetilyGlyph name="capture" className="size-4" />}
                {!sidebarCollapsed && <span>{isPostProcessing ? 'Finishing meeting' : isRecording ? 'Recording active' : 'Start recording'}</span>}
              </button>
            </TooltipTrigger>
            {sidebarCollapsed && <TooltipContent side="right">{isPostProcessing ? 'Finishing meeting' : isRecording ? 'Recording active' : 'Start recording'}</TooltipContent>}
          </Tooltip>

          {betaFeatures.importAndRetranscribe && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" aria-label="Import audio" onClick={() => openImportDialog()} disabled={isPostProcessing} className={cn('flex min-h-9 items-center rounded-md text-[13px] font-medium text-[hsl(var(--sidebar-muted))] transition-colors hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-foreground))] disabled:cursor-not-allowed disabled:opacity-45', sidebarCollapsed ? 'w-9 justify-center' : 'w-full gap-2.5 px-2.5')}>
                  <MeetilyGlyph name="import" className="size-[1.1rem]" />
                  {!sidebarCollapsed && <span>Import audio</span>}
                </button>
              </TooltipTrigger>
              {sidebarCollapsed && <TooltipContent side="right">Import audio</TooltipContent>}
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
                <button type="button" onClick={openSettings} disabled={isPostProcessing} aria-label="Settings" aria-current={pathname === '/settings' ? 'page' : undefined} className={cn('flex min-h-9 items-center rounded-md text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45', sidebarCollapsed ? 'w-9 justify-center' : 'w-full gap-2.5 px-2.5', pathname === '/settings' ? 'bg-[hsl(var(--accent-soft))] text-[hsl(var(--sidebar-foreground))]' : 'text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-foreground))]')}>
                <MeetilyGlyph name="settings" className={cn('size-[1.1rem]', pathname === '/settings' && 'text-accent')} />
                {!sidebarCollapsed && <span>Settings</span>}
              </button>
            </TooltipTrigger>
            {sidebarCollapsed && <TooltipContent side="right">Settings</TooltipContent>}
          </Tooltip>

          <div className={cn('flex items-center text-[hsl(var(--sidebar-muted))]', sidebarCollapsed ? 'justify-center' : 'justify-between px-1')}>
            <Info isCollapsed={sidebarCollapsed} />
            {!sidebarCollapsed && <span className="text-xs tabular-nums">{APP_VERSION_LABEL}</span>}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={deleteMeetingId !== null}
        text="Delete this meeting and its associated local data? This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteMeetingId(null)}
      />

      <Dialog open={editingMeeting !== null} onOpenChange={(open) => !open && setEditingMeeting(null)}>
        <DialogContent className="sm:max-w-[26rem]">
          <VisuallyHidden><DialogTitle>Rename meeting</DialogTitle></VisuallyHidden>
          <div className="py-2">
            <label htmlFor="meeting-title" className="mb-2 block text-sm font-medium">Meeting title</label>
            <input
              id="meeting-title"
              value={editingTitle}
              onChange={(event) => setEditingTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void saveTitle();
                if (event.key === 'Escape') setEditingMeeting(null);
              }}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              autoFocus
            />
          </div>
          <DialogFooter>
            <button type="button" onClick={() => setEditingMeeting(null)} className="min-h-10 rounded-lg px-4 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground">Cancel</button>
            <button type="button" onClick={() => void saveTitle()} className="min-h-10 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90">Save</button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}

declare global {
  interface Window {
    openSettings?: () => void;
  }
}
