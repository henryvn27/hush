import React, { useState, useEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import Image from 'next/image';
import AnalyticsConsentSwitch from "./AnalyticsConsentSwitch";
import { UpdateDialog } from "./UpdateDialog";
import { updateService, UpdateInfo } from '@/services/updateService';
import { Button } from './ui/button';
import { ArrowPathIcon, ArrowTopRightOnSquareIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import { toast } from 'sonner';
import { APP_VERSION } from '@/lib/app-version';
import { getErrorMessage } from '@/lib/utils';


export function About() {
    const [currentVersion, setCurrentVersion] = useState<string>(APP_VERSION);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);

    useEffect(() => {
        // Get current version on mount
        getVersion().then((version) => {
            if (typeof version === 'string' && version.trim()) {
                setCurrentVersion(version);
            }
        }).catch(console.error);
    }, []);

    const handleUpstreamClick = async () => {
        try {
            await invoke('open_external_url', { url: 'https://github.com/Zackriya-Solutions/meetily' });
        } catch (error) {
            console.error('Failed to open link:', error);
        }
    };

    const handleCheckForUpdates = async () => {
        setIsChecking(true);
        try {
            const info = await updateService.checkForUpdates(true);
            setUpdateInfo(info);
            if (info.available) {
                setShowUpdateDialog(true);
            } else {
                toast.success('You are running the latest version');
            }
        } catch (error) {
            console.error('Failed to check for updates:', error);
            toast.error('Failed to check for updates: ' + getErrorMessage(error, 'Unknown error'));
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="h-[80vh] space-y-5 overflow-y-auto p-5">
            <div className="border-b border-border pb-5 text-center">
                <div className="mb-3">
                    <Image
                        src="icon_128x128.png"
                        alt="Hush logo"
                        width={64}
                        height={64}
                        className="mx-auto rounded-[14px]"
                    />
                </div>
                <p className="app-eyebrow">Hush / local voice desk</p>
                <h1 className="app-display mt-2 text-2xl">Hush</h1>
                <span className="mt-1 block text-xs text-muted-foreground">v{currentVersion}</span>
                <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                    A local-first desktop product for dictation, capture, and meeting memory without forced cloud accounts.
                </p>
                <div className="mt-3">
                    <Button
                        onClick={handleCheckForUpdates}
                        disabled={isChecking}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                    >
                        {isChecking ? (
                            <>
                                <ArrowPathIcon className="mr-2 h-3 w-3 animate-spin motion-reduce:animate-none" />
                                Checking...
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon className="mr-2 h-3 w-3" />
                                Check for Updates
                            </>
                        )}
                    </Button>
                    {updateInfo?.available && (
                        <div className="mt-2 text-xs text-accent">
                            Update available: v{updateInfo.version}
                        </div>
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-sm font-semibold text-foreground">What Hush is built for</h2>
                <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-control border border-border bg-muted/40 p-3">
                        <h3 className="mb-1 text-sm font-semibold text-foreground">Clearer workbench</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">A focused desktop shell makes capture, local readiness, recovery, and saved notes easier to scan.</p>
                    </div>
                    <div className="rounded-control border border-border bg-muted/40 p-3">
                        <h3 className="mb-1 text-sm font-semibold text-foreground">Local-first by default</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">Meeting data remains local. Remote processing happens only when you explicitly configure a remote provider.</p>
                    </div>
                    <div className="rounded-control border border-border bg-muted/40 p-3">
                        <h3 className="mb-1 text-sm font-semibold text-foreground">Reliable foundation</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">Capture, transcription, summaries, imports, recovery, and saved meetings stay available while the UI changes.</p>
                    </div>
                    <div className="rounded-control border border-border bg-muted/40 p-3">
                        <h3 className="mb-1 text-sm font-semibold text-foreground">Open source</h3>
                        <p className="text-xs leading-relaxed text-muted-foreground">Hush is public work built with clear attribution to the upstream MIT project.</p>
                    </div>
                </div>
            </div>

            <div className="rounded-control border border-accent/30 bg-accent-soft p-3">
                <p className="text-sm leading-5 text-foreground">
                    <span className="font-semibold">Upstream attribution.</span> Hush is an independent product based on Meetily by Zackriya Solutions. The original application and MIT license remain credited in this project.
                </p>
            </div>

            <div className="space-y-2 border-t border-border pt-4 text-center">
                <button
                    onClick={handleUpstreamClick}
                    className="inline-flex items-center gap-2 rounded-control bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                    View upstream Meetily <ArrowTopRightOnSquareIcon className="size-3.5" />
                </button>
            </div>
            <AnalyticsConsentSwitch />

            {/* Update Dialog */}
            <UpdateDialog
                open={showUpdateDialog}
                onOpenChange={setShowUpdateDialog}
                updateInfo={updateInfo}
            />
        </div>

    )
}
