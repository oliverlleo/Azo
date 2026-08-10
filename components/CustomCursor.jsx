import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import './CustomCursor.css'

const CustomCursor = () => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [cursorVariant, setCursorVariant] = useState('default')

  useEffect(() => {
    const mouseMove = (e) => {
      setMousePosition({
        x: e.clientX,
        y: e.clientY
      })
    }

    const handleMouseEnter = (e) => {
      const target = e.target
      if (target.matches('a, button, .btn, .service-card, .project-card, .contact-item')) {
        setIsHovering(true)
        setCursorVariant('hover')
      }
    }

    const handleMouseLeave = () => {
      setIsHovering(false)
      setCursorVariant('default')
    }

    window.addEventListener('mousemove', mouseMove)
    document.addEventListener('mouseenter', handleMouseEnter, true)
    document.addEventListener('mouseleave', handleMouseLeave, true)

    return () => {
      window.removeEventListener('mousemove', mouseMove)
      document.removeEventListener('mouseenter', handleMouseEnter, true)
      document.removeEventListener('mouseleave', handleMouseLeave, true)
    }
  }, [])

  const variants = {
    default: {
      x: mousePosition.x - 16,
      y: mousePosition.y - 16,
      scale: 1,
      backgroundColor: 'rgba(44, 95, 93, 0.8)',
      mixBlendMode: 'difference'
    },
    hover: {
      x: mousePosition.x - 32,
      y: mousePosition.y - 32,
      scale: 2,
      backgroundColor: 'rgba(212, 116, 74, 0.8)',
      mixBlendMode: 'difference'
    }
  }

  return (
    <motion.div
      className="custom-cursor"
      variants={variants}
      animate={cursorVariant}
      transition={{
        type: "spring",
        stiffness: 500,
        damping: 28
      }}
    />
  )
}

export default CustomCursor

