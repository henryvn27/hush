import React from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/20/solid';
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
  showNavigation = false,
  onNext,
  onPrevious,
  canGoNext = true,
  canGoPrevious = true,
}: OnboardingContainerProps) {
  const { goToStep, goPrevious, goNext } = useOnboarding();

  const handlePrevious = () => {
    if (onPrevious) {
      onPrevious();
    } else {
      goPrevious();
    }
  };

  const handleNext = () => {
    if (onNext) {
      onNext();
    } else {
      goNext();
    }
  };

  const handleStepClick = (s: number) => {
    goToStep(s + stepOffset);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-background">
      <div className={cn('grid h-full w-full grid-cols-[264px_minmax(0,1fr)] max-[1160px]:grid-cols-[232px_minmax(0,1fr)]', className)}>
        <aside className="flex min-h-0 flex-col border-r border-border bg-secondary/35 px-7 pb-7 pt-10 max-[1160px]:px-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-7 place-items-center rounded-[7px] bg-foreground text-[11px] font-semibold tracking-[-0.02em] text-background">MI</span>
            <span className="text-[13px] font-medium tracking-[-0.015em]">Meetily Improved</span>
          </div>
          <div className="mt-auto">
            <p className="text-[12px] font-medium text-foreground">Private by default</p>
            <p className="mt-1 text-[11px] leading-[1.55] text-muted-foreground">Models, recordings, and transcripts stay on this Mac unless you choose otherwise.</p>
          </div>
        </aside>

        <main className="flex min-h-0 flex-col px-12 pb-9 pt-10 max-[1160px]:px-9">
        {/* Progress Indicator with Navigation - Fixed */}
        {step && !hideProgress && (
          <div className="relative mb-9 flex-shrink-0">
            {/* Navigation Buttons */}
            {showNavigation && (
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none">
                <button
                  onClick={handlePrevious}
                  disabled={!canGoPrevious || step === 1}
                  aria-label="Previous setup step"
                  className={cn(
                    'pointer-events-auto flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200',
                    canGoPrevious && step !== 1
                      ? 'hover:bg-secondary hover:text-foreground'
                      : 'opacity-0 cursor-not-allowed'
                  )}
                >
                  <ChevronLeftIcon className="size-4" />
                </button>

                <button
                  onClick={handleNext}
                  disabled={!canGoNext || step === totalSteps}
                  aria-label="Next setup step"
                  className={cn(
                    'pointer-events-auto flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200',
                    canGoNext && step !== totalSteps
                      ? 'hover:bg-secondary hover:text-foreground'
                      : 'opacity-0 cursor-not-allowed'
                  )}
                >
                  <ChevronRightIcon className="size-4" />
                </button>
              </div>
            )}

            {/* Progress Indicator */}
            <ProgressIndicator current={step} total={totalSteps} onStepClick={handleStepClick} />
          </div>
        )}

        {/* Header - Fixed */}
        <div className="mb-7 max-w-[680px] flex-shrink-0 text-left">
          <p className="mb-3 text-[11px] font-medium tracking-[0.01em] text-muted-foreground">Local setup</p>
          <h1 className="text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.045em] text-foreground">{title}</h1>
          {description && (
            <p className="mt-3 max-w-xl text-[14px] leading-6 text-muted-foreground">
              {description}
            </p>
          )}
        </div>

        {/* Content - Scrollable */}
        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pr-3">
          <div className="max-w-[760px] pb-3">{children}</div>
        </div>
        </main>
      </div>
    </div>
  );
}
