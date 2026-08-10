import React, { useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Home, Construction, Palette } from 'lucide-react'
import './ServicesSection.css'

const ServicesSection = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })

  const services = [
    {
      title: "PROJETO RESIDENCIAL",
      description: "O projeto criativo arquitetônico é desenvolvido pelas arquitetas: Bruna Vida e Luana Briene. Além disso, desenvolvemos todo o processo de aprovação em condomínio, prefeitura e executivos que são realizados pela equipe de arquitetos.",
      icon: Home,
      color: "var(--color-primary)"
    },
    {
      title: "ADMINISTRAÇÃO E OBRA",
      description: "Por termos uma equipe multiprofissional, nós podemos te garantir sua tranquilidade ao longo da execução do seu projeto. Nós realizamos a construção, garantindo a qualidade da execução, cumprimento dos prazos e orçamentos.",
      icon: Construction,
      color: "var(--color-accent)"
    },
    {
      title: "PROJETO DE INTERIORES",
      description: "O projeto criativo de interiores é desenvolvido pelas arquitetas: Bruna Vida e Luana Briene. O foco é projetar ambientes com uma excelente análise de layout, definindo a melhor distribuição dos móveis, objetos e equipamentos.",
      icon: Palette,
      color: "var(--color-primary)"
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.3,
        delayChildren: 0.2
      }
    }
  }

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 80,
      rotateX: -15
    },
    visible: {
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        duration: 0.8,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  }

  return (
    <section ref={ref} className="services-section section" id="services">
      <div className="container">
        <motion.div
          className="services-header"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2>NOSSOS SERVIÇOS</h2>
          <p>Oferecemos soluções completas para transformar seus sonhos em realidade</p>
        </motion.div>

        <motion.div
          className="services-grid"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          {services.map((service, index) => (
            <motion.div
              key={index}
              className="service-card"
              variants={cardVariants}
              whileHover={{ 
                y: -10,
                rotateY: 5,
                scale: 1.02
              }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <motion.div
                className="service-icon"
                animate={{ 
                  rotate: [0, 10, -10, 0],
                  scale: [1, 1.1, 1]
                }}
                transition={{ 
                  duration: 4,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: index * 0.5
                }}
              >
                <service.icon size={48} strokeWidth={1.5} />
              </motion.div>
              
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              
              <motion.div
                className="service-overlay"
                initial={{ opacity: 0 }}
                whileHover={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                style={{ background: service.color }}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

export default ServicesSection

