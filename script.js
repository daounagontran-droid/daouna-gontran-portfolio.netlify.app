// En-tête opaque après défilement
const header = document.getElementById('header');
const updateHeader = () => header.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', updateHeader, { passive: true });
updateHeader();

// Menu mobile
const navToggle = document.getElementById('nav-toggle');
const navLinks = document.getElementById('nav-links');

navToggle.addEventListener('click', () => {
    const open = navLinks.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', open);
});

navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
    });
});

// Formulaire de contact : ouvre le client e-mail avec le message prérempli
document.querySelector('.contact-form').addEventListener('submit', function (e) {
    e.preventDefault();

    const formData = new FormData(this);
    const name = formData.get('name');
    const email = formData.get('email');
    const subject = formData.get('subject');
    const message = formData.get('message');

    const mailtoLink = `mailto:daounagontran@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(
        `Nom: ${name}\nEmail: ${email}\n\nMessage:\n${message}`
    )}`;

    window.location.href = mailtoLink;
    this.reset();
    alert('Votre client e-mail va s\'ouvrir avec le message prérempli. Vous pouvez maintenant l\'envoyer !');
});

// Apparition progressive des blocs au défilement
const revealTargets = document.querySelectorAll('.section-head, .about-grid > *, .skill-card, .featured, .project-card, .cert, .contact-grid > *');

if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

    revealTargets.forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
}

// Année du pied de page
document.getElementById('year').textContent = new Date().getFullYear();
