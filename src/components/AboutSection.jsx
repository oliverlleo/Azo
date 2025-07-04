import React, { useRef, useState } from 'react'
import { motion, useInView, useScroll, useTransform } from 'framer-motion'
import { Award, Users, Building, Lightbulb } from 'lucide-react'
import './AboutSection.css'

const AboutSection = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })
  const [isSociosModalOpen, setIsSociosModalOpen] = useState(false)
  
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"]
  })
  
  const y = useTransform(scrollYProgress, [0, 1], [100, -100])

  const openSociosModal = () => {
    setIsSociosModalOpen(true)
  }

  const closeSociosModal = () => {
    setIsSociosModalOpen(false)
  }

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

  const itemVariants = {
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
        duration: 0.8,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  }

  const textRevealVariants = {
    hidden: { 
      opacity: 0,
      clipPath: "inset(0 100% 0 0)"
    },
    visible: {
      opacity: 1,
      clipPath: "inset(0 0% 0 0)",
      transition: {
        duration: 1.2,
        ease: "easeInOut"
      }
    }
  }

  return (
    <section ref={ref} className="about-section section" id="about">
      <div className="container">
        <motion.div
          className="about-content"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          <motion.div className="about-header" variants={itemVariants}>
            <motion.h2 variants={textRevealVariants}>
              QUEM SOMOS
            </motion.h2>
            <motion.div className="section-divider" variants={itemVariants}>
              <div className="divider-line"></div>
              <div className="divider-dot"></div>
              <div className="divider-line"></div>
            </motion.div>
          </motion.div>

          <motion.div className="about-grid">
            <motion.div className="about-text" variants={itemVariants}>
              <motion.h3 variants={textRevealVariants} className="desktop-title">
                A AZO CRIAÇÃO E CONSTRUÇÃO NASCEU A PARTIR DA UNIÃO DE VALORES, FORTE PARCERIA DE VIDA, TROCAS ACADÊMICAS E A GRANDE VONTADE DE EMPREENDER DOS QUATRO SÓCIOS.
              </motion.h3>
              <motion.h3 variants={textRevealVariants} className="mobile-title">
                A AZO surge da união de valores e do espírito empreendedor de seus quatro sócios.
              </motion.h3>
              
              <motion.p variants={itemVariants}>
                Luana Briene, Bruna Vida, Vinícius Vida e Vitor Machado somaram as experiências vividas durante a faculdade como viagens, intercâmbios internacionais, iniciação científica, participação em congresso, cursos e estágios, mais a vida profissional contando com especializações, cargo de gerência, experiências com projetos verticais e multiprojetos para formar a AZO.
              </motion.p>
              
              <motion.p variants={itemVariants}>
                Hoje a empresa é composta por profissionais com um alto grau de conhecimento e anos de experiência na área, com o objetivo principal de ressignificar o Conceito da construção residencial.
              </motion.p>

              <motion.div className="stats-grid" variants={itemVariants}>
                <motion.div 
                  className="stat-item"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Award size={32} strokeWidth={1.5} className="stat-icon" />
                  <motion.h4
                    initial={{ opacity: 0, scale: 0 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 1, duration: 0.5 }}
                  >
                    15+
                  </motion.h4>
                  <p>Anos de Experiência</p>
                </motion.div>
                
                <motion.div 
                  className="stat-item"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Building size={32} strokeWidth={1.5} className="stat-icon" />
                  <motion.h4
                    initial={{ opacity: 0, scale: 0 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 1.2, duration: 0.5 }}
                  >
                    100+
                  </motion.h4>
                  <p>Projetos Realizados</p>
                </motion.div>
                
                <motion.div 
                  className="stat-item"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  onClick={openSociosModal}
                  style={{ cursor: 'pointer' }}
                >
                  <Users size={32} strokeWidth={1.5} className="stat-icon" />
                  <motion.h4
                    initial={{ opacity: 0, scale: 0 }}
                    animate={isInView ? { opacity: 1, scale: 1 } : {}}
                    transition={{ delay: 1.4, duration: 0.5 }}
                  >
                    4
                  </motion.h4>
                  <p>Sócios Fundadores</p>
                </motion.div>
              </motion.div>
            </motion.div>

            <motion.div 
              className="about-visual"
              variants={itemVariants}
              style={{ y }}
            >
              <motion.div
                className="visual-card"
                whileHover={{ 
                  rotateY: 10,
                  rotateX: 10,
                  scale: 1.02
                }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <div className="card-content">
                  <motion.div
                    className="floating-icon"
                    animate={{ 
                      y: [0, -10, 0],
                      rotate: [0, 5, 0]
                    }}
                    transition={{ 
                      duration: 4,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Lightbulb size={48} strokeWidth={1.5} />
                  </motion.div>
                  <h4>Inovação em Construção</h4>
                  <p>Projetos únicos que refletem a personalidade de cada cliente</p>
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Modal dos Sócios */}
        {isSociosModalOpen && (
          <motion.div
            className="socios-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeSociosModal}
          >
            <motion.div
              className="socios-modal-content"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button className="close-socios-modal" onClick={closeSociosModal}>×</button>
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img src="/socios.png" alt="Sócios Fundadores" className="socios-image" />
                
                {/* Área da Luana (primeira pessoa - esquerda) */}
                <div 
                  className="socio-area"
                  style={{
                    top: '10%',
                    left: '5%',
                    width: '20%',
                    height: '80%'
                  }}
                >
                  <div className="socio-tooltip">Luana Briene</div>
                </div>
                
                {/* Área da Bruna (segunda pessoa) */}
                <div 
                  className="socio-area"
                  style={{
                    top: '10%',
                    left: '27%',
                    width: '20%',
                    height: '80%'
                  }}
                >
                  <div className="socio-tooltip">Bruna Vida</div>
                </div>
                
                {/* Área do Vinícius (terceira pessoa) */}
                <div 
                  className="socio-area"
                  style={{
                    top: '10%',
                    left: '49%',
                    width: '20%',
                    height: '80%'
                  }}
                >
                  <div className="socio-tooltip">Vinícius Vida</div>
                </div>
                
                {/* Área do Vitor (quarta pessoa - direita) */}
                <div 
                  className="socio-area"
                  style={{
                    top: '10%',
                    left: '71%',
                    width: '24%',
                    height: '80%'
                  }}
                >
                  <div className="socio-tooltip">Vitor Machado</div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </section>
  )
}

export default AboutSection

