import React, { useContext, useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  ArrowPathIcon,
  CheckIcon,
  ClipboardIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { AnalyticsContext } from './AnalyticsProvider';
import { load } from '@tauri-apps/plugin-store';
import { invoke } from '@tauri-apps/api/core';
import { Analytics } from '@/lib/analytics';
import { openAnalyticsDetailsForNativeQa } from '@/lib/native-qa-mode';
import AnalyticsDataModal from './AnalyticsDataModal';

const ANALYTICS_DEFAULT_OFF_MIGRATION_KEY = 'analyticsDefaultOffMigrationV1';

export default function AnalyticsConsentSwitch() {
  const { setIsAnalyticsOptedIn, isAnalyticsOptedIn } = useContext(AnalyticsContext);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showModal, setShowModal] = useState(openAnalyticsDetailsForNativeQa);
  const [userId, setUserId] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  // Note: Store loading is handled by AnalyticsProvider to avoid race conditions

  useEffect(() => {
    const loadUserId = async () => {
      if (isAnalyticsOptedIn) {
        try {
          const id = await Analytics.getPersistentUserId();
          setUserId(id);
        } catch (error) {
          console.error('Failed to load user ID:', error);
        }
      } else {
        setUserId('');
      }
    };
    loadUserId();
  }, [isAnalyticsOptedIn]);

  const handleCopyUserId = async () => {
    if (!userId) return;

    try {
      await navigator.clipboard.writeText(userId);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);

      // Track that user copied their ID
      await Analytics.track('user_id_copied', {
        user_id: userId
      });
    } catch (error) {
      console.error('Failed to copy user ID:', error);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    // If user is trying to DISABLE, show the modal first
    if (!enabled) {
      setShowModal(true);
      // Track that user viewed the transparency modal
      try {
        await invoke('track_analytics_transparency_viewed');
      } catch (error) {
        console.error('Failed to track transparency view:', error);
      }
      return; // Don't disable yet, wait for modal confirmation
    }

    // If ENABLING, proceed immediately
    await performToggle(enabled);
  };

  const performToggle = async (enabled: boolean) => {
    // Optimistic update - immediately update UI state
    setIsAnalyticsOptedIn(enabled);
    setIsProcessing(true);

    try {
      const store = await load('analytics.json', {
        autoSave: false,
        defaults: {
          analyticsOptedIn: false
        }
      });
      await store.set('analyticsOptedIn', enabled);
      await store.set(ANALYTICS_DEFAULT_OFF_MIGRATION_KEY, true);
      await store.save();

      if (enabled) {
        // Full analytics initialization (same as AnalyticsProvider)
        const userId = await Analytics.getPersistentUserId();

        // Initialize analytics
        await Analytics.init();

        // Identify user with enhanced properties immediately after init
        await Analytics.identify(userId, {
          app_version: '0.4.0',
          platform: 'tauri',
          first_seen: new Date().toISOString(),
          os: navigator.platform,
        });

        // Start analytics session with the same user ID
        await Analytics.startSession(userId);

        // Track app started (re-enabled)
        await Analytics.trackAppStarted();

        // Track that user enabled analytics
        try {
          await invoke('track_analytics_enabled');
        } catch (error) {
          console.error('Failed to track analytics enabled:', error);
        }

        console.log('Analytics re-enabled successfully');
      } else {
        // Track that user disabled analytics BEFORE disabling
        try {
          await invoke('track_analytics_disabled');
        } catch (error) {
          console.error('Failed to track analytics disabled:', error);
        }

        await Analytics.disable();
        console.log('Analytics disabled successfully');
      }
    } catch (error) {
      console.error('Failed to toggle analytics:', error);
      // Revert the optimistic update on error
      setIsAnalyticsOptedIn(!enabled);
      // You could also show a toast notification here to inform the user
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDisable = async () => {
    setShowModal(false);
    await performToggle(false);
  };

  const handleCancelDisable = () => {
    setShowModal(false);
    // Keep analytics enabled, no state change needed
  };

  const handlePrivacyPolicyClick = async () => {
    try {
      await invoke('open_external_url', { url: 'https://github.com/henryvn27/meetily_improved#privacy-and-data-boundary' });
    } catch (error) {
      console.error('Failed to open privacy policy link:', error);
    }
  };

  return (
    <>
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-base font-semibold text-foreground">Usage Analytics</h3>
          <p className="mb-4 text-sm text-muted-foreground">
            Usage analytics is off by default. You can turn it on to share anonymous product and performance data; no personal content is collected.
          </p>
        </div>

        <div className="flex items-center justify-between border border-border bg-muted/50 p-3">
          <div>
            <h4 className="font-semibold text-foreground">Enable Analytics</h4>
            <p className="text-sm text-muted-foreground">
              {isProcessing ? 'Updating...' : 'Off unless you choose to enable it'}
            </p>
          </div>
          <div className="flex items-center gap-2 ml-4">
            {isProcessing && (
              <ArrowPathIcon className="size-4 animate-spin text-muted-foreground" aria-hidden="true" />
            )}
            <Switch
              checked={isAnalyticsOptedIn}
              onCheckedChange={handleToggle}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* User ID Display */}
        {isAnalyticsOptedIn && userId && (
          <div className="border border-border bg-muted/50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="mb-1 font-medium text-foreground">Your User ID</div>
                <p className="mb-2 text-xs text-muted-foreground">
                  Share this ID when reporting issues to help us investigate your issue logs
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate border border-input bg-card px-2 py-1 font-mono text-xs text-foreground">
                    {userId}
                  </code>
                  <Button
                    onClick={handleCopyUserId}
                    variant="outline"
                    size="sm"
                    className="flex-shrink-0"
                    title="Copy User ID"
                  >
                    {isCopied ? (
                      <>
                        <CheckIcon className="size-3.5 text-success" aria-hidden="true" />
                        <span className="text-success">Copied</span>
                      </>
                    ) : (
                      <>
                        <ClipboardIcon className="size-3.5" aria-hidden="true" />
                        <span>Copy</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 border border-accent/30 bg-accent-soft p-2">
          <InformationCircleIcon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
          <div className="text-xs text-foreground">
            <p className="mb-1">
              Meetings, transcripts, recordings, and local models stay on this device. Remote summary providers only receive data when you explicitly configure and use one.
            </p>
            <button
              onClick={handlePrivacyPolicyClick}
              className="text-accent underline hover:text-foreground hover:no-underline"
            >
              Read privacy and data boundary
            </button>
          </div>
        </div>
      </div>

      {/* 2-Step Opt-Out Modal */}
      <AnalyticsDataModal
        isOpen={showModal}
        onClose={handleCancelDisable}
        onConfirmDisable={handleConfirmDisable}
      />
    </>
  );
}
