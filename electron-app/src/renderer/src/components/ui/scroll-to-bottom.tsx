import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip"
import { cn } from "@/lib/utils"

interface ScrollToBottomProps {
  footerRef: React.RefObject<HTMLDivElement>
  containerRef?: React.RefObject<HTMLDivElement>
  className?: string
}

export function ScrollToBottom({ footerRef, containerRef, className }: ScrollToBottomProps) {
  const [isVisible, setIsVisible] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Clean up previous observer
    if (observerRef.current) {
      observerRef.current.disconnect()
    }

    // Create new observer for footer visibility
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries
        setIsVisible(!entry.isIntersecting)
      },
      {
        root: containerRef?.current || null,
        threshold: 0.1, // Show button until footer is 10% visible
      }
    )

    // Start observing footer
    if (footerRef.current) {
      observerRef.current.observe(footerRef.current)
    }

    // Check if content is scrollable
    const checkScrollable = () => {
      const container = containerRef?.current || document.documentElement
      const isContentScrollable = container.scrollHeight > container.clientHeight

      if (!isContentScrollable) {
        setIsVisible(false)
      }
    }

    // Initial check
    checkScrollable()

    // Add resize listener
    const handleResize = () => {
      checkScrollable()
    }

    window.addEventListener('resize', handleResize)

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
      window.removeEventListener('resize', handleResize)
    }
  }, [footerRef, containerRef])

  const handleClick = () => {
    if (footerRef.current) {
      footerRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <AnimatePresence>
      {isVisible && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <motion.button
                ref={buttonRef}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                onClick={handleClick}
                className={cn(
                  "fixed bottom-4 right-4 bg-linen text-night rounded-full p-3 shadow-lg cursor-pointer z-50",
                  "hover:bg-linen/90 transition-all duration-200 group",
                  className
                )}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <ChevronDown className="w-6 h-6" />
                <span className="sr-only">Scroll to bottom</span>
              </motion.button>
            </TooltipTrigger>
            <TooltipContent className="bg-linen text-night">
              <p>Scroll to bottom</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </AnimatePresence>
  )
} 