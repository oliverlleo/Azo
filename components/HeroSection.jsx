import React, { useRef, useEffect } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import { ChevronDown, Eye, MessageCircle } from 'lucide-react'
import './HeroSection.css'

const HeroSection = () => {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"]
  })

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"])
  const opacity = useTransform(scrollYProgress, [0, 1], [1, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [1, 0.8])

  const springConfig = { stiffness: 100, damping: 30, restDelta: 0.001 }
  const ySpring = useSpring(y, springConfig)

  return (
    <section ref={ref} className="hero-section" id="home">
      <motion.div 
        className="hero-background"
      >
        <motion.img
          src="/animated_logo.png"
          alt="Animated Logo"
          className="animated-logo"
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0, y: [0, -20, 0] }}
          transition={{ duration: 1, delay: 0.8, y: { duration: 6, repeat: Infinity, ease: "easeInOut" } }}
        />
      </motion.div>

      <div className="hero-content">
        <motion.div
          className="hero-text"
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          <motion.h1
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.7 }}
          >
            AZO
          </motion.h1>
          <motion.h2
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.9 }}
          >
            CRIAÇÃO & CONSTRUÇÃO
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.1 }}
          >
            Ressignificando o conceito da construção residencial através de projetos únicos e personalizados
          </motion.p>
          
          <motion.div
            className="hero-buttons"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 1.3 }}
          >
            <motion.a
              href="#projects"
              className="btn btn-primary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Eye size={20} strokeWidth={1.5} />
              Ver Projetos
            </motion.a>
            <motion.a
              href="#contact"
              className="btn btn-secondary"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <MessageCircle size={20} strokeWidth={1.5} />
              Fale Conosco
            </motion.a>
          </motion.div>
        </motion.div>


      </div>

      <motion.div
        className="scroll-indicator"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        <motion.div
          className="scroll-arrow"
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown size={24} strokeWidth={1.5} />
        </motion.div>
        <span>Role para descobrir</span>
      </motion.div>
    </section>
  )
}

export default HeroSection
