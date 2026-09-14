import React from 'react';
import { CheckIcon } from '@heroicons/react/20/solid';

interface ProgressIndicatorProps {
  current: number;
  total: number;
  onStepClick?: (step: number) => void;
}

export function ProgressIndicator({ current, total, onStepClick }: ProgressIndicatorProps) {
  const visibleSteps = Array.from({ length: total }, (_, i) => i + 1);
  const stepNames = ['Welcome', 'Privacy', 'Models', 'Access'];

  return (
    <nav aria-label="Setup progress">
      <div className="flex items-center gap-2">
        {visibleSteps.map((step, index) => {
          const isActive = step === current;
          const isCompleted = step < current;
          const isClickable = isCompleted && onStepClick;

          return (
            <React.Fragment key={step}>
              <button
                onClick={() => isClickable && onStepClick(step)}
                disabled={!isClickable}
                aria-label={`Setup step ${step}${isActive ? ', current' : isCompleted ? ', completed' : ''}`}
                aria-current={isActive ? 'step' : undefined}
                className={`flex h-7 items-center gap-1.5 rounded-full border px-2 text-[10px] font-semibold transition-colors ${
                  isCompleted ? 'border-success/35 bg-success/10 text-success' : isActive ? 'border-foreground bg-foreground text-background' : 'border-border bg-transparent text-muted-foreground'
                } ${isClickable ? 'cursor-pointer hover:bg-secondary' : 'cursor-default'}`}
              >
                {isCompleted ? (
                  <CheckIcon className="size-3.5" />
                ) : (
                  <span>{step}</span>
                )}
                <span className="font-mono text-[0.5625rem] font-medium uppercase tracking-[0.08em]">{stepNames[index]}</span>
              </button>

              {/* Connector Line */}
              {index < visibleSteps.length - 1 && (
                <div
                  className={`h-px w-8 transition-colors ${
                    isCompleted ? 'bg-success/50' : 'bg-border'
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </nav>
  );
}
