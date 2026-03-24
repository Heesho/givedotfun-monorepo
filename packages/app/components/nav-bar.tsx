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

export function NavBar({ attachedTop = false }: { attachedTop?: boolean }) {
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

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
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
        {iconItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex-1 flex items-center justify-center min-h-[48px] transition-colors"
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
          className="flex-1 flex items-center justify-center min-h-[48px] transition-colors"
        >
          <ProfileIcon isActive={isProfileActive} />
        </Link>
      </div>
    </nav>
  );
}
