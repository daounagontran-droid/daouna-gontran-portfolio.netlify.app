// Liste des vidéos : pour remplacer une animation par votre propre vidéo filmée,
// déposez le fichier MP4 dans videos/ et modifiez "file" ci-dessous.
const VIDEOS = [
    {
        id: 'principe',
        title: 'Comment fonctionne une Wi-Fi zone ?',
        file: 'videos/principe.mp4',
        poster: 'videos/principe.jpg',
        duration: '0:33',
        desc: 'Le trajet de la connexion, de la source internet jusqu\'au téléphone du client.',
        steps: [
            'Une connexion internet (fibre, 4G ou satellite) arrive sur le site.',
            'Elle passe par un routeur hotspot qui contrôle les tickets et partage le débit.',
            'Des antennes placées en hauteur diffusent le Wi-Fi dans le quartier.',
            'Seuls les clients qui ont un ticket valide peuvent naviguer.'
        ]
    },
    {
        id: 'connexion',
        title: 'Se connecter avec un ticket',
        file: 'videos/connexion.mp4',
        poster: 'videos/connexion.jpg',
        duration: '0:37',
        desc: 'Ce que fait le client, du ticket acheté jusqu\'à la fin de son forfait.',
        steps: [
            'Le client achète un ticket (1 heure, 1 jour, 1 semaine…) qui porte un code.',
            'Il active le Wi-Fi de son téléphone et choisit le réseau de la zone.',
            'Une page de connexion s\'ouvre : il saisit le code du ticket.',
            'Il est connecté et voit le temps qu\'il lui reste.',
            'À la fin du forfait, l\'accès se coupe automatiquement.'
        ]
    },
    {
        id: 'installation',
        title: 'L\'installation, étape par étape',
        file: 'videos/installation.mp4',
        poster: 'videos/installation.jpg',
        duration: '0:38',
        desc: 'Ce que je fais chez vous pour mettre en service une Wi-Fi zone.',
        steps: [
            'Étude du site : zone à couvrir, hauteur disponible, obstacles.',
            'Pose des antennes en hauteur, orientées vers les clients.',
            'Configuration du routeur : réseau, page de connexion, forfaits, sécurité.',
            'Tests du signal et du débit sur le terrain.',
            'Formation du gérant à la création et à la vente des tickets.'
        ]
    },
    {
        id: 'gestion',
        title: 'Gérer sa Wi-Fi zone au quotidien',
        file: 'videos/gestion.mp4',
        poster: 'videos/gestion.jpg',
        duration: '0:31',
        desc: 'Les gestes du gérant une fois la Wi-Fi zone en service.',
        steps: [
            'Créer des lots de tickets en quelques clics.',
            'Voir en temps réel les clients connectés et leur temps restant.',
            'Suivre les ventes de tickets jour après jour.',
            'Faire appel à moi pour la maintenance et le dépannage.'
        ]
    }
];

const player = document.getElementById('player');
const playlist = document.getElementById('playlist');
const pageUrl = location.href.split('#')[0];
let current = 0;

VIDEOS.forEach((v, i) => {
    const li = document.createElement('li');
    li.innerHTML = `
        <button type="button" data-index="${i}">
            <span class="wz-thumb"><img src="${v.poster}" alt="" loading="lazy" width="160" height="90"><span class="wz-time">${v.duration}</span></span>
            <span class="wz-meta"><small>Vidéo ${i + 1}</small><strong>${v.title}</strong></span>
        </button>`;
    li.querySelector('button').addEventListener('click', () => select(i, true));
    playlist.appendChild(li);
});

function select(i, autoplay) {
    current = i;
    const v = VIDEOS[i];
    player.poster = v.poster;
    player.querySelector('source').src = v.file;
    player.load();
    document.getElementById('v-count').textContent = `Vidéo ${i + 1} sur ${VIDEOS.length} · ${v.duration}`;
    document.getElementById('v-title').textContent = v.title;
    document.getElementById('v-desc').textContent = v.desc;
    document.getElementById('v-steps').innerHTML = v.steps.map(s => `<li>${s}</li>`).join('');
    document.getElementById('v-download').href = v.file;
    document.getElementById('v-share').href = 'https://wa.me/?text=' + encodeURIComponent(`${v.title} — en vidéo : ${pageUrl}#video-${v.id}`);
    playlist.querySelectorAll('button').forEach((b, k) => {
        b.classList.toggle('active', k === i);
        b.setAttribute('aria-current', k === i ? 'true' : 'false');
    });
    if (autoplay) player.play().catch(() => {});
}

// Enchaîne sur la vidéo suivante
player.addEventListener('ended', () => {
    if (current < VIDEOS.length - 1) select(current + 1, true);
});

// Liens qui lancent une vidéo précise (aperçu du héros, FAQ, liens partagés #video-xxx)
function playById(id, autoplay) {
    const i = VIDEOS.findIndex(v => v.id === id);
    if (i < 0) return false;
    select(i, autoplay);
    document.getElementById('videos').scrollIntoView({ behavior: 'smooth' });
    return true;
}
document.querySelectorAll('[data-play]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    playById(a.dataset.play, true);
}));

const hash = location.hash.match(/^#video-(.+)$/);
if (!(hash && playById(hash[1], false))) select(0, false);

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
navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
    navLinks.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
}));

// Apparition progressive des blocs au défilement
if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.section-head, .skill-card, .wz-offer > *, .wz-faq').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
}

document.getElementById('year').textContent = new Date().getFullYear();
