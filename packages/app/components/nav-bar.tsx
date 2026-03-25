"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutGrid, Plus, Info } from "lucide-react";
import { useFarcaster } from "@/hooks/useFarcaster";

function ProfileIcon({ isActive }: { isActive: boolean }) {
  const { user, address } = useFarcaster();
  const pfpUrl = user?.pfpUrl;
  const fallback = address ? address.slice(-2).toUpperCase() : "??";

  return (
    <div
      className={cn(
        "ghost-border flex h-8 w-8 items-center justify-center overflow-hidden transition-all",
        pfpUrl
          ? isActive ? "bg-surface-high shadow-slab" : "bg-surface-low opacity-70 hover:opacity-100"
          : isActive
            ? "bg-primary text-primary-foreground shadow-slab"
            : "bg-surface-low text-muted-foreground hover:bg-surface-high hover:text-foreground"
      )}
    >
      {pfpUrl ? (
        <img src={pfpUrl} alt="Profile" className="w-full h-full object-cover" />
      ) : (
        <span className="text-[10px] font-mono font-semibold tracking-[0.08em]">{fallback}</span>
      )}
    </div>
  );
}

export function NavBar({
  attachedTop = false,
  desktopWide = false,
}: {
  attachedTop?: boolean;
  desktopWide?: boolean;
}) {
  const pathname = usePathname();

  const isFundraiserPage = pathname.startsWith("/fundraiser/");

  const iconItems: Array<{
    href: "/explore" | "/launch" | "/info";
    icon: typeof LayoutGrid;
    isActive: boolean;
  }> = [
    { href: "/explore", icon: LayoutGrid, isActive: pathname === "/explore" || pathname === "/" || isFundraiserPage },
    { href: "/launch", icon: Plus, isActive: pathname === "/launch" },
    { href: "/info", icon: Info, isActive: pathname === "/info" },
  ];

  const isProfileActive = pathname === "/profile";
  const desktopLinks = [
    { href: "/explore", label: "Explore", isActive: pathname === "/explore" || pathname === "/" || isFundraiserPage },
    { href: "/launch", label: "Launch", isActive: pathname === "/launch" },
    { href: "/info", label: "About", isActive: pathname === "/info" },
  ] as const;

  return (
    <>
      {desktopWide && (
        <header className="fixed inset-x-0 top-0 z-50 hidden lg:block"
          style={{
            background: "hsl(var(--background))",
            boxShadow: "inset 0 -1px 0 hsl(var(--outline-variant) / 0.1)",
          }}
        >
          <div className="mx-auto flex w-full max-w-[1480px] items-center gap-10 px-8 py-3.5 xl:px-10">
            <Link href="/explore" className="flex shrink-0 items-center gap-3 transition-opacity hover:opacity-80">
              <img
                src="/media/icon.png"
                alt="give.fun"
                className="ghost-border h-9 w-9 bg-surface-lowest object-cover"
              />
              <div className="font-display text-[17px] font-semibold tracking-[-0.03em] text-foreground">
                give.fun
              </div>
            </Link>

            <nav className="flex flex-1 items-center gap-1">
              {desktopLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3.5 py-2 font-display text-[12px] font-semibold uppercase tracking-[0.14em] transition-all",
                    item.isActive
                      ? "text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  style={item.isActive ? {
                    background: "hsl(var(--primary) / 0.1)",
                    boxShadow: "inset 0 0 0 1px hsl(var(--primary) / 0.15)",
                  } : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>

            <Link href="/profile" className="ml-auto flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80">
              <span
                className={cn(
                  "font-display text-[12px] font-semibold uppercase tracking-[0.14em] transition-colors",
                  isProfileActive ? "text-foreground" : "text-muted-foreground"
                )}
              >
                Profile
              </span>
              <ProfileIcon isActive={isProfileActive} />
            </Link>
          </div>
        </header>
      )}

      <nav
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 flex justify-center",
          desktopWide && "lg:hidden"
        )}
      >
        <div
          className={cn(
            "dock-panel flex w-full max-w-[520px] items-center justify-around px-6",
            attachedTop && "dock-panel-attached"
          )}
          style={{
            paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)",
            paddingTop: "14px",
          }}
        >
          <div className="flex flex-1 items-center justify-around">
            {iconItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex min-h-[48px] flex-1 items-center justify-center transition-colors"
              >
                <item.icon
                  className={cn(
                    "h-6 w-6 transition-colors",
                    item.isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  strokeWidth={1.5}
                />
              </Link>
            ))}
            <Link
              href="/profile"
              className="flex min-h-[48px] flex-1 items-center justify-center transition-colors"
            >
              <ProfileIcon isActive={isProfileActive} />
            </Link>
          </div>
        </div>
      </nav>

      {desktopWide && (
        <footer className="hidden lg:block"
          style={{
            background: "linear-gradient(180deg, hsl(var(--surface-container-lowest) / 0.5) 0%, hsl(var(--background) / 0.8) 100%)",
            boxShadow: "inset 0 1px 0 hsl(var(--outline-variant) / 0.12)",
          }}
        >
          <div className="mx-auto w-full max-w-[1480px] px-8 py-10 xl:px-10">
            <div className="flex items-start justify-between gap-8">
              <div className="max-w-[320px]">
                <div className="flex items-center gap-3">
                  <img
                    src="/media/icon.png"
                    alt="give.fun"
                    className="ghost-border h-8 w-8 bg-surface-lowest object-cover"
                  />
                  <div className="font-display text-[16px] font-semibold tracking-[-0.03em] text-foreground">
                    give.fun
                  </div>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                  Fund causes you care about and mine coins as a reward. Built on Base.
                </p>
              </div>

              <div className="flex gap-14">
                <div>
                  <div className="mb-3 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
                    Navigate
                  </div>
                  <div className="flex flex-col gap-2.5">
                    {desktopLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="text-[13px] text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <Link href="/profile" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                      Profile
                    </Link>
                  </div>
                </div>
                <div>
                  <div className="mb-3 font-display text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/60">
                    Protocol
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <a href="https://basescan.org" target="_blank" rel="noopener noreferrer" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                      Contracts
                    </a>
                    <a href="https://warpcast.com" target="_blank" rel="noopener noreferrer" className="text-[13px] text-muted-foreground transition-colors hover:text-foreground">
                      Warpcast
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between border-t border-[hsl(var(--outline-variant)/0.1)] pt-5">
              <div className="text-[12px] text-muted-foreground/50">
                give.fun protocol
              </div>
              <div className="text-[12px] text-muted-foreground/50">
                Built on Base
              </div>
            </div>
          </div>
        </footer>
      )}
    </>
  );
}
