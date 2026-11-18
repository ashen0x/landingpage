import type { ReactNode } from "react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Band } from "@/components/layout/Band";
import { cn } from "@/lib/utils";

interface SiteShellProps {
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  useMain?: boolean;
  /** The strip of light across the top; off on a page that draws its own light. */
  band?: boolean;
}

export function SiteShell({
  children,
  className,
  contentClassName,
  useMain = true,
  band = true,
}: SiteShellProps) {
  return (
    <div
      className={cn(
        "relative isolate flex min-h-screen flex-col bg-background text-muted-foreground selection:bg-foreground/20 selection:text-foreground",
        className
      )}
    >
      {band && <Band />}
      <Header />
      {useMain ? (
        <main className={cn("relative z-[1] flex-grow pt-[72px] sm:pt-[80px]", contentClassName)}>{children}</main>
      ) : (
        children
      )}
      <div className="mx-auto w-full max-w-[1800px]">
        <Footer />
      </div>
    </div>
  );
}

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[1800px] px-[clamp(1rem,5vw,5rem)]", className)}>
      {children}
    </div>
  );
}
