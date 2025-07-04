import React, { useState, useRef, useEffect } from 'react'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './ProjectsGallery.css'

const ProjectsGallery = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const [selectedProject, setSelectedProject] = useState(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [isImageExpanded, setIsImageExpanded] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [itemsPerView, setItemsPerView] = useState(3)

  const projects = [
    {
      id: 1,
      title: "Casa HL",
      category: "Projeto Criativo",
      description: "Residência moderna com design contemporâneo, integrando elementos naturais e arquitetura sofisticada.",
      image: "/projeto-criativo/CASA HL/casa-hl-01.png",
      images: ["/projeto-criativo/CASA HL/casa-hl-01.png"],
      details: "Projeto Criativo | Design Contemporâneo | Integração Natural"
    },
    {
      id: 2,
      title: "Casa JT",
      category: "Projeto Criativo",
      description: "Arquitetura moderna com elementos em madeira e paisagismo tropical integrado.",
      image: "/projeto-criativo/CASA JT/casa-jt-01.png",
      images: [
        "/projeto-criativo/CASA JT/casa-jt-01.png",
        "/projeto-criativo/CASA JT/casa-jt-02.png"
      ],
      details: "Projeto Criativo | Elementos Naturais | Paisagismo Tropical"
    },
    {
      id: 3,
      title: "Casa AS",
      category: "Projeto Criativo",
      description: "Design minimalista com linhas clean, materiais nobres e integração perfeita entre interior e exterior.",
      image: "/projeto-criativo/CASA AS/casa-as-01.png",
      images: [
        "/projeto-criativo/CASA AS/casa-as-01.png",
        "/projeto-criativo/CASA AS/casa-as-02.png"
      ],
      details: "Projeto Criativo | Design Minimalista | Materiais Nobres"
    },
    {
      id: 4,
      title: "Administração e Obras",
      category: "Administração e Obras",
      description: "Gerenciamento completo de obras, garantindo eficiência, qualidade e cumprimento de prazos.",
      image: "/projeto-criativo/01-3-1-scaled.jpg",
      images: [
        "/projeto-criativo/01-3-1-scaled.jpg",
        "/projeto-criativo/IMG_20211104_165320.jpg",
        "/projeto-criativo/20220522_115715.jpg",
        "/projeto-criativo/20220522_115556.jpg",
        "/projeto-criativo/20220522_115546.jpg",
        "/projeto-criativo/20220522_115219.jpg",
        "/projeto-criativo/20220522_115158.jpg",
        "/projeto-criativo/IMG_20211104_173605.jpg"
      ],
      details: "Gestão de Projetos | Fiscalização | Planejamento"
    },
    {
      id: 5,
      title: "Projetos Interiores",
      category: "Projetos Interiores",
      description: "Criação de ambientes internos funcionais e esteticamente agradáveis, com foco no conforto e bem-estar.",
      image: "/projeto-criativo/DORMITORIO.png",
      images: [
        "/projeto-criativo/DORMITORIO.png",
        "/projeto-criativo/SALA.png",
        "/projeto-criativo/DORMITORIO 2.png",
        "/projeto-criativo/11-Dormitorio02-1.jpg",
        "/projeto-criativo/PISCINA.png",
        "/projeto-criativo/GOURMET.png"
      ],
      details: "Design de Interiores | Decoração | Otimização de Espaços"
    }
  ]

  // Função para calcular quantos itens cabem na tela
  useEffect(() => {
    const updateItemsPerView = () => {
      const width = window.innerWidth
      if (width < 768) {
        setItemsPerView(1)
      } else if (width < 1200) {
        setItemsPerView(2)
      } else {
        setItemsPerView(3)
      }
    }

    updateItemsPerView()
    window.addEventListener('resize', updateItemsPerView)
    return () => window.removeEventListener('resize', updateItemsPerView)
  }, [])

  // Ajustar currentIndex quando itemsPerView muda
  useEffect(() => {
    const maxIndex = Math.max(0, projects.length - itemsPerView)
    if (currentIndex > maxIndex) {
      setCurrentIndex(maxIndex)
    }
  }, [itemsPerView, projects.length, currentIndex])

  const nextProject = () => {
    const maxIndex = Math.max(0, projects.length - itemsPerView)
    setCurrentIndex((prevIndex) => 
      prevIndex >= maxIndex ? 0 : prevIndex + 1
    )
  }

  const prevProject = () => {
    const maxIndex = Math.max(0, projects.length - itemsPerView)
    setCurrentIndex((prevIndex) => 
      prevIndex <= 0 ? maxIndex : prevIndex - 1
    )
  }

  const getVisibleProjects = () => {
    return projects.slice(currentIndex, currentIndex + itemsPerView)
  }

  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < projects.length - itemsPerView

  const nextImage = () => {
    if (selectedProject && selectedProject.images) {
      setCurrentImageIndex((prev) => 
        prev >= selectedProject.images.length - 1 ? 0 : prev + 1
      )
    }
  }

  const prevImage = () => {
    if (selectedProject && selectedProject.images) {
      setCurrentImageIndex((prev) => 
        prev <= 0 ? selectedProject.images.length - 1 : prev - 1
      )
    }
  }

  const openModal = (project) => {
    setSelectedProject(project)
    setCurrentImageIndex(0)
    setIsImageExpanded(false)
  }

  const toggleImageExpansion = () => {
    setIsImageExpanded(!isImageExpanded)
  }

  const closeModal = () => {
    setSelectedProject(null)
    setIsImageExpanded(false)
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3
      }
    }
  }

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 60,
      scale: 0.8
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  }

  return (
    <section ref={ref} className="projects-section section" id="projects">
      <div className="container">
        <motion.div
          className="projects-header"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2>NOSSOS PROJETOS</h2>
          <p>Conheça alguns dos projetos únicos que desenvolvemos</p>
        </motion.div>

        <div className="projects-carousel">
          <motion.button
            className="carousel-btn carousel-btn-prev"
            onClick={prevProject}
            whileHover={{ scale: canGoPrev ? 1.1 : 1 }}
            whileTap={{ scale: canGoPrev ? 0.9 : 1 }}
            disabled={!canGoPrev}
          >
            <ChevronLeft size={24} />
          </motion.button>

          <motion.div
            className="projects-grid"
            variants={containerVariants}
            initial="hidden"
            animate={isInView ? "visible" : "hidden"}
            key={`${currentIndex}-${itemsPerView}`}
            style={{ gridTemplateColumns: `repeat(${itemsPerView}, 1fr)` }}
          >
            <AnimatePresence mode="wait">
              {getVisibleProjects().map((project, index) => (
                <motion.div
                  key={project.id}
                  className="project-card"
                  variants={cardVariants}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ 
                    duration: 0.5,
                    delay: index * 0.1,
                    ease: [0.25, 0.46, 0.45, 0.94]
                  }}
                  whileHover={{ 
                    y: -15,
                    rotateY: 5,
                    scale: 1.03
                  }}
                  onClick={() => openModal(project)}
                >
                  <motion.div
                    className="project-image"
                    whileHover={{ scale: 1.1 }}
                    transition={{ duration: 0.4 }}
                  >
                    <img src={project.image} alt={project.title} />
                    <motion.div
                      className="project-overlay"
                      initial={{ opacity: 0 }}
                      whileHover={{ opacity: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <motion.button
                        className="view-project-btn"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        Ver Detalhes
                      </motion.button>
                    </motion.div>
                  </motion.div>
                  
                  <div className="project-content">
                    <span className="project-category">{project.category}</span>
                    <h3>{project.title}</h3>
                    <p>{project.description}</p>
                    <div className="project-details">{project.details}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          <motion.button
            className="carousel-btn carousel-btn-next"
            onClick={nextProject}
            whileHover={{ scale: canGoNext ? 1.1 : 1 }}
            whileTap={{ scale: canGoNext ? 0.9 : 1 }}
            disabled={!canGoNext}
          >
            <ChevronRight size={24} />
          </motion.button>
        </div>

        {/* Modal */}
        <AnimatePresence>
          {selectedProject && (
            <motion.div
              className={`project-modal ${isImageExpanded ? 'image-expanded' : ''}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={isImageExpanded ? toggleImageExpansion : closeModal}
            >
              <motion.div
                className={`modal-content ${isImageExpanded ? 'expanded' : ''}`}
                initial={{ scale: 0.8, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.8, y: 50 }}
                onClick={(e) => e.stopPropagation()}
              >
                <button 
                  className="close-modal"
                  onClick={closeModal}
                >
                  ×
                </button>
                
                <div className={`modal-image-container ${isImageExpanded ? 'expanded' : ''}`}>
                  {selectedProject.images && selectedProject.images.length > 1 && !isImageExpanded && (
                    <button 
                      className="modal-nav-btn modal-nav-prev"
                      onClick={prevImage}
                    >
                      <ChevronLeft size={24} />
                    </button>
                  )}
                  
                  <img 
                    src={selectedProject.images ? selectedProject.images[currentImageIndex] : selectedProject.image} 
                    alt={selectedProject.title}
                    className={`modal-image ${isImageExpanded ? 'expanded' : ''}`}
                    onClick={toggleImageExpansion}
                    style={{ cursor: 'pointer' }}
                  />
                  
                  {selectedProject.images && selectedProject.images.length > 1 && !isImageExpanded && (
                    <button 
                      className="modal-nav-btn modal-nav-next"
                      onClick={nextImage}
                    >
                      <ChevronRight size={24} />
                    </button>
                  )}
                  
                  {selectedProject.images && selectedProject.images.length > 1 && !isImageExpanded && (
                    <div className="modal-image-counter">
                      {currentImageIndex + 1} / {selectedProject.images.length}
                    </div>
                  )}
                </div>
                
                {!isImageExpanded && (
                  <div className="modal-info">
                    <span className="modal-category">{selectedProject.category}</span>
                    <h3>{selectedProject.title}</h3>
                    <p>{selectedProject.description}</p>
                    <div className="modal-details">{selectedProject.details}</div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

export default ProjectsGallery

