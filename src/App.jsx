import React, { useState } from 'react'
import { motion } from 'framer-motion'
import HeroSection from './components/HeroSection'
import AboutSection from './components/AboutSection'
import ServicesSection from './components/ServicesSection'
import ProjectsGallery from './components/ProjectsGallery'
import ContactSection from './components/ContactSection'
import Navigation from './components/Navigation'
import CustomCursor from './components/CustomCursor'
import ScrollProgress from './components/ScrollProgress'
import ParticleBackground from './components/ParticleBackground'
import LoadingScreen from './components/LoadingScreen'
import './App.css'

function App() {
  const [isLoading, setIsLoading] = useState(true)

  const handleLoadingComplete = () => {
    setIsLoading(false)
  }

  if (isLoading) {
    return <LoadingScreen onComplete={handleLoadingComplete} />
  }

  return (
    <div className="App">
      <CustomCursor />
      <ScrollProgress />
      <ParticleBackground />
      <Navigation />
      <motion.main
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
      >
        <HeroSection />
        <AboutSection />
        <ServicesSection />
        <ProjectsGallery />
        <ContactSection />
      </motion.main>
    </div>
  )
}

export default App

