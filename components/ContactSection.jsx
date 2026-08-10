import React, { useState, useRef } from 'react'
import { motion, useInView } from 'framer-motion'
import { Phone, Mail, MapPin, Instagram } from 'lucide-react'
import './ContactSection.css'

const ContactSection = () => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    
    // Simular envio
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    setIsSubmitting(false)
    setFormData({ name: '', email: '', phone: '', message: '' })
    alert('Mensagem enviada com sucesso!')
  }

  const contactInfo = [
    {
      icon: Phone,
      title: "Telefone",
      value: "(15) 99718-0355",
      link: "tel:+5515997180355"
    },
    {
      icon: Mail,
      title: "Email",
      value: "contato@azocc.com.br",
      link: "mailto:contato@azocc.com.br"
    },
    {
      icon: MapPin,
      title: "Endereço",
      value: "Rua Horácio Cenci, 75 | P. Campolim, Sorocaba - SP",
      link: "#"
    },
    {
      icon: Instagram,
      title: "Instagram",
      value: "@azocriacaoeconstrucao",
      link: "https://instagram.com/azocriacaoeconstrucao"
    }
  ]

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

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: 50
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        ease: [0.25, 0.46, 0.45, 0.94]
      }
    }
  }

  return (
    <section ref={ref} className="contact-section section" id="contact">
      <div className="container">
        <motion.div
          className="contact-header"
          initial={{ opacity: 0, y: 50 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2>FALE CONOSCO</h2>
          <p>Faça seu orçamento ou tire suas dúvidas. Entre em contato conosco.</p>
        </motion.div>

        <motion.div
          className="contact-content"
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
        >
          <motion.div className="contact-info" variants={itemVariants}>
            <h3>Informações de Contato</h3>
            <div className="contact-items">
              {contactInfo.map((item, index) => (
                <motion.a
                  key={index}
                  href={item.link}
                  className="contact-item"
                  whileHover={{ 
                    x: 10,
                    scale: 1.02
                  }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <motion.div
                    className="contact-icon"
                    animate={{ 
                      rotate: [0, 10, -10, 0]
                    }}
                    transition={{ 
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut",
                      delay: index * 0.5
                    }}
                  >
                    <item.icon size={24} strokeWidth={1.5} />
                  </motion.div>
                  <div className="contact-details">
                    <h4>{item.title}</h4>
                    <p>{item.value}</p>
                  </div>
                </motion.a>
              ))}
            </div>
          </motion.div>

          <motion.div className="contact-form-container" variants={itemVariants}>
            <h3>Envie sua Mensagem</h3>
            <form onSubmit={handleSubmit} className="contact-form">
              <motion.div
                className="form-group"
                whileFocus={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <motion.input
                  type="text"
                  name="name"
                  placeholder="Seu Nome"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                  whileFocus={{ 
                    borderColor: "var(--color-primary)",
                    boxShadow: "0 0 0 3px rgba(44, 95, 93, 0.1)"
                  }}
                />
              </motion.div>

              <motion.div
                className="form-group"
                whileFocus={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <motion.input
                  type="email"
                  name="email"
                  placeholder="Seu Email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  whileFocus={{ 
                    borderColor: "var(--color-primary)",
                    boxShadow: "0 0 0 3px rgba(44, 95, 93, 0.1)"
                  }}
                />
              </motion.div>

              <motion.div
                className="form-group"
                whileFocus={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <motion.input
                  type="tel"
                  name="phone"
                  placeholder="Seu Telefone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  whileFocus={{ 
                    borderColor: "var(--color-primary)",
                    boxShadow: "0 0 0 3px rgba(44, 95, 93, 0.1)"
                  }}
                />
              </motion.div>

              <motion.div
                className="form-group"
                whileFocus={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <motion.textarea
                  name="message"
                  placeholder="Sua Mensagem"
                  rows="5"
                  value={formData.message}
                  onChange={handleInputChange}
                  required
                  whileFocus={{ 
                    borderColor: "var(--color-primary)",
                    boxShadow: "0 0 0 3px rgba(44, 95, 93, 0.1)"
                  }}
                />
              </motion.div>

              <motion.button
                type="submit"
                className="submit-btn"
                disabled={isSubmitting}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                animate={isSubmitting ? { 
                  background: ["var(--color-primary)", "var(--color-accent)", "var(--color-primary)"]
                } : {}}
                transition={{ duration: 0.5, repeat: isSubmitting ? Infinity : 0 }}
              >
                {isSubmitting ? 'Enviando...' : 'Enviar Mensagem'}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}

export default ContactSection

