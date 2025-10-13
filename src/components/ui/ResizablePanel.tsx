'use client'

import { useState, useRef, useCallback, useEffect, ReactNode } from 'react'

interface ResizablePanelProps {
  children: ReactNode
  defaultWidth?: number
  minWidth?: number
  maxWidth?: number
  storageKey?: string
  className?: string
  position?: 'left' | 'right'
}

const HANDLE_WIDTH = 6

export default function ResizablePanel({
  children,
  defaultWidth = 350,
  minWidth = 250,
  maxWidth = 600,
  storageKey = 'resizablePanel-width',
  className = '',
  position = 'right'
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth)
  const [isResizing, setIsResizing] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef<number>(0)
  const startWidthRef = useRef<number>(defaultWidth)

  // Load saved width from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && storageKey) {
      const savedWidth = localStorage.getItem(storageKey)
      if (savedWidth) {
        const parsedWidth = parseInt(savedWidth, 10)
        if (parsedWidth >= minWidth && parsedWidth <= maxWidth) {
          setWidth(parsedWidth)
        }
      }
    }
  }, [minWidth, maxWidth, storageKey])

  // Save width to localStorage when it changes
  useEffect(() => {
    if (typeof window !== 'undefined' && storageKey) {
      localStorage.setItem(storageKey, width.toString())
    }
  }, [width, storageKey])

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)
    startXRef.current = e.clientX
    startWidthRef.current = width
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
  }, [width])

  const handleResize = useCallback((e: MouseEvent) => {
    if (!isResizing) return

    const deltaX = position === 'right' 
      ? startXRef.current - e.clientX
      : e.clientX - startXRef.current
    
    const newWidth = startWidthRef.current + deltaX
    const constrainedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth))
    setWidth(constrainedWidth)
  }, [isResizing, minWidth, maxWidth, position])

  const stopResize = useCallback(() => {
    setIsResizing(false)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  // Handle mouse events
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResize)
      document.addEventListener('mouseup', stopResize)
      
      return () => {
        document.removeEventListener('mousemove', handleResize)
        document.removeEventListener('mouseup', stopResize)
      }
    }
  }, [isResizing, handleResize, stopResize])

  // Keyboard support for fine adjustments
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!panelRef.current?.contains(e.target as Node)) return
    
    if (e.key === 'ArrowLeft' && e.altKey) {
      e.preventDefault()
      const newWidth = position === 'right' ? width + 10 : width - 10
      setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)))
    } else if (e.key === 'ArrowRight' && e.altKey) {
      e.preventDefault() 
      const newWidth = position === 'right' ? width - 10 : width + 10
      setWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)))
    }
  }, [width, minWidth, maxWidth, position])

  // Add keyboard event listener
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown as any)
    return () => document.removeEventListener('keydown', handleKeyDown as any)
  }, [handleKeyDown])

  return (
    <div 
      className={`relative flex ${position === 'left' ? 'flex-row' : 'flex-row-reverse'} ${className} min-h-0`}
      ref={panelRef}
    >
      {/* Resize Handle - Enhanced visibility */}
      <div
        className={`
          relative flex items-center justify-center transition-all duration-200 group
          cursor-ew-resize border-l border-r border-slate-300
          ${isResizing 
            ? 'bg-blue-100 border-blue-300 shadow-sm' 
            : 'bg-slate-100 hover:bg-slate-200 hover:border-slate-400 hover:shadow-sm'
          }
          ${position === 'left' ? 'order-2' : 'order-1'}
        `}
        style={{ width: `${HANDLE_WIDTH * 2}px` }}
        onMouseDown={startResize}
        title="Drag to resize panel (Alt + Arrow keys for fine adjustment)"
      >
        {/* Enhanced visual drag indicators */}
        <div className="flex flex-col space-y-0.5 pointer-events-none">
          <div className={`w-1 h-4 rounded-full transition-all duration-200 ${
            isResizing 
              ? 'bg-blue-600 shadow-sm' 
              : 'bg-slate-400 group-hover:bg-slate-600'
          }`} />
          <div className={`w-1 h-2 rounded-full transition-all duration-200 ${
            isResizing 
              ? 'bg-blue-500 shadow-sm' 
              : 'bg-slate-300 group-hover:bg-slate-500'
          }`} />
          <div className={`w-1 h-4 rounded-full transition-all duration-200 ${
            isResizing 
              ? 'bg-blue-600 shadow-sm' 
              : 'bg-slate-400 group-hover:bg-slate-600'
          }`} />
        </div>
        
        {/* Wider hit area for easier grabbing */}
        <div className="absolute inset-y-0 -inset-x-3" />
        
        {/* Subtle resize hint */}
        <div className={`
          absolute -top-6 left-1/2 transform -translate-x-1/2 px-2 py-1 
          bg-slate-800 text-white text-xs rounded opacity-0 transition-opacity
          pointer-events-none whitespace-nowrap
          ${isResizing ? 'opacity-100' : 'group-hover:opacity-100'}
        `}>
          Drag to resize
        </div>
      </div>

      {/* Panel Content */}
      <div
        className={`
          overflow-hidden transition-all duration-200 ease-out
          ${position === 'left' ? 'order-1' : 'order-2'}
        `}
        style={{ 
          width: `${width}px`,
          minWidth: `${minWidth}px`,
          maxWidth: `${maxWidth}px`
        }}
      >
        <div className="h-full overflow-auto">
          {children}
        </div>
      </div>
    </div>
  )
}