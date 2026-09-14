import { ArrowRightIcon, CpuChipIcon, LockClosedIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { Button } from '@/components/ui/button';
import { OnboardingContainer } from '../OnboardingContainer';
import { useOnboarding } from '@/contexts/OnboardingContext';

export function WelcomeStep() {
  const { goNext } = useOnboarding();

  const features = [
    {
      icon: LockClosedIcon,
      title: 'Private by default',
      description: 'No account, upload, or meeting bot. Your words stay on this Mac.',
    },
    {
      icon: SparklesIcon,
      title: 'Clean dictation',
      description: 'Speak naturally and get useful text, not a wall of raw audio.',
    },
    {
      icon: CpuChipIcon,
      title: 'Works without the cloud',
      description: 'Local models keep capture available when the network is not.',
    },
  ];

  return (
    <OnboardingContainer
      title="Private voice, ready in minutes."
      description="Set up a local voice desk once, then dictate from anywhere you work."
      step={1}
      totalSteps={4}
    >
      <div className="hush-onboarding-welcome">
        <div className="hush-onboarding-features">
          <div className="hush-onboarding-feature-list">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div key={index} className="hush-onboarding-feature">
                  <div className="hush-onboarding-feature-icon">
                    <Icon className="size-[17px]" />
                  </div>
                  <div>
                    <p>{feature.title}</p>
                    <span>{feature.description}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-7 flex items-center gap-4">
            <Button onClick={goNext} className="h-9 px-4">
              Continue <ArrowRightIcon className="size-4" />
            </Button>
            <p className="text-[11px] text-muted-foreground">About three minutes</p>
          </div>
        </div>

        <div className="hush-onboarding-preview" aria-label="Hush local dictation preview">
          <img
            src="/hush-workspace-preview.png"
            alt="Hush Activity workspace with the compact Flow Bar visible"
            className="hush-onboarding-preview-image"
          />
          <div className="hush-onboarding-preview-shade" aria-hidden="true" />
          <p className="hush-onboarding-preview-kicker">Ready when you are</p>
          <div className="hush-onboarding-preview-caption">
            <span>Activity</span>
            <span>Local voice desk</span>
          </div>
        </div>
      </div>
    </OnboardingContainer>
  );
}
