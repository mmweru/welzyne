import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const InitialLoadingState = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate initial load time (you can adjust or remove this)
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000); // 2 seconds loading state

    return () => clearTimeout(timer);
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white dark:bg-black">
      <motion.div 
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ 
          opacity: 1, 
          scale: 1,
          transition: { 
            duration: 0.5,
            type: "spring",
            damping: 10,
            stiffness: 100
          }
        }}
        className="flex flex-col items-center justify-center"
      >
        {/* Your Logo or Brand */}
        <img 
          src="/path/to/your/logo.svg" 
          alt="Welzyne Logo" 
          className="w-40 h-40 mb-6"
        />
        
        {/* Loading Animation */}
        <div className="flex space-x-2">
          {[...Array(3)].map((_, index) => (
            <motion.div
              key={index}
              className="w-4 h-4 bg-blue-500 rounded-full"
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: index * 0.2
              }}
            />
          ))}
        </div>
        
        {/* Optional Loading Text */}
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
          Loading Welzyne Courier Services...
        </p>
      </motion.div>
    </div>
  );
};

export default InitialLoadingState;