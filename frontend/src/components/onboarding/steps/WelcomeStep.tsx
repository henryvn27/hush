import React from 'react';
import { ArrowRightIcon, CpuChipIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { OnboardingContainer } from '../OnboardingContainer';
import { useOnboarding } from '@/contexts/OnboardingContext';

export function WelcomeStep() {
  const { goNext } = useOnboarding();

  const features = [
    {
      icon: LockClosedIcon,
      title: 'Private on your Mac',
      description: 'Recordings and transcripts remain on this device.',
    },
    {
      icon: SparklesIcon,
      title: 'Recall what mattered',
      description: 'Turn transcripts into clear summaries and searchable notes.',
    },
    {
      icon: CpuChipIcon,
      title: 'Works offline',
      description: 'Local models are included. Remote providers stay optional.',
    },
  ];

  return (
    <OnboardingContainer
      title="Your meeting workbench."
      description="Record, transcribe, and revisit meetings with a local-first workflow."
      step={1}
      hideProgress={true}
    >
      <div className="flex max-w-[680px] flex-col">
        <div className="divide-y divide-border border-y border-border">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div key={index} className="grid grid-cols-[36px_1fr] gap-4 py-4">
                <div className="grid size-8 place-items-center rounded-[8px] border border-border bg-card shadow-[0_1px_1px_hsl(var(--shadow-color)/0.04)]">
                  <Icon className="size-[17px] text-muted-foreground" />
                </div>
                <div>
                  <p className="text-[13px] font-medium text-foreground">{feature.title}</p>
                  <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA Section */}
        <div className="mt-8 flex items-center gap-4">
          <Button
            onClick={goNext}
            className="h-9 px-4"
          >
            Continue <ArrowRightIcon className="size-4" />
          </Button>
          <p className="text-[11px] text-muted-foreground">About three minutes</p>
        </div>
      </div>
    </OnboardingContainer>
  );
}
