"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const menuItems = [
  { href: "/explore", label: "Explore" },
  { href: "/launch", label: "Launch" },
  { href: "/info", label: "About" },
  { href: "/profile", label: "Profile" },
] as const;

export function GlobalNav() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Escape key
  useEffect(() => {
    if (!menuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  // Text color: white on landing (over video), normal on other pages
  const textColor = isLanding && !menuOpen ? "text-white" : "text-foreground";
  const logoColor = "text-primary";

  return (
    <>
      {/* Fixed top bar — always visible */}
      <div className={`fixed top-0 left-0 right-0 z-[210] pointer-events-none ${isLanding ? "" : "bg-background"}`}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10 lg:px-16 py-3 sm:py-4 flex items-center justify-between">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="pointer-events-auto"
          >
            <Link href="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
              <img
                src="/media/logo-transparent.png"
                alt="give.fun"
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
              />
              <span
                className={`font-semibold tracking-[-0.03em] text-lg sm:text-xl md:text-2xl transition-colors duration-300 ${logoColor}`}
                style={{ fontFamily: '"Metropolis", sans-serif' }}
              >
                give.fun
              </span>
            </Link>
          </motion.div>

          {/* Hamburger / X */}
          <motion.button
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`pointer-events-auto w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center hover:opacity-70 transition-all touch-manipulation ${textColor}`}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            <span className="relative w-6 sm:w-7 h-5 flex flex-col justify-center items-center">
              <span
                className="absolute block w-6 sm:w-7 h-[2px] bg-current transition-all duration-300 origin-center"
                style={{ transform: menuOpen ? "rotate(45deg)" : "translateY(-6px)" }}
              />
              <span
                className="absolute block w-6 sm:w-7 h-[2px] bg-current transition-all duration-300"
                style={{ opacity: menuOpen ? 0 : 1 }}
              />
              <span
                className="absolute block w-6 sm:w-7 h-[2px] bg-current transition-all duration-300 origin-center"
                style={{ transform: menuOpen ? "rotate(-45deg)" : "translateY(6px)" }}
              />
            </span>
          </motion.button>
        </div>
      </div>

      {/* Full-screen menu overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ y: "-100%" }}
            animate={{ y: 0 }}
            exit={{ y: "-100%" }}
            transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center"
          >
            <div className="flex flex-col items-center gap-4 sm:gap-6 md:gap-8">
              {menuItems.map(({ label, href }, i) => (
                <motion.div
                  key={href}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: 0.1 + i * 0.06 }}
                >
                  <Link
                    href={href}
                    className={`block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold transition-colors touch-manipulation ${
                      pathname === href ? "text-primary" : "text-foreground hover:text-primary"
                    }`}
                  >
                    {label}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
