import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import './Navigation.css'

const Navigation = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const menuItems = [
    { name: 'Home', href: '#home' },
    { name: 'Quem Somos', href: '#about' },
    { name: 'Criação', href: '#services' },
    { name: 'Construção', href: '#projects' },
    { name: 'Contato', href: '#contact' }
  ]

  const menuVariants = {
    closed: {
      opacity: 0,
      x: '100%',
      transition: {
        duration: 0.3,
        staggerChildren: 0.1,
        staggerDirection: -1
      }
    },
    open: {
      opacity: 1,
      x: 0,
      transition: {
        duration: 0.3,
        staggerChildren: 0.1,
        delayChildren: 0.1
      }
    }
  }

  const itemVariants = {
    closed: {
      opacity: 0,
      x: 50
    },
    open: {
      opacity: 1,
      x: 0
    }
  }

  return (
    <motion.nav
      className={`navigation ${scrolled ? 'scrolled' : ''}`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <div className="nav-container">
        <motion.div
          className="logo"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <img src="/logo_principal_no_bg.png" alt="AZO" />
        </motion.div>

        {/* Desktop Menu */}
        <div className="desktop-menu">
          {menuItems.map((item, index) => (
            <motion.a
              key={item.name}
              href={item.href}
              className="nav-link"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 + 0.3 }}
              whileHover={{ y: -2 }}
            >
              {item.name}
            </motion.a>
          ))}
        </div>

        {/* Mobile Menu Button */}
        <motion.button
          className="menu-toggle"
          onClick={() => setIsOpen(!isOpen)}
          whileTap={{ scale: 0.9 }}
        >
          <motion.span
            className="hamburger-line"
            animate={isOpen ? { rotate: 45, y: 6 } : { rotate: 0, y: 0 }}
          />
          <motion.span
            className="hamburger-line"
            animate={isOpen ? { opacity: 0 } : { opacity: 1 }}
          />
          <motion.span
            className="hamburger-line"
            animate={isOpen ? { rotate: -45, y: -6 } : { rotate: 0, y: 0 }}
          />
        </motion.button>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              className="mobile-menu"
              variants={menuVariants}
              initial="closed"
              animate="open"
              exit="closed"
            >
              {menuItems.map((item) => (
                <motion.a
                  key={item.name}
                  href={item.href}
                  className="mobile-nav-link"
                  variants={itemVariants}
                  onClick={() => setIsOpen(false)}
                  whileHover={{ x: 10 }}
                >
                  {item.name}
                </motion.a>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  )
}

export default Navigation

