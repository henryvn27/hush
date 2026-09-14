'use client';

import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowPathIcon, CheckCircleIcon, CircleStackIcon, FolderOpenIcon, XCircleIcon } from '@heroicons/react/24/outline';
import { HomebrewDatabaseDetector } from './HomebrewDatabaseDetector';

interface LegacyDatabaseImportProps {
  isOpen: boolean;
  onComplete: () => void;
}

type ImportState = 'idle' | 'selecting' | 'detecting' | 'importing' | 'success' | 'error';

export function LegacyDatabaseImport({ isOpen, onComplete }: LegacyDatabaseImportProps) {
  const [importState, setImportState] = useState<ImportState>('idle');
  const [detectedPath, setDetectedPath] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleBrowse = async () => {
    try {
      setImportState('selecting');

      // Open file picker
      const selectedPath = await invoke<string | null>('select_legacy_database_path');

      if (!selectedPath) {
        setImportState('idle');
        return;
      }

      setImportState('detecting');

      // Detect database from selected path
      const dbPath = await invoke<string | null>('detect_legacy_database', {
        selectedPath,
      });

      if (dbPath) {
        setDetectedPath(dbPath);
        setImportState('idle');
      } else {
        setErrorMessage('No database found at selected location. Please select the Meetily folder, backend folder, or the database file directly.');
        setDetectedPath(null);
        setImportState('error');
        setTimeout(() => setImportState('idle'), 3000);
      }
    } catch (error) {
      console.error('Error browsing for database:', error);
      setErrorMessage(String(error));
      setImportState('error');
      setTimeout(() => setImportState('idle'), 3000);
    }
  };

  const handleImport = async () => {
    if (!detectedPath) return;

    try {
      setImportState('importing');

      await invoke('import_and_initialize_database', {
        legacyDbPath: detectedPath,
      });

      setImportState('success');
      toast.success('Database imported successfully! Reloading...');

      // Wait 1 second for user to see success, then reload window to refresh all data
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error importing database:', error);
      setErrorMessage(String(error));
      setImportState('error');
      toast.error(`Import failed: ${error}`);
      setTimeout(() => setImportState('idle'), 3000);
    }
  };

  const handleStartFresh = async () => {
    try {
      setImportState('importing');

      await invoke('initialize_fresh_database');

      setImportState('success');
      toast.success('Database initialized successfully! Starting app...');

      // Wait 1 second for user to see success, then reload window to start fresh
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Error initializing database:', error);
      setErrorMessage(String(error));
      setImportState('error');
      toast.error(`Initialization failed: ${error}`);
      setTimeout(() => setImportState('idle'), 3000);
    }
  };

  const isLoading = ['selecting', 'detecting', 'importing'].includes(importState);
  const canImport = detectedPath && importState === 'idle';

  const handleHomebrewImportSuccess = () => {
    // The HomebrewDatabaseDetector handles the reload itself
    onComplete();
  };

  const handleHomebrewDecline = () => {
    // User declined homebrew import, they can continue with manual browse
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[600px]" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="text-2xl">Welcome to Hush!</DialogTitle>
          <DialogDescription className="text-base pt-2">
            Do you have data from a previous Meetily installation?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Homebrew Database Auto-Detection */}
          <HomebrewDatabaseDetector 
            onImportSuccess={handleHomebrewImportSuccess}
            onDecline={handleHomebrewDecline}
          />

          {/* Browse Section */}
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Select your previous Meetily folder, backend directory, or database file:
            </p>

            <button
              onClick={handleBrowse}
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 bg-accent px-4 py-3 text-accent-foreground transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {importState === 'selecting' || importState === 'detecting' ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                  <span>{importState === 'selecting' ? 'Selecting...' : 'Detecting database...'}</span>
                </>
              ) : (
                <>
                  <FolderOpenIcon className="h-5 w-5" />
                  <span>Browse for Database</span>
                </>
              )}
            </button>
          </div>

          {/* Detection Result */}
          {detectedPath && (
            <div className="border border-[hsl(var(--success)/0.25)] bg-[hsl(var(--success)/0.10)] p-3">
              <div className="flex items-start gap-2">
                <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-[hsl(var(--success))]" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Database found!</p>
                  <p className="mt-1 break-all text-xs text-muted-foreground">{detectedPath}</p>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {importState === 'error' && errorMessage && (
            <div className="border border-destructive/25 bg-destructive/10 p-3">
              <div className="flex items-start gap-2">
                <XCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="flex-1">
                  <p className="text-sm text-foreground">{errorMessage}</p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <button
              onClick={handleImport}
              disabled={!canImport || isLoading}
              className="flex w-full items-center justify-center gap-2 bg-[hsl(var(--success))] px-4 py-3 text-[hsl(var(--success-foreground))] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {importState === 'importing' ? (
                <>
                  <ArrowPathIcon className="h-5 w-5 animate-spin motion-reduce:animate-none" />
                  <span>Importing...</span>
                </>
              ) : importState === 'success' ? (
                <>
                  <CheckCircleIcon className="h-5 w-5" />
                  <span>Success!</span>
                </>
              ) : (
                <>
                  <CircleStackIcon className="h-5 w-5" />
                  <span>Import Database</span>
                </>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <button
              onClick={handleStartFresh}
              disabled={isLoading}
              className="w-full border border-border px-4 py-3 text-foreground transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-45"
            >
              Start Fresh (No Import)
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
