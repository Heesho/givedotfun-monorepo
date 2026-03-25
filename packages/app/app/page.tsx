"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

const menuItems = [
  { href: "/explore", label: "Explore" },
  { href: "/launch", label: "Launch" },
  { href: "/info", label: "About" },
  { href: "/profile", label: "Profile" },
] as const;

const blurbs = [
  { headline: "Fund something.", sub: "Mine its coin." },
  { headline: "Capital as signal.", sub: "On-chain conviction." },
  { headline: "Back builders.", sub: "Earn what you believe in." },
  { headline: "Crowdfund on Base.", sub: "Every dollar mines a token." },
] as const;

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [blurbIndex, setBlurbIndex] = useState(0);

  // Rotate blurbs every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setBlurbIndex((prev) => (prev + 1) % blurbs.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Body scroll lock when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  // Escape key to close menu
  useEffect(() => {
    if (!menuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen]);

  return (
    <main className="relative h-screen w-full overflow-hidden">
      {/* Video background */}
      <video
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
      >
        <source src="/media/hero-video.mp4" type="video/mp4" />
      </video>

      {/* Dark overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />

      {/* Fixed top bar — logo + hamburger */}
      <div className="fixed top-0 left-0 right-0 z-[210] pointer-events-none">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10 lg:px-16 py-4 sm:py-5 md:py-6 flex items-center justify-between">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="pointer-events-auto"
          >
            <div className="flex items-center gap-2.5">
              <img
                src="/media/logo-transparent.png"
                alt="give.fun"
                className="h-10 w-10 sm:h-12 sm:w-12 object-contain"
              />
              <span
                className="font-semibold tracking-[-0.03em] text-lg sm:text-xl md:text-2xl text-primary"
                style={{ fontFamily: '"Metropolis", sans-serif' }}
              >
                give.fun
              </span>
            </div>
          </motion.div>

          {/* Hamburger / X */}
          <motion.button
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className={`pointer-events-auto w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center hover:opacity-70 transition-opacity touch-manipulation ${
              menuOpen ? "text-foreground" : "text-white"
            }`}
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
                    onClick={() => setMenuOpen(false)}
                    className="block text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-foreground hover:text-primary transition-colors touch-manipulation"
                  >
                    {label}
                  </Link>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hero content */}
      <div className="relative z-10 flex h-full flex-col items-start justify-end pb-16 sm:pb-20 md:pb-24 px-4 sm:px-6 md:px-10 lg:px-16 max-w-[1400px] mx-auto">
        {/* Logo + tagline */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
          className="flex flex-col gap-6 sm:gap-8"
        >
          <div className="flex flex-col gap-3 min-h-[120px] sm:min-h-[140px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={blurbIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col gap-1.5 sm:gap-2"
              >
                <h1 className="text-[2rem] sm:text-[2.5rem] md:text-[3rem] lg:text-[3.5rem] font-bold leading-[0.95] tracking-[-0.02em] text-white">
                  {blurbs[blurbIndex].headline}
                </h1>
                <p className="text-[14px] sm:text-[16px] md:text-[18px] font-medium uppercase tracking-[0.14em] text-white/60">
                  {blurbs[blurbIndex].sub}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* CTA button — liquid glass style */}
          <Link
            href="/explore"
            className="btn-liquid-glass inline-flex items-center justify-center px-8 py-3.5 text-[12px] font-semibold uppercase tracking-[0.16em] text-white w-fit"
          >
            Enter App
          </Link>
        </motion.div>
      </div>
    </main>
  );
}
