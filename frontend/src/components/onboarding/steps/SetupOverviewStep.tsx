import React, { useEffect, useState } from 'react';
import { ArrowRightIcon, CpuChipIcon, InformationCircleIcon, LanguageIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { OnboardingContainer } from '../OnboardingContainer';
import { useOnboarding } from '@/contexts/OnboardingContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function SetupOverviewStep() {
  const { goNext } = useOnboarding();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    const checkPlatform = async () => {
      try {
        const { platform } = await import('@tauri-apps/plugin-os');
        setIsMac(platform() === 'macos');
      } catch (e) {
        setIsMac(navigator.userAgent.includes('Mac'));
      }
    };
    checkPlatform();
  }, []);

  const steps = [
    {
      icon: LanguageIcon,
      type: 'transcription',
      title: 'Download Transcription Engine',
    },
    {
      icon: CpuChipIcon,
      type: 'summarization',
      title: 'Download Summarization Engine',
    },
  ];

  const handleContinue = () => {
    goNext();
  };

  return (
    <OnboardingContainer
      title="Set up local intelligence."
      description="Download the transcription and summary models Meetily uses on this device."
      step={2}
      totalSteps={isMac ? 4 : 3}
    >
      <div className="max-w-[680px]">
        <div className="divide-y divide-border border-y border-border">
          <div>
            {steps.map((step, idx) => {
              return (
                <div
                  key={step.title}
                  className="grid grid-cols-[36px_1fr_auto] items-center gap-4 py-4"
                >
                  <span className="grid size-8 place-items-center rounded-[8px] border border-border bg-card"><step.icon className="size-[17px] text-muted-foreground" /></span>
                  <div className="flex-1">
                    <h3 className="flex items-center gap-2 text-[13px] font-medium tracking-[-0.01em]">
                        {step.title}

                        {step.type === "summarization" && (
                            <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <button aria-label="About summary providers" className="text-muted-foreground hover:text-foreground">
                                    <InformationCircleIcon className="size-4" />
                                </button>
                                </TooltipTrigger>
                                <TooltipContent className="max-w-xs text-sm">
                                You can also select external AI providers like OpenAI, Claude, or
                                Ollama for summary generation in settings.
                                </TooltipContent>
                            </Tooltip>
                            </TooltipProvider>
                        )}
                        </h3>
                  </div>
                  <span className="text-[11px] text-muted-foreground">Included</span>
                </div>
              );
            })}
          </div>
        </div>


        {/* CTA Section */}
        <div className="mt-8 flex items-center gap-4">
          <Button
            onClick={handleContinue}
            className="h-9"
          >
            Download models <ArrowRightIcon className="size-4" />
          </Button>
          <div>
            <a
              href="https://github.com/henryvn27/meetily_improved/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline"
            >
              Report issues on GitHub
            </a>
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
}
