"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const blurbs = [
  "Fund the things you believe in and mine tokens as proof of conviction.",
  "A crypto GoFundMe where every dollar mines a coin on Base.",
  "Back builders, fund causes, and let capital become signal.",
  "Put your money where your values are. Mine the proof.",
] as const;

export default function LandingPage() {
  const router = useRouter();
  const [blurbIndex, setBlurbIndex] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  // Rotate blurbs every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setBlurbIndex((prev) => (prev + 1) % blurbs.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Cross-dissolve: fade to black, then navigate
  const handleEnter = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    // Wait for fade-out to complete, then navigate
    setTimeout(() => {
      router.push("/explore");
    }, 600);
  }, [isExiting, router]);

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

      {/* Fade-to-black overlay for exit transition */}
      <motion.div
        className="absolute inset-0 z-50 bg-black pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: isExiting ? 1 : 0 }}
        transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      />

      {/* Hero content */}
      <motion.div
        className="relative z-10 flex h-full flex-col items-start justify-end pb-16 sm:pb-20 md:pb-24 px-4 sm:px-6 md:px-10 lg:px-16 max-w-[1400px] mx-auto"
        animate={{ opacity: isExiting ? 0 : 1, y: isExiting ? -20 : 0 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Logo + tagline */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
          className="flex flex-col gap-3 sm:gap-4"
        >
          <div className="min-h-[140px] sm:min-h-[180px] md:min-h-[200px] max-w-[500px]">
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

          {/* CTA button — liquid glass style */}
          <button
            onClick={handleEnter}
            disabled={isExiting}
            className="btn-liquid-glass inline-flex items-center justify-center px-8 py-3.5 text-[12px] font-semibold tracking-[0.02em] text-white w-fit disabled:pointer-events-none"
          >
            Enter App
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}
