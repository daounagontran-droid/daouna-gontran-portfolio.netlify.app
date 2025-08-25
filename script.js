// Navigation smooth scrolling
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Header background on scroll
window.addEventListener('scroll', function() {
    const header = document.querySelector('header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(255, 255, 255, 0.95)';
        header.querySelector('.logo').style.color = '#333';
        header.querySelectorAll('.nav-links a').forEach(link => {
            link.style.color = '#333';
        });
    } else {
        header.style.background = 'rgba(255, 255, 255, 0.1)';
        header.querySelector('.logo').style.color = 'white';
        header.querySelectorAll('.nav-links a').forEach(link => {
            link.style.color = 'white';
        });
    }
});

// Form submission
document.querySelector('.contact-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Récupérer les données du formulaire
    const formData = new FormData(this);
    const name = formData.get('name');
    const email = formData.get('email');
    const subject = formData.get('subject');
    const message = formData.get('message');
    
    // Créer le lien mailto
    const mailtoLink = `mailto:daounagontran@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        `Nom: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    )}`;
    
    // Ouvrir le client email
    window.location.href = mailtoLink;
    
    // Réinitialiser le formulaire
    this.reset();
    
    alert('Votre client email va s\'ouvrir avec le message prérempli. Vous pouvez maintenant l\'envoyer !');
});

// Animate elements on scroll
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe all sections
document.querySelectorAll('section').forEach(section => {
    section.style.opacity = '0';
    section.style.transform = 'translateY(20px)';
    section.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(section);
});

// Hero section is always visible
document.querySelector('.hero').style.opacity = '1';
document.querySelector('.hero').style.transform = 'translateY(0)';

// Animation pour les cartes au scroll
const cardObserver = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.animation = 'fadeInUp 0.6s ease forwards';
        }
    });
}, { threshold: 0.1 });

// Observer les cartes de compétences et projets
document.querySelectorAll('.skill-card, .project-card').forEach(card => {
    cardObserver.observe(card);
});

// Menu mobile (optionnel)
const createMobileMenu = () => {
    if (window.innerWidth <= 768) {
        const nav = document.querySelector('nav');
        const navLinks = document.querySelector('.nav-links');
        
        if (!document.querySelector('.mobile-menu-toggle')) {
            const mobileToggle = document.createElement('button');
            mobileToggle.className = 'mobile-menu-toggle';
            mobileToggle.innerHTML = '☰';
            mobileToggle.style.cssText = `
                background: none;
                border: none;
                color: white;
                font-size: 1.5rem;
                cursor: pointer;
                display: block;
            `;
            
            nav.appendChild(mobileToggle);
            
            mobileToggle.addEventListener('click', () => {
                navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
                navLinks.style.position = 'absolute';
                navLinks.style.top = '100%';
                navLinks.style.left = '0';
                navLinks.style.right = '0';
                navLinks.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
                navLinks.style.flexDirection = 'column';
                navLinks.style.padding = '1rem';
            });
        }
    }
};

// Initialiser au chargement et au redimensionnement
window.addEventListener('load', createMobileMenu);
window.addEventListener('resize', createMobileMenu);