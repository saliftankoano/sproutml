"use client";

import { motion } from "framer-motion";

export function LoadingDots() {
  const dotVariants = {
    initial: { y: 0 },
    animate: { y: -10 },
  };

  return (
    <div className="flex gap-1.5">
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className="w-2 h-2 bg-primary rounded-full"
          variants={dotVariants}
          initial="initial"
          animate="animate"
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: "reverse",
            delay: index * 0.1,
          }}
        />
      ))}
    </div>
  );
}
