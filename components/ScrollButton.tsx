"use client";

import { useState, useEffect } from "react";

interface ScrollButtonProps {
  hide?: boolean;
}

export default function ScrollButton({ hide = false }: ScrollButtonProps) {
  const [isAtBottom, setIsAtBottom] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      
      // Check if we're at the bottom (with a small threshold for better UX)
      const threshold = 100;
      const atBottom = scrollTop + windowHeight >= documentHeight - threshold;
      
      setIsAtBottom(atBottom);
    };

    // Initial check
    handleScroll();

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const scrollToBottom = () => {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "smooth",
    });
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleClick = () => {
    if (isAtBottom) {
      scrollToTop();
    } else {
      scrollToBottom();
    }
  };

  if (hide) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      className="group fixed bottom-8 right-8 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 shadow-[0_4px_20px_rgba(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_6px_24px_rgba(0,0,0,0.4)] transition-all duration-500 ease-out hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-gray-400/50 dark:focus:ring-gray-500/50 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-gray-900"
      aria-label={isAtBottom ? "Scroll to top" : "Scroll to bottom"}
    >
      <div className="relative w-6 h-6">
        <svg
          className={`absolute inset-0 w-full h-full text-gray-600 dark:text-gray-300 transition-all duration-500 ease-out ${isAtBottom ? "opacity-0 rotate-180 scale-0" : "opacity-100 rotate-0 scale-100"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 13.5L12 21m0 0l-7.5-7.5M12 21V3"
          />
        </svg>
        <svg
          className={`absolute inset-0 w-full h-full text-gray-600 dark:text-gray-300 transition-all duration-500 ease-out ${isAtBottom ? "opacity-100 rotate-0 scale-100" : "opacity-0 rotate-180 scale-0"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"
          />
        </svg>
      </div>
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-gray-50/0 to-gray-100/0 dark:from-gray-800/0 dark:to-gray-900/0 group-hover:from-gray-50/50 group-hover:to-gray-100/30 dark:group-hover:from-gray-800/30 dark:group-hover:to-gray-900/50 transition-all duration-500 pointer-events-none" />
    </button>
  );
}

