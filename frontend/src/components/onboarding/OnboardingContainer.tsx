import React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { ProgressIndicator } from './shared/ProgressIndicator';
import { useOnboarding } from '@/contexts/OnboardingContext';
import type { OnboardingContainerProps } from '@/types/onboarding';

export function OnboardingContainer({
  title,
  description,
  children,
  step,
  totalSteps = 5,
  stepOffset = 0,
  hideProgress = false,
  className,
}: OnboardingContainerProps) {
  const { goToStep } = useOnboarding();

  const handleStepClick = (s: number) => {
    goToStep(s + stepOffset);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background">
      <div className={cn('flex h-full w-full flex-col', className)}>
        <header className="hush-onboarding-topbar">
          <div className="flex items-center gap-2.5">
            <Image src="/logo-collapsed.png" alt="" width={24} height={24} priority />
            <span className="text-[13px] font-medium tracking-[-0.015em]">Hush</span>
          </div>
          {step && !hideProgress && (
            <div className="hush-onboarding-progress">
              <ProgressIndicator current={step} total={totalSteps} onStepClick={handleStepClick} />
            </div>
          )}
          <span className="hush-onboarding-privacy">PRIVATE BY DEFAULT</span>
        </header>

        <main className="hush-onboarding-main">
          <div className="hush-onboarding-column">
        <div className="mb-7 max-w-[680px] flex-shrink-0 text-left">
          <p className="mb-3 text-[11px] font-medium tracking-[0.01em] text-muted-foreground">Local setup</p>
          <h1 className="text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.045em] text-foreground">{title}</h1>
          {description && (
            <p className="mt-3 max-w-xl text-[14px] leading-6 text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-3">
          <div className="max-w-[760px] pb-3">{children}</div>
        </div>
          </div>
        </main>
      </div>
    </div>
  );
}
