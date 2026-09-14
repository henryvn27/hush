import React from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { VisuallyHidden } from "./ui/visually-hidden";
import { About } from "./About";

interface LogoProps {
    isCollapsed: boolean;
}

const Logo = React.forwardRef<HTMLButtonElement, LogoProps>(({ isCollapsed }, ref) => {
  return (
    <Dialog aria-describedby={undefined}>
      {isCollapsed ? (
        <DialogTrigger asChild>
          <button ref={ref} aria-label="About Hush" className="grid size-10 place-items-center rounded-[3px] transition-colors hover:bg-[hsl(var(--sidebar-hover))]">
            <Image className="hush-logo-mark" src="/hush-mark.png" alt="" width={28} height={28} unoptimized />
          </button>
        </DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <button ref={ref} className="flex min-h-11 items-center gap-2.5 rounded-[3px] px-2 text-left transition-colors hover:bg-[hsl(var(--sidebar-hover))]">
            <Image className="hush-logo-mark" src="/hush-mark.png" alt="" width={28} height={28} unoptimized />
            <span className="leading-none">
              <span className="block text-[0.95rem] font-semibold tracking-[-0.045em] text-[hsl(var(--sidebar-foreground))]">Hush</span>
              <span className="mt-1 block text-[0.625rem] font-medium uppercase tracking-[0.1em] text-[hsl(var(--sidebar-muted))]">local voice desk</span>
            </span>
          </button>
        </DialogTrigger>
      )}
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle>About Hush</DialogTitle>
        </VisuallyHidden>
        <About />
      </DialogContent>
    </Dialog>
  );
});

Logo.displayName = "Logo";

export default Logo;
