import React from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { VisuallyHidden } from "./ui/visually-hidden";
import { About } from "./About";

interface InfoProps {
    isCollapsed: boolean;
}

const Info = React.forwardRef<HTMLButtonElement, InfoProps>(({ isCollapsed }, ref) => {
  return (
    <Dialog aria-describedby={undefined}>
      <DialogTrigger asChild>
        <button 
          ref={ref} 
          aria-label="About"
          className={`flex min-h-9 items-center justify-center cursor-pointer border-none text-muted-foreground transition-colors hover:text-foreground ${
            isCollapsed 
              ? "size-10 bg-transparent rounded-lg hover:bg-[hsl(var(--sidebar-strong))]"
              : "rounded-md px-2 text-xs font-medium hover:bg-[hsl(var(--sidebar-strong))]"
          }`}
          title="About Hush"
        >
          <InformationCircleIcon className={isCollapsed ? "size-[1.1rem]" : "size-3.5"} />
          {!isCollapsed && (
            <span className="ml-1.5">About</span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent>
        <VisuallyHidden>
          <DialogTitle>About Hush</DialogTitle>
        </VisuallyHidden>
        <About />
      </DialogContent>
    </Dialog>
  );
});

Info.displayName = "About";

export default Info;
