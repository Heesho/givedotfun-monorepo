"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const blurbs = [
  "Fund the things you believe in and mine tokens as proof of conviction.",
  "A crypto GoFundMe where every dollar mines a coin on Base.",
  "Back builders, fund causes, and let capital become signal.",
  "Put your money where your values are. Mine the proof.",
] as const;

const landingPartners = [
  {
    label: "GlazeCorp",
    href: "https://give.fun",
    logoSrc: "/media/landing-givefun-logo.png",
    logoAlt: "GlazeCorp",
  },
  {
    label: "stickr.net",
    href: "https://stickr.net/",
    logoSrc: "/media/landing-stickrnet-logo.png",
    logoAlt: "stickr.net",
  },
] as const;

export default function LandingPage() {
  const [blurbIndex, setBlurbIndex] = useState(0);

  // Rotate blurbs every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setBlurbIndex((prev) => (prev + 1) % blurbs.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Open the nav menu overlay — smooth transition to white menu
  const handleEnter = () => {
    window.dispatchEvent(new CustomEvent("open-nav-menu"));
  };

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

      {/* Hero content */}
      <div className="relative z-10 flex h-full flex-col items-start justify-end pb-16 sm:pb-20 md:pb-24 px-4 sm:px-6 md:px-10 lg:px-16 max-w-[1400px] mx-auto">
        {/* Logo + tagline */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
          className="flex flex-col gap-3 sm:gap-4"
        >
          <div className="flex min-h-[140px] max-w-[500px] flex-col justify-end sm:min-h-[180px] md:min-h-[200px]">
            <AnimatePresence mode="wait">
              <motion.p
                key={blurbIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="text-[1.75rem] sm:text-[2.25rem] md:text-[2.75rem] lg:text-[3.25rem] font-bold leading-[1.1] tracking-[-0.02em] text-white"
              >
                {blurbs[blurbIndex]}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* CTA row */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={handleEnter}
              className="btn-liquid-glass inline-flex items-center justify-center w-[100px] sm:w-[140px] h-[40px] sm:h-[48px] text-[11px] sm:text-[12px] font-semibold tracking-[0.02em] text-white"
            >
              Enter App
            </button>

            {landingPartners.map((partner) => (
              <a
                key={partner.label}
                href={partner.href}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-liquid-glass inline-flex items-center justify-center gap-1.5 sm:gap-2 w-[110px] sm:w-[140px] h-[40px] sm:h-[48px] text-[11px] sm:text-[12px] font-semibold tracking-[0.02em] text-white"
              >
                <img
                  src={partner.logoSrc}
                  alt={partner.logoAlt}
                  className="h-6 w-6 sm:h-8 sm:w-8 object-contain"
                />
                <span>{partner.label}</span>
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
