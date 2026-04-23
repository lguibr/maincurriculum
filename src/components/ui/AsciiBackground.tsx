import { motion } from "motion/react";
import { useEffect, useState } from "react";

export function AsciiBackground() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1] bg-black">
      {/* Animated Glowing Blobs */}
      <motion.div
        className="absolute w-[60vw] h-[60vw] rounded-full bg-violet-600/20 blur-[100px]"
        animate={{
          x: ["0%", "50%", "0%", "-30%", "0%"],
          y: ["0%", "20%", "-20%", "10%", "0%"],
          scale: [1, 1.1, 0.9, 1.2, 1],
        }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        style={{ top: "10%", left: "-10%" }}
      />
      <motion.div
        className="absolute w-[50vw] h-[50vw] rounded-full bg-blue-600/20 blur-[100px]"
        animate={{
          x: ["0%", "-40%", "20%", "40%", "0%"],
          y: ["0%", "40%", "0%", "-30%", "0%"],
          scale: [1, 1.2, 1, 0.9, 1],
        }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        style={{ bottom: "-10%", right: "-10%" }}
      />
      <motion.div
        className="absolute w-[40vw] h-[40vw] rounded-full bg-emerald-600/10 blur-[100px]"
        animate={{
          x: ["0%", "30%", "-20%", "10%", "0%"],
          y: ["0%", "-30%", "40%", "20%", "0%"],
          scale: [1, 0.8, 1.1, 1, 1],
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        style={{ top: "40%", left: "30%" }}
      />

      {/* Grid Overlay / ASCII Map Pattern */}
      <div 
        className="absolute inset-0 opacity-[0.15]" 
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M9 9H1V11H9V19H11V11H19V9H11V1H9V9Z' fill='%23ffffff' fill-opacity='1' fill-rule='evenodd'/%3E%3C/svg%3E")`,
          backgroundSize: '30px 30px',
          maskImage: 'linear-gradient(to bottom, black 40%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, rgba(0,0,0,1) 10%, rgba(0,0,0,0) 100%)'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent via-background/20" />
    </div>
  );
}
