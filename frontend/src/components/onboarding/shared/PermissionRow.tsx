import React from 'react';
import { ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { PermissionRowProps } from '@/types/onboarding';

export function PermissionRow({ icon, title, description, status, isPending = false, onAction }: PermissionRowProps) {
  const isAuthorized = status === 'authorized';
  const isDenied = status === 'denied';
  const isChecking = isPending;

  const getButtonText = () => {
    if (isChecking) return 'Checking...';
    if (isDenied) return 'Open Settings';
    return 'Enable';
  };

  return (
    <div
      className={cn(
        'grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-4 py-4',
        isAuthorized ? 'text-success' : isDenied ? 'text-destructive' : 'text-foreground'
      )}
    >
      <div className={cn('grid size-9 place-items-center rounded-[9px] border bg-card', isAuthorized ? 'border-success/25' : isDenied ? 'border-destructive/25' : 'border-border')}>
        <div className={cn('[&_svg]:size-[18px]', isAuthorized ? 'text-success' : isDenied ? 'text-destructive' : 'text-muted-foreground')}>{icon}</div>
      </div>

        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-foreground">{title}</div>
          <div className="mt-1 text-[11px] leading-4 text-muted-foreground">
            {isAuthorized ? (
              <span className="flex items-center gap-1.5 text-success">
                <CheckCircleIcon className="size-3.5" />
                Allowed
              </span>
            ) : isDenied ? (
              <span className="flex items-center gap-1.5 text-destructive">
                <ExclamationCircleIcon className="size-3.5" />
                Needs attention in System Settings
              </span>
            ) : (
              <span>{description}</span>
            )}
          </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {!isAuthorized && (
          <Button
            variant={isDenied ? "destructive" : "outline"}
            size="sm"
            onClick={onAction}
            disabled={isChecking}
            className="min-w-[96px]"
          >
            {isChecking && <ArrowPathIcon className="size-4 animate-spin" />}
            {getButtonText()}
          </Button>
        )}
        {isAuthorized && (
          <CheckCircleIcon className="size-5 text-success" />
        )}
      </div>
    </div>
  );
}
