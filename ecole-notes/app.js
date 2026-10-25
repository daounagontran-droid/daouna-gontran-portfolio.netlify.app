// =====================================================================
// Gestion des notes et bulletins — application hors-ligne
// Toutes les données sont enregistrées dans le navigateur (localStorage)
// et peuvent être sauvegardées / restaurées en fichier JSON.
// =====================================================================

const STORAGE_KEY = 'gnb-donnees-v1';
const UI_KEY = 'gnb-ui-v1';
const TRIMESTRES = [1, 2, 3];

const app = document.getElementById('app');
const printArea = document.getElementById('print-area');

// ---------------------------------------------------------------------
// Données
// ---------------------------------------------------------------------

function defaultState() {
    return {
        version: 1,
        ecole: {
            nom: 'Mon école',
            adresse: '',
            telephone: '',
            ville: '',
            annee: anneeScolaireCourante(),
            directeur: '',
            logo: ''
        },
        config: {
            nbDevoirs: 3,      // nombre de notes de classe par trimestre
            poidsCompo: 50,    // poids de la composition dans la moyenne de la matière (%)
            seuil: 10          // moyenne minimale pour être admis
        },
        classes: [],
        notes: {},  // notes[classeId][trimestre][matiereId][eleveId] = { d: [..], c: n }
        vie: {}     // vie[classeId][trimestre][eleveId] = { abs, ret, app }
    };
}

function anneeScolaireCourante() {
    const d = new Date();
    const y = d.getMonth() >= 7 ? d.getFullYear() : d.getFullYear() - 1;
    return `${y}-${y + 1}`;
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return normaliser(JSON.parse(raw));
    } catch (e) {
        console.error(e);
    }
    return defaultState();
}

function normaliser(data) {
    const base = defaultState();
    return {
        ...base,
        ...data,
        ecole: { ...base.ecole, ...(data.ecole || {}) },
        config: { ...base.config, ...(data.config || {}) },
        classes: Array.isArray(data.classes) ? data.classes : [],
        notes: data.notes || {},
        vie: data.vie || {}
    };
}

let state = loadState();
let saveTimer = null;

function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 250);
}

function saveNow() {
    clearTimeout(saveTimer);
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        toast("⚠️ Enregistrement impossible : espace du navigateur plein. Exportez une sauvegarde.");
    }
}

window.addEventListener('beforeunload', saveNow);

let ui = { view: 'accueil', classeId: null, trim: 1, matiereId: null, eleveId: 'all', resTrim: 1 };
try {
    ui = { ...ui, ...JSON.parse(localStorage.getItem(UI_KEY) || '{}') };
} catch (e) { /* ignoré */ }

function saveUi() {
    try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* ignoré */ }
}

// ---------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------

function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function isNum(n) {
    return typeof n === 'number' && Number.isFinite(n);
}

function fmt(n, dec = 2) {
    return isNum(n) ? n.toFixed(dec).replace('.', ',') : '—';
}

function fmtNoteInput(n) {
    return isNum(n) ? String(n).replace('.', ',') : '';
}

// Renvoie null pour une case vide, NaN pour une valeur invalide
function parseNote(str) {
    const s = String(str).trim().replace(',', '.');
    if (s === '') return null;
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0 || n > 20) return NaN;
    return Math.round(n * 100) / 100;
}

function avg(arr) {
    const v = arr.filter(isNum);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function fmtRang(r, ex, sexe) {
    if (!r) return '—';
    const s = r === 1 ? (sexe === 'F' ? '1ère' : '1er') : `${r}e`;
    return ex ? `${s} ex` : s;
}

function trimLabel(t) {
    return t === 1 ? '1er trimestre' : `${t}e trimestre`;
}

function appreciation(m) {
    if (!isNum(m)) return '';
    if (m >= 18) return 'Excellent';
    if (m >= 16) return 'Très bien';
    if (m >= 14) return 'Bien';
    if (m >= 12) return 'Assez bien';
    if (m >= 10) return 'Passable';
    if (m >= 8) return 'Insuffisant';
    if (m >= 5) return 'Faible';
    return 'Très faible';
}

function distinction(m) {
    if (!isNum(m)) return '';
    if (m >= 16) return 'Félicitations';
    if (m >= 14) return 'Encouragements';
    if (m >= 12) return "Tableau d'honneur";
    return '';
}

function nomComplet(e) {
    return `${(e.nom || '').toUpperCase()} ${e.prenom || ''}`.trim();
}

function trierEleves(eleves) {
    return [...eleves].sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), 'fr'));
}

function toast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

function telecharger(nom, contenu, type) {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function getClasse(id = ui.classeId) {
    return state.classes.find(c => c.id === id);
}

function ensureSelection() {
    if (!getClasse()) ui.classeId = state.classes[0]?.id || null;
    const c = getClasse();
    if (c && ui.matiereId !== 'vie' && !c.matieres.some(m => m.id === ui.matiereId)) {
        ui.matiereId = c.matieres[0]?.id || 'vie';
    }
    if (c && ui.eleveId !== 'all' && !c.eleves.some(e => e.id === ui.eleveId)) ui.eleveId = 'all';
}

// ---------------------------------------------------------------------
// Accès aux notes
// ---------------------------------------------------------------------

function getRec(cid, t, mid, eid) {
    return state.notes[cid]?.[t]?.[mid]?.[eid];
}

function getRecForWrite(cid, t, mid, eid) {
    const n = state.notes;
    n[cid] ??= {};
    n[cid][t] ??= {};
    n[cid][t][mid] ??= {};
    n[cid][t][mid][eid] ??= { d: [], c: null };
    return n[cid][t][mid][eid];
}

function getVie(cid, t, eid) {
    return state.vie[cid]?.[t]?.[eid] || {};
}

function getVieForWrite(cid, t, eid) {
    state.vie[cid] ??= {};
    state.vie[cid][t] ??= {};
    state.vie[cid][t][eid] ??= {};
    return state.vie[cid][t][eid];
}

// ---------------------------------------------------------------------
// Calculs
// ---------------------------------------------------------------------

function detailMatiere(rec) {
    const nb = state.config.nbDevoirs;
    const md = avg((rec?.d || []).slice(0, nb));
    const c = isNum(rec?.c) ? rec.c : null;
    const p = state.config.poidsCompo / 100;
    let moy = null;
    if (md !== null && c !== null) moy = md * (1 - p) + c * p;
    else moy = md ?? c;
    return { md, c, moy };
}

// Classement avec gestion des ex-aequo (comparaison au centième)
function classer(items) {
    const vals = items.filter(i => isNum(i.val)).map(i => ({ id: i.id, v: Math.round(i.val * 100) }));
    const res = {};
    for (const i of vals) {
        const rang = 1 + vals.filter(o => o.v > i.v).length;
        const ex = vals.filter(o => o.v === i.v).length > 1;
        res[i.id] = { rang, ex };
    }
    return res;
}

function statsDe(valeurs) {
    const v = valeurs.filter(isNum);
    return {
        moy: avg(v),
        max: v.length ? Math.max(...v) : null,
        min: v.length ? Math.min(...v) : null,
        nb: v.length
    };
}

function resultatsTrimestre(classe, t) {
    const lignesParEleve = classe.eleves.map(e => {
        const lignes = classe.matieres.map(m => {
            const d = detailMatiere(getRec(classe.id, t, m.id, e.id));
            const coef = Number(m.coef) || 0;
            return { matiere: m, ...d, coef, points: isNum(d.moy) ? d.moy * coef : null };
        });
        const avecNote = lignes.filter(l => isNum(l.moy) && l.coef > 0);
        const totalCoef = avecNote.reduce((a, l) => a + l.coef, 0);
        const totalPoints = avecNote.reduce((a, l) => a + l.points, 0);
        return {
            eleve: e,
            lignes,
            totalCoef,
            totalPoints,
            moyG: totalCoef ? totalPoints / totalCoef : null
        };
    });

    const rangs = classer(lignesParEleve.map(r => ({ id: r.eleve.id, val: r.moyG })));
    lignesParEleve.forEach(r => Object.assign(r, rangs[r.eleve.id] || { rang: null, ex: false }));

    const rangMat = {};
    const statsMat = {};
    classe.matieres.forEach((m, i) => {
        const items = lignesParEleve.map(r => ({ id: r.eleve.id, val: r.lignes[i].moy }));
        rangMat[m.id] = classer(items);
        statsMat[m.id] = statsDe(items.map(x => x.val));
    });

    const st = statsDe(lignesParEleve.map(r => r.moyG));
    st.admis = lignesParEleve.filter(r => isNum(r.moyG) && r.moyG >= state.config.seuil).length;

    return { eleves: lignesParEleve, rangMat, statsMat, stats: st };
}

function resultatsAnnuels(classe) {
    const parTrim = TRIMESTRES.map(t => resultatsTrimestre(classe, t));
    const lignes = classe.eleves.map(e => {
        const moys = parTrim.map(r => r.eleves.find(x => x.eleve.id === e.id)?.moyG ?? null);
        return { eleve: e, moys, moyA: avg(moys) };
    });
    const rangs = classer(lignes.map(l => ({ id: l.eleve.id, val: l.moyA })));
    lignes.forEach(l => Object.assign(l, rangs[l.eleve.id] || { rang: null, ex: false }));
    const st = statsDe(lignes.map(l => l.moyA));
    st.admis = lignes.filter(l => isNum(l.moyA) && l.moyA >= state.config.seuil).length;
    return { lignes, stats: st, parTrim };
}

// ---------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------

function selectClasse(action = 'set-classe') {
    return `<label class="field">Classe
        <select data-action="${action}">
            ${state.classes.map(c => `<option value="${c.id}" ${c.id === ui.classeId ? 'selected' : ''}>${esc(c.nom)}</option>`).join('')}
        </select></label>`;
}

function selectTrim(key = 'trim', avecAnnuel = false) {
    const opts = TRIMESTRES.map(t => `<option value="${t}" ${String(ui[key]) === String(t) ? 'selected' : ''}>${trimLabel(t)}</option>`);
    if (avecAnnuel) opts.push(`<option value="annuel" ${ui[key] === 'annuel' ? 'selected' : ''}>Bilan annuel</option>`);
    return `<label class="field">Période<select data-action="set-${key}">${opts.join('')}</select></label>`;
}

function aucuneClasse() {
    return `<div class="card empty">
        <p>Aucune classe pour le moment.</p>
        <p class="hint">Commencez par créer une classe, ses matières et ses élèves.</p>
        <p style="margin-top:1rem"><button class="btn" data-action="goto" data-view="classes">Créer une classe</button>
        <button class="btn secondary" data-action="demo">Charger des données de démonstration</button></p>
    </div>`;
}

const views = {};

// ---------- Accueil ----------
views.accueil = () => {
    const nbEleves = state.classes.reduce((a, c) => a + c.eleves.length, 0);
    const nbMatieres = state.classes.reduce((a, c) => a + c.matieres.length, 0);
    let nbNotes = 0;
    for (const cid in state.notes)
        for (const t in state.notes[cid])
            for (const mid in state.notes[cid][t])
                for (const eid in state.notes[cid][t][mid]) {
                    const r = state.notes[cid][t][mid][eid];
                    nbNotes += (r.d || []).filter(isNum).length + (isNum(r.c) ? 1 : 0);
                }

    return `
    <h1>Bienvenue 👋</h1>
    <p class="subtitle">Saisissez les notes de vos élèves et imprimez les bulletins en quelques clics. Tout fonctionne sans connexion internet.</p>
    <div class="stats">
        <div class="stat"><div class="value">${state.classes.length}</div><div class="label">Classes</div></div>
        <div class="stat"><div class="value">${nbEleves}</div><div class="label">Élèves</div></div>
        <div class="stat"><div class="value">${nbMatieres}</div><div class="label">Matières (toutes classes)</div></div>
        <div class="stat"><div class="value">${nbNotes}</div><div class="label">Notes saisies</div></div>
    </div>
    <div class="grid-2">
        <div class="card">
            <h2>Comment ça marche ?</h2>
            <ol class="steps">
                <li><strong>Paramètres</strong> : renseignez le nom de l'école, l'année scolaire, le logo et le mode de calcul.</li>
                <li><strong>Classes &amp; élèves</strong> : créez vos classes, leurs matières (avec coefficients) et la liste des élèves. Vous pouvez coller une liste depuis Excel.</li>
                <li><strong>Saisie des notes</strong> : choisissez la classe, le trimestre et la matière, puis tapez les notes. Touche <kbd>Entrée</kbd> pour passer à l'élève suivant.</li>
                <li><strong>Bulletins</strong> : vérifiez puis imprimez les bulletins (ou enregistrez-les en PDF).</li>
                <li><strong>Résultats</strong> : consultez le classement, les statistiques et exportez vers Excel.</li>
            </ol>
        </div>
        <div class="card">
            <h2>Sauvegarde des données</h2>
            <p>Les données sont enregistrées automatiquement <strong>dans ce navigateur, sur cet ordinateur</strong>.
            Pensez à exporter régulièrement une sauvegarde sur une clé USB ou par e-mail.</p>
            <div class="toolbar" style="margin-top:1rem">
                <button class="btn" data-action="export-json">💾 Exporter une sauvegarde</button>
                <button class="btn secondary" data-action="import-json">📂 Restaurer une sauvegarde</button>
            </div>
            ${state.classes.length ? '' : `<p class="hint">Pour découvrir l'application :</p>
            <button class="btn secondary" data-action="demo">Charger des données de démonstration</button>`}
        </div>
    </div>`;
};

// ---------- Classes & élèves ----------
views.classes = () => {
    const c = getClasse();
    return `
    <h1>Classes &amp; élèves</h1>
    <p class="subtitle">Créez les classes, leurs matières et leurs élèves. Les modifications sont enregistrées automatiquement.</p>
    <div class="grid-2" style="grid-template-columns: minmax(240px, 300px) 1fr;">
        <div class="card">
            <h2>Classes</h2>
            ${state.classes.map(k => `
                <div class="list-item ${k.id === ui.classeId ? 'selected' : ''}" data-action="pick-classe" data-id="${k.id}">
                    <span data-classe-label="${k.id}">${esc(k.nom)}</span>
                    <span class="badge">${k.eleves.length} él.</span>
                </div>`).join('') || '<p class="hint">Aucune classe.</p>'}
            <form data-form="add-classe" style="margin-top:1rem; display:flex; gap:0.4rem">
                <input name="nom" placeholder="Ex. : 6e A" required style="flex:1; min-width:0">
                <button class="btn">Ajouter</button>
            </form>
            ${state.classes.length ? '' : '<p class="hint" style="margin-top:1rem">ou <a href="#" data-action="demo">charger un exemple</a></p>'}
        </div>
        <div>${c ? detailClasse(c) : '<div class="card empty">Sélectionnez ou créez une classe.</div>'}</div>
    </div>`;
};

function detailClasse(c) {
    const totalCoef = c.matieres.reduce((a, m) => a + (Number(m.coef) || 0), 0);
    return `
    <div class="card">
        <div class="toolbar">
            <label class="field" style="flex:1">Nom de la classe
                <input data-edit="classe" data-id="${c.id}" data-key="nom" value="${esc(c.nom)}"></label>
            <label class="field" style="flex:1">Professeur principal / titulaire
                <input data-edit="classe" data-id="${c.id}" data-key="titulaire" value="${esc(c.titulaire)}"></label>
            <button class="btn secondary" data-action="dup-classe">Dupliquer</button>
            <button class="btn danger" data-action="del-classe">Supprimer</button>
        </div>
    </div>

    <div class="card">
        <h2>Matières <span class="badge">Total coefficients : ${totalCoef}</span></h2>
        <div class="table-wrap"><table>
            <thead><tr><th>Matière</th><th class="num">Coef.</th><th>Professeur</th><th></th></tr></thead>
            <tbody>
            ${c.matieres.map(m => `<tr>
                <td><input data-edit="matiere" data-id="${m.id}" data-key="nom" value="${esc(m.nom)}"></td>
                <td class="num"><input type="number" min="0" step="0.5" style="width:70px" data-edit="matiere" data-id="${m.id}" data-key="coef" value="${esc(m.coef)}"></td>
                <td><input data-edit="matiere" data-id="${m.id}" data-key="prof" value="${esc(m.prof)}"></td>
                <td class="num">
                    <button class="btn small secondary" data-action="move-matiere" data-id="${m.id}" data-dir="-1" title="Monter">↑</button>
                    <button class="btn small secondary" data-action="move-matiere" data-id="${m.id}" data-dir="1" title="Descendre">↓</button>
                    <button class="btn small danger" data-action="del-matiere" data-id="${m.id}">✕</button>
                </td>
            </tr>`).join('') || '<tr><td colspan="4" class="empty">Aucune matière.</td></tr>'}
            </tbody>
        </table></div>
        <form data-form="add-matiere" class="toolbar" style="margin-top:0.8rem">
            <label class="field" style="flex:2">Matière<input name="nom" required placeholder="Ex. : Mathématiques"></label>
            <label class="field">Coef.<input name="coef" type="number" min="0" step="0.5" value="1" style="width:80px"></label>
            <label class="field" style="flex:2">Professeur<input name="prof" placeholder="Facultatif"></label>
            <button class="btn">Ajouter la matière</button>
        </form>
    </div>

    <div class="card">
        <h2>Élèves <span class="badge">${c.eleves.length}</span></h2>
        <div class="table-wrap"><table>
            <thead><tr><th>#</th><th>Matricule</th><th>Nom</th><th>Prénom(s)</th><th>Sexe</th><th>Date de naissance</th><th></th></tr></thead>
            <tbody>
            ${c.eleves.map((e, i) => `<tr>
                <td>${i + 1}</td>
                <td><input style="width:100px" data-edit="eleve" data-id="${e.id}" data-key="matricule" value="${esc(e.matricule)}"></td>
                <td><input data-edit="eleve" data-id="${e.id}" data-key="nom" value="${esc(e.nom)}"></td>
                <td><input data-edit="eleve" data-id="${e.id}" data-key="prenom" value="${esc(e.prenom)}"></td>
                <td><select data-edit="eleve" data-id="${e.id}" data-key="sexe">
                    <option value="M" ${e.sexe === 'M' ? 'selected' : ''}>M</option>
                    <option value="F" ${e.sexe === 'F' ? 'selected' : ''}>F</option></select></td>
                <td><input style="width:120px" data-edit="eleve" data-id="${e.id}" data-key="naissance" value="${esc(e.naissance)}" placeholder="jj/mm/aaaa"></td>
                <td><button class="btn small danger" data-action="del-eleve" data-id="${e.id}">✕</button></td>
            </tr>`).join('') || '<tr><td colspan="7" class="empty">Aucun élève.</td></tr>'}
            </tbody>
        </table></div>
        ${c.eleves.length > 1 ? '<p style="margin-top:0.6rem"><button class="btn small secondary" data-action="sort-eleves">Trier par ordre alphabétique</button></p>' : ''}
        <form data-form="add-eleve" class="toolbar" style="margin-top:0.8rem">
            <label class="field">Matricule<input name="matricule" style="width:110px"></label>
            <label class="field" style="flex:1">Nom<input name="nom" required></label>
            <label class="field" style="flex:1">Prénom(s)<input name="prenom"></label>
            <label class="field">Sexe<select name="sexe"><option>M</option><option>F</option></select></label>
            <label class="field">Naissance<input name="naissance" placeholder="jj/mm/aaaa" style="width:120px"></label>
            <button class="btn">Ajouter</button>
        </form>
        <details style="margin-top:0.8rem">
            <summary style="cursor:pointer; color:var(--primary)">Importer une liste d'élèves (copier-coller depuis Excel)</summary>
            <p class="hint">Une ligne par élève, colonnes dans cet ordre : <strong>Nom ; Prénom(s) ; Sexe ; Date de naissance ; Matricule</strong>.
            Séparateur : tabulation (copie Excel) ou point-virgule. Seul le nom est obligatoire.</p>
            <form data-form="import-eleves">
                <textarea name="liste" placeholder="KOUASSI&#9;Aya&#9;F&#9;12/03/2013&#9;MAT001&#10;TRAORÉ;Moussa;M;05/11/2012;MAT002"></textarea>
                <button class="btn" style="margin-top:0.5rem">Importer</button>
            </form>
        </details>
    </div>`;
}

// ---------- Saisie ----------
views.saisie = () => {
    const c = getClasse();
    if (!c) return aucuneClasse();
    const opts = c.matieres.map(m => `<option value="${m.id}" ${m.id === ui.matiereId ? 'selected' : ''}>${esc(m.nom)} (coef. ${esc(m.coef)})</option>`).join('');
    return `
    <h1>Saisie des notes</h1>
    <p class="subtitle">Notes sur 20. Utilisez la virgule ou le point pour les décimales. <kbd>Entrée</kbd> ou <kbd>↓</kbd> : élève suivant, <kbd>↑</kbd> : élève précédent.</p>
    <div class="card">
        <div class="toolbar">
            ${selectClasse()}
            ${selectTrim()}
            <label class="field">Matière
                <select data-action="set-matiere">
                    ${opts}
                    <option value="vie" ${ui.matiereId === 'vie' ? 'selected' : ''}>— Absences &amp; appréciations du conseil —</option>
                </select></label>
            <div class="spacer"></div>
            <span class="hint">Enregistrement automatique ✔</span>
        </div>
        ${!c.eleves.length ? '<p class="empty">Cette classe n\'a pas encore d\'élèves.</p>'
            : ui.matiereId === 'vie' ? grilleVie(c) : grilleNotes(c)}
    </div>`;
};

function grilleNotes(c) {
    const m = c.matieres.find(x => x.id === ui.matiereId);
    if (!m) return '<p class="empty">Ajoutez d\'abord des matières à cette classe.</p>';
    const nb = state.config.nbDevoirs;
    const p = state.config.poidsCompo;
    const res = resultatsTrimestre(c, ui.trim);
    const rangs = res.rangMat[m.id];
    const st = res.statsMat[m.id];
    return `
    <div class="table-wrap"><table class="grille">
        <thead><tr>
            <th>#</th><th>Élève</th>
            ${Array.from({ length: nb }, (_, i) => `<th class="num">Note ${i + 1}</th>`).join('')}
            <th class="num">Moy. classe</th>
            <th class="num">Composition</th>
            <th class="num">Moy./20</th>
            <th class="num">Rang</th>
            <th>Appréciation</th>
        </tr></thead>
        <tbody>
        ${c.eleves.map((e, row) => {
            const rec = getRec(c.id, ui.trim, m.id, e.id);
            const d = detailMatiere(rec);
            const r = rangs[e.id];
            return `<tr data-eid="${e.id}">
                <td>${row + 1}</td>
                <td>${esc(nomComplet(e))}</td>
                ${Array.from({ length: nb }, (_, i) => `<td class="num"><input inputmode="decimal" data-note="d" data-idx="${i}" data-eid="${e.id}" data-row="${row}" data-col="${i}" value="${fmtNoteInput(rec?.d?.[i])}"></td>`).join('')}
                <td class="num" data-out="md">${fmt(d.md)}</td>
                <td class="num"><input inputmode="decimal" data-note="c" data-eid="${e.id}" data-row="${row}" data-col="${nb}" value="${fmtNoteInput(rec?.c)}"></td>
                <td class="num moy ${isNum(d.moy) ? (d.moy >= state.config.seuil ? 'ok' : 'ko') : ''}" data-out="moy">${fmt(d.moy)}</td>
                <td class="num" data-out="rang">${r ? fmtRang(r.rang, r.ex, e.sexe) : '—'}</td>
                <td data-out="app">${appreciation(d.moy)}</td>
            </tr>`;
        }).join('')}
        </tbody>
    </table></div>
    <p class="hint" data-out="stats-mat">${statsMatTexte(st)}</p>
    <p class="hint">Calcul : moyenne des notes de classe × ${100 - p} % + composition × ${p} % (modifiable dans les Paramètres). Si l'une des deux manque, l'autre est utilisée seule.</p>`;
}

function statsMatTexte(st) {
    return `Moyenne de la classe : <strong>${fmt(st.moy)}</strong> · Plus forte : ${fmt(st.max)} · Plus faible : ${fmt(st.min)} · Élèves notés : ${st.nb}`;
}

function grilleVie(c) {
    return `
    <div class="table-wrap"><table class="grille">
        <thead><tr><th>#</th><th>Élève</th><th class="num">Absences (h)</th><th class="num">Retards</th><th>Appréciation du conseil de classe</th></tr></thead>
        <tbody>
        ${c.eleves.map((e, row) => {
            const v = getVie(c.id, ui.trim, e.id);
            return `<tr>
                <td>${row + 1}</td>
                <td>${esc(nomComplet(e))}</td>
                <td class="num"><input inputmode="numeric" data-vie="abs" data-eid="${e.id}" data-row="${row}" data-col="0" value="${esc(v.abs)}"></td>
                <td class="num"><input inputmode="numeric" data-vie="ret" data-eid="${e.id}" data-row="${row}" data-col="1" value="${esc(v.ret)}"></td>
                <td><input class="wide" data-vie="app" data-eid="${e.id}" data-row="${row}" data-col="2" value="${esc(v.app)}" placeholder="Ex. : Bon trimestre, continuez ainsi."></td>
            </tr>`;
        }).join('')}
        </tbody>
    </table></div>
    <p class="hint">Si l'appréciation est laissée vide, le bulletin affiche une appréciation automatique selon la moyenne.</p>`;
}

function rafraichirGrille() {
    const c = getClasse();
    const m = c?.matieres.find(x => x.id === ui.matiereId);
    if (!m) return;
    const res = resultatsTrimestre(c, ui.trim);
    const rangs = res.rangMat[m.id];
    app.querySelectorAll('tr[data-eid]').forEach(tr => {
        const e = c.eleves.find(x => x.id === tr.dataset.eid);
        const d = detailMatiere(getRec(c.id, ui.trim, m.id, e.id));
        const r = rangs[e.id];
        tr.querySelector('[data-out="md"]').textContent = fmt(d.md);
        const moyCell = tr.querySelector('[data-out="moy"]');
        moyCell.textContent = fmt(d.moy);
        moyCell.classList.toggle('ok', isNum(d.moy) && d.moy >= state.config.seuil);
        moyCell.classList.toggle('ko', isNum(d.moy) && d.moy < state.config.seuil);
        tr.querySelector('[data-out="rang"]').textContent = r ? fmtRang(r.rang, r.ex, e.sexe) : '—';
        tr.querySelector('[data-out="app"]').textContent = appreciation(d.moy);
    });
    app.querySelector('[data-out="stats-mat"]').innerHTML = statsMatTexte(res.statsMat[m.id]);
}

// ---------- Bulletins ----------
views.bulletins = () => {
    const c = getClasse();
    if (!c) return aucuneClasse();
    return `
    <h1>Bulletins</h1>
    <p class="subtitle">Aperçu des bulletins. Cliquez sur « Imprimer » puis choisissez votre imprimante ou « Enregistrer au format PDF ».</p>
    <div class="card">
        <div class="toolbar">
            ${selectClasse()}
            ${selectTrim()}
            <label class="field">Élève
                <select data-action="set-eleve">
                    <option value="all">Toute la classe (${c.eleves.length})</option>
                    ${c.eleves.map(e => `<option value="${e.id}" ${e.id === ui.eleveId ? 'selected' : ''}>${esc(nomComplet(e))}</option>`).join('')}
                </select></label>
            <div class="spacer"></div>
            <button class="btn" data-action="print-bulletins" ${c.eleves.length ? '' : 'disabled'}>🖨️ Imprimer</button>
        </div>
    </div>
    <div class="bulletin-preview" id="bulletins">${c.eleves.length ? genererBulletins(c, ui.trim, ui.eleveId) : '<div class="card empty">Aucun élève dans cette classe.</div>'}</div>`;
};

function genererBulletins(c, t, eleveId) {
    const res = resultatsTrimestre(c, t);
    const annuel = t === 3 ? resultatsAnnuels(c) : null;
    const liste = eleveId === 'all' ? res.eleves : res.eleves.filter(r => r.eleve.id === eleveId);
    return liste.map(r => bulletinHtml(c, t, r, res, annuel)).join('');
}

function bulletinHtml(c, t, r, res, annuel) {
    const e = r.eleve;
    const ec = state.ecole;
    const vie = getVie(c.id, t, e.id);
    const effectif = c.eleves.length;
    const appConseil = vie.app || appreciation(r.moyG);
    const a = annuel?.lignes.find(l => l.eleve.id === e.id);

    let decision = '';
    if (a && isNum(a.moyA)) decision = a.moyA >= state.config.seuil ? 'Admis(e) en classe supérieure' : 'Redouble';

    return `
    <div class="bulletin">
        <div class="bulletin-head">
            <div>
                <div class="ecole">${esc(ec.nom)}</div>
                ${ec.adresse ? `<div>${esc(ec.adresse)}</div>` : ''}
                ${ec.telephone ? `<div>Tél. : ${esc(ec.telephone)}</div>` : ''}
            </div>
            <div>${ec.logo ? `<img src="${ec.logo}" alt="Logo">` : ''}</div>
            <div class="right">
                <div>Année scolaire <strong>${esc(ec.annee)}</strong></div>
                <div>${trimLabel(t)}</div>
            </div>
        </div>

        <div class="bulletin-title">Bulletin de notes — ${trimLabel(t)}</div>

        <div class="bulletin-eleve">
            <div>Nom et prénom(s) : <strong>${esc(nomComplet(e))}</strong></div>
            <div>Classe : <strong>${esc(c.nom)}</strong> (effectif : ${effectif})</div>
            <div>Matricule : ${esc(e.matricule) || '—'}</div>
            <div>Sexe : ${esc(e.sexe)}${e.naissance ? ` · Né${e.sexe === 'F' ? 'e' : ''} le ${esc(e.naissance)}` : ''}</div>
            ${c.titulaire ? `<div>Professeur principal : ${esc(c.titulaire)}</div>` : ''}
        </div>

        <table>
            <thead><tr>
                <th>Matières</th><th>Moy. cl.</th><th>Compo.</th><th>Moy./20</th><th>Coef.</th>
                <th>Moy. × coef.</th><th>Rang</th><th>Appréciation</th><th>Professeur</th>
            </tr></thead>
            <tbody>
            ${r.lignes.map(l => {
                const rg = res.rangMat[l.matiere.id][e.id];
                return `<tr>
                    <td>${esc(l.matiere.nom)}</td>
                    <td class="num">${fmt(l.md)}</td>
                    <td class="num">${fmt(l.c)}</td>
                    <td class="num"><strong>${fmt(l.moy)}</strong></td>
                    <td class="num">${l.coef}</td>
                    <td class="num">${fmt(l.points)}</td>
                    <td class="num">${rg ? fmtRang(rg.rang, rg.ex, e.sexe) : '—'}</td>
                    <td>${appreciation(l.moy)}</td>
                    <td>${esc(l.matiere.prof)}</td>
                </tr>`;
            }).join('')}
            </tbody>
            <tfoot><tr>
                <td colspan="4">Totaux</td>
                <td class="num">${r.totalCoef}</td>
                <td class="num">${fmt(r.totalPoints)}</td>
                <td colspan="3"></td>
            </tr></tfoot>
        </table>

        <div class="bulletin-bilan">
            <div class="box">
                <h4>Résultats du trimestre</h4>
                <div class="row"><span>Moyenne trimestrielle</span><span class="big">${fmt(r.moyG)} / 20</span></div>
                <div class="row"><span>Rang</span><span class="big">${fmtRang(r.rang, r.ex, e.sexe)} / ${effectif}</span></div>
                <div class="row"><span>Moyenne de la classe</span><span>${fmt(res.stats.moy)}</span></div>
                <div class="row"><span>Plus forte moyenne</span><span>${fmt(res.stats.max)}</span></div>
                <div class="row"><span>Plus faible moyenne</span><span>${fmt(res.stats.min)}</span></div>
            </div>
            <div class="box">
                <h4>Vie scolaire</h4>
                <div class="row"><span>Absences</span><span>${vie.abs ? esc(vie.abs) + ' h' : '0 h'}</span></div>
                <div class="row"><span>Retards</span><span>${esc(vie.ret) || '0'}</span></div>
                <div class="row"><span>Distinction</span><strong>${distinction(r.moyG) || '—'}</strong></div>
            </div>
            ${a ? `<div class="box">
                <h4>Bilan annuel</h4>
                ${a.moys.map((m, i) => `<div class="row"><span>${trimLabel(i + 1)}</span><span>${fmt(m)}</span></div>`).join('')}
                <div class="row"><span>Moyenne annuelle</span><span class="big">${fmt(a.moyA)} / 20</span></div>
                <div class="row"><span>Rang annuel</span><span>${fmtRang(a.rang, a.ex, e.sexe)} / ${effectif}</span></div>
            </div>
            <div class="box">
                <h4>Décision du conseil</h4>
                <p class="big">${decision || '—'}</p>
            </div>` : ''}
        </div>

        <div class="box" style="border:1px solid #000; padding:6px 10px; margin-top:8px">
            <strong>Appréciation du conseil de classe :</strong> ${esc(appConseil)}
        </div>

        <div class="signatures">
            <div>Le professeur principal<br><small>${esc(c.titulaire)}</small></div>
            <div>Signature des parents</div>
            <div>${ec.ville ? `${esc(ec.ville)}, le ${new Date().toLocaleDateString('fr-FR')}<br>` : ''}Le directeur<br><small>${esc(ec.directeur)}</small></div>
        </div>
    </div>`;
}

// ---------- Résultats ----------
views.resultats = () => {
    const c = getClasse();
    if (!c) return aucuneClasse();
    const annuel = ui.resTrim === 'annuel';
    return `
    <h1>Résultats de la classe</h1>
    <p class="subtitle">Classement, moyennes par matière et statistiques.</p>
    <div class="card">
        <div class="toolbar">
            ${selectClasse()}
            ${selectTrim('resTrim', true)}
            <div class="spacer"></div>
            <button class="btn secondary" data-action="export-csv">📊 Exporter (Excel / CSV)</button>
            <button class="btn" data-action="print-resultats">🖨️ Imprimer</button>
        </div>
    </div>
    <div id="resultats">${annuel ? tableAnnuel(c) : tableTrimestre(c, Number(ui.resTrim))}</div>`;
};

function statsCartes(st, total) {
    const taux = st.nb ? (st.admis / st.nb) * 100 : null;
    return `<div class="stats">
        <div class="stat"><div class="value">${fmt(st.moy)}</div><div class="label">Moyenne de la classe</div></div>
        <div class="stat"><div class="value">${fmt(st.max)}</div><div class="label">Plus forte moyenne</div></div>
        <div class="stat"><div class="value">${fmt(st.min)}</div><div class="label">Plus faible moyenne</div></div>
        <div class="stat"><div class="value">${st.admis} / ${st.nb}</div><div class="label">Moyenne ≥ ${state.config.seuil} (${taux === null ? '—' : fmt(taux, 1) + ' %'})</div></div>
        <div class="stat"><div class="value">${total - st.nb}</div><div class="label">Élèves sans moyenne</div></div>
    </div>`;
}

function tableTrimestre(c, t) {
    const res = resultatsTrimestre(c, t);
    const tri = [...res.eleves].sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9) || nomComplet(a.eleve).localeCompare(nomComplet(b.eleve), 'fr'));
    return `${statsCartes(res.stats, c.eleves.length)}
    <div class="card"><div class="table-wrap"><table>
        <thead><tr>
            <th class="num">Rang</th><th>Élève</th>
            ${c.matieres.map(m => `<th class="num" title="${esc(m.nom)}">${esc(m.nom)}<br><small>coef. ${esc(m.coef)}</small></th>`).join('')}
            <th class="num">Moy. gén.</th><th>Distinction</th>
        </tr></thead>
        <tbody>
        ${tri.map(r => `<tr>
            <td class="num">${fmtRang(r.rang, r.ex, r.eleve.sexe)}</td>
            <td>${esc(nomComplet(r.eleve))}</td>
            ${r.lignes.map(l => `<td class="num">${fmt(l.moy)}</td>`).join('')}
            <td class="num moy ${isNum(r.moyG) ? (r.moyG >= state.config.seuil ? 'ok' : 'ko') : ''}">${fmt(r.moyG)}</td>
            <td>${distinction(r.moyG)}</td>
        </tr>`).join('')}
        </tbody>
        <tfoot><tr>
            <td></td><td><strong>Moyenne de la matière</strong></td>
            ${c.matieres.map(m => `<td class="num"><strong>${fmt(res.statsMat[m.id].moy)}</strong></td>`).join('')}
            <td class="num"><strong>${fmt(res.stats.moy)}</strong></td><td></td>
        </tr></tfoot>
    </table></div></div>`;
}

function tableAnnuel(c) {
    const res = resultatsAnnuels(c);
    const tri = [...res.lignes].sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9) || nomComplet(a.eleve).localeCompare(nomComplet(b.eleve), 'fr'));
    return `${statsCartes(res.stats, c.eleves.length)}
    <div class="card"><div class="table-wrap"><table>
        <thead><tr><th class="num">Rang</th><th>Élève</th>
            ${TRIMESTRES.map(t => `<th class="num">${trimLabel(t)}</th>`).join('')}
            <th class="num">Moy. annuelle</th><th>Décision</th></tr></thead>
        <tbody>
        ${tri.map(l => `<tr>
            <td class="num">${fmtRang(l.rang, l.ex, l.eleve.sexe)}</td>
            <td>${esc(nomComplet(l.eleve))}</td>
            ${l.moys.map(m => `<td class="num">${fmt(m)}</td>`).join('')}
            <td class="num moy ${isNum(l.moyA) ? (l.moyA >= state.config.seuil ? 'ok' : 'ko') : ''}">${fmt(l.moyA)}</td>
            <td>${isNum(l.moyA) ? (l.moyA >= state.config.seuil ? 'Admis(e)' : 'Redouble') : '—'}</td>
        </tr>`).join('')}
        </tbody>
    </table></div></div>`;
}

function exporterCsv() {
    const c = getClasse();
    if (!c) return;
    const sep = ';';
    const cell = v => {
        const s = String(v ?? '');
        return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const num = n => (isNum(n) ? n.toFixed(2).replace('.', ',') : '');
    let rows;
    let suffixe;
    if (ui.resTrim === 'annuel') {
        const res = resultatsAnnuels(c);
        suffixe = 'annuel';
        rows = [['Rang', 'Matricule', 'Nom', 'Prénom(s)', 'Sexe', ...TRIMESTRES.map(trimLabel), 'Moyenne annuelle', 'Décision']];
        res.lignes.forEach(l => rows.push([
            fmtRang(l.rang, l.ex, l.eleve.sexe), l.eleve.matricule, l.eleve.nom, l.eleve.prenom, l.eleve.sexe,
            ...l.moys.map(num), num(l.moyA),
            isNum(l.moyA) ? (l.moyA >= state.config.seuil ? 'Admis(e)' : 'Redouble') : ''
        ]));
    } else {
        const t = Number(ui.resTrim);
        const res = resultatsTrimestre(c, t);
        suffixe = `T${t}`;
        rows = [['Rang', 'Matricule', 'Nom', 'Prénom(s)', 'Sexe', ...c.matieres.map(m => `${m.nom} (coef. ${m.coef})`), 'Moyenne générale', 'Distinction']];
        res.eleves.forEach(r => rows.push([
            fmtRang(r.rang, r.ex, r.eleve.sexe), r.eleve.matricule, r.eleve.nom, r.eleve.prenom, r.eleve.sexe,
            ...r.lignes.map(l => num(l.moy)), num(r.moyG), distinction(r.moyG)
        ]));
    }
    const csv = '﻿' + rows.map(r => r.map(cell).join(sep)).join('\r\n');
    telecharger(`resultats-${c.nom.replace(/\s+/g, '_')}-${suffixe}.csv`, csv, 'text/csv;charset=utf-8');
}

// ---------- Paramètres ----------
views.parametres = () => {
    const ec = state.ecole;
    const cf = state.config;
    return `
    <h1>Paramètres</h1>
    <p class="subtitle">Informations affichées sur les bulletins et règles de calcul.</p>
    <div class="card">
        <h2>Établissement</h2>
        <div class="form-grid">
            <label class="field">Nom de l'école<input data-edit="ecole" data-key="nom" value="${esc(ec.nom)}"></label>
            <label class="field">Année scolaire<input data-edit="ecole" data-key="annee" value="${esc(ec.annee)}"></label>
            <label class="field">Adresse<input data-edit="ecole" data-key="adresse" value="${esc(ec.adresse)}"></label>
            <label class="field">Téléphone<input data-edit="ecole" data-key="telephone" value="${esc(ec.telephone)}"></label>
            <label class="field">Ville (pour la date de signature)<input data-edit="ecole" data-key="ville" value="${esc(ec.ville)}"></label>
            <label class="field">Nom du directeur / de la directrice<input data-edit="ecole" data-key="directeur" value="${esc(ec.directeur)}"></label>
        </div>
        <div class="toolbar">
            ${ec.logo ? `<img src="${ec.logo}" alt="Logo" style="max-height:60px">` : ''}
            <label class="field">Logo de l'école (image)<input type="file" accept="image/*" data-action="logo"></label>
            ${ec.logo ? '<button class="btn small danger" data-action="del-logo">Retirer le logo</button>' : ''}
        </div>
    </div>
    <div class="card">
        <h2>Calcul des moyennes</h2>
        <div class="form-grid">
            <label class="field">Nombre de notes de classe (devoirs / interrogations) par trimestre
                <input type="number" min="1" max="10" data-edit="config" data-key="nbDevoirs" value="${cf.nbDevoirs}"></label>
            <label class="field">Poids de la composition dans la moyenne de la matière (%)
                <input type="number" min="0" max="100" data-edit="config" data-key="poidsCompo" value="${cf.poidsCompo}"></label>
            <label class="field">Moyenne minimale d'admission
                <input type="number" min="0" max="20" step="0.5" data-edit="config" data-key="seuil" value="${cf.seuil}"></label>
        </div>
        <p class="hint">Moyenne de la matière = moyenne des notes de classe × (100 − poids) % + composition × poids %.<br>
        Moyenne trimestrielle = Σ (moyenne × coefficient) ÷ Σ coefficients (matières notées uniquement).<br>
        Moyenne annuelle = moyenne des trois moyennes trimestrielles.</p>
    </div>
    <div class="card">
        <h2>Sauvegarde</h2>
        <div class="toolbar">
            <button class="btn" data-action="export-json">💾 Exporter une sauvegarde</button>
            <button class="btn secondary" data-action="import-json">📂 Restaurer une sauvegarde</button>
            <div class="spacer"></div>
            <button class="btn danger" data-action="reset">Effacer toutes les données</button>
        </div>
    </div>`;
};

function render() {
    ensureSelection();
    saveUi();
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === ui.view));
    document.getElementById('brand-ecole').textContent = state.ecole.nom || 'Mon école';
    document.getElementById('brand-annee').textContent = `Année scolaire ${state.ecole.annee || ''}`;
    app.innerHTML = views[ui.view]();
}

// ---------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------

function supprimerDonneesEleve(cid, eid) {
    for (const t in state.notes[cid] || {})
        for (const mid in state.notes[cid][t]) delete state.notes[cid][t][mid][eid];
    for (const t in state.vie[cid] || {}) delete state.vie[cid][t][eid];
}

function importerEleves(texte) {
    const c = getClasse();
    let n = 0;
    texte.split(/\r?\n/).forEach(ligne => {
        if (!ligne.trim()) return;
        let cols = ligne.includes('\t') ? ligne.split('\t') : ligne.split(';');
        cols = cols.map(s => s.trim());
        let [nom, prenom = '', sexe = 'M', naissance = '', matricule = ''] = cols;
        if (cols.length === 1) {
            const parts = nom.split(/\s+/);
            nom = parts.shift();
            prenom = parts.join(' ');
        }
        if (!nom) return;
        sexe = /^f/i.test(sexe) ? 'F' : 'M';
        c.eleves.push({ id: uid(), nom, prenom, sexe, naissance, matricule });
        n++;
    });
    return n;
}

function imprimer(html) {
    printArea.innerHTML = html;
    // laisse le temps aux images (logo) de se charger
    setTimeout(() => window.print(), 150);
}

function choisirFichier(accept, cb) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => input.files[0] && cb(input.files[0]);
    input.click();
}

const actions = {
    goto: el => { ui.view = el.dataset.view; render(); },
    'pick-classe': el => { ui.classeId = el.dataset.id; render(); },
    demo: () => {
        if (state.classes.length && !confirm('Ajouter les classes de démonstration à vos données ?')) return;
        chargerDemo();
        toast('Données de démonstration chargées');
        render();
    },
    'del-classe': () => {
        const c = getClasse();
        if (!confirm(`Supprimer la classe « ${c.nom} » avec tous ses élèves et toutes ses notes ?`)) return;
        state.classes = state.classes.filter(x => x.id !== c.id);
        delete state.notes[c.id];
        delete state.vie[c.id];
        ui.classeId = null;
        save(); render();
    },
    'dup-classe': () => {
        const c = getClasse();
        const copie = {
            id: uid(),
            nom: `${c.nom} (copie)`,
            titulaire: c.titulaire,
            matieres: c.matieres.map(m => ({ ...m, id: uid() })),
            eleves: []
        };
        state.classes.push(copie);
        ui.classeId = copie.id;
        toast('Classe dupliquée avec ses matières (sans les élèves)');
        save(); render();
    },
    'del-matiere': el => {
        const c = getClasse();
        const m = c.matieres.find(x => x.id === el.dataset.id);
        if (!confirm(`Supprimer la matière « ${m.nom} » et ses notes ?`)) return;
        c.matieres = c.matieres.filter(x => x.id !== m.id);
        for (const t in state.notes[c.id] || {}) delete state.notes[c.id][t][m.id];
        save(); render();
    },
    'move-matiere': el => {
        const c = getClasse();
        const i = c.matieres.findIndex(x => x.id === el.dataset.id);
        const j = i + Number(el.dataset.dir);
        if (j < 0 || j >= c.matieres.length) return;
        [c.matieres[i], c.matieres[j]] = [c.matieres[j], c.matieres[i]];
        save(); render();
    },
    'del-eleve': el => {
        const c = getClasse();
        const e = c.eleves.find(x => x.id === el.dataset.id);
        if (!confirm(`Supprimer l'élève ${nomComplet(e)} et toutes ses notes ?`)) return;
        c.eleves = c.eleves.filter(x => x.id !== e.id);
        supprimerDonneesEleve(c.id, e.id);
        save(); render();
    },
    'sort-eleves': () => {
        const c = getClasse();
        c.eleves = trierEleves(c.eleves);
        save(); render();
    },
    'print-bulletins': () => {
        const c = getClasse();
        imprimer(genererBulletins(c, ui.trim, ui.eleveId));
    },
    'print-resultats': () => {
        const c = getClasse();
        const titre = ui.resTrim === 'annuel' ? 'Bilan annuel' : trimLabel(Number(ui.resTrim));
        imprimer(`<div class="print-table">
            <h2>${esc(state.ecole.nom)} — ${esc(c.nom)} — ${titre} (${esc(state.ecole.annee)})</h2>
            ${document.getElementById('resultats').innerHTML}</div>`);
    },
    'export-csv': exporterCsv,
    'export-json': () => {
        saveNow();
        const date = new Date().toISOString().slice(0, 10);
        telecharger(`sauvegarde-notes-${date}.json`, JSON.stringify(state, null, 2), 'application/json');
        toast('Sauvegarde téléchargée');
    },
    'import-json': () => choisirFichier('application/json,.json', file => {
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (!Array.isArray(data.classes)) throw new Error('format');
                if (!confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
                state = normaliser(data);
                ui.classeId = null;
                saveNow(); render();
                toast('Sauvegarde restaurée');
            } catch (e) {
                alert("Ce fichier n'est pas une sauvegarde valide.");
            }
        };
        reader.readAsText(file);
    }),
    reset: () => {
        if (!confirm('Effacer définitivement TOUTES les données (classes, élèves, notes) ?')) return;
        if (!confirm('Êtes-vous vraiment sûr ? Pensez à exporter une sauvegarde avant.')) return;
        state = defaultState();
        saveNow(); render();
    },
    'del-logo': () => { state.ecole.logo = ''; save(); render(); }
};

// Clics
app.addEventListener('click', ev => {
    const el = ev.target.closest('[data-action]');
    if (!el || el.tagName === 'SELECT' || el.tagName === 'INPUT') return;
    const fn = actions[el.dataset.action];
    if (fn) {
        ev.preventDefault();
        fn(el);
    }
});

document.getElementById('tabs').addEventListener('click', ev => {
    const b = ev.target.closest('button[data-view]');
    if (!b) return;
    saveNow();
    ui.view = b.dataset.view;
    render();
    window.scrollTo(0, 0);
});

// Formulaires d'ajout
app.addEventListener('submit', ev => {
    ev.preventDefault();
    const f = ev.target;
    const data = Object.fromEntries(new FormData(f));
    const c = getClasse();
    switch (f.dataset.form) {
        case 'add-classe': {
            const k = { id: uid(), nom: data.nom.trim(), titulaire: '', matieres: [], eleves: [] };
            state.classes.push(k);
            ui.classeId = k.id;
            break;
        }
        case 'add-matiere':
            c.matieres.push({ id: uid(), nom: data.nom.trim(), coef: Number(data.coef) || 1, prof: data.prof.trim() });
            break;
        case 'add-eleve':
            c.eleves.push({
                id: uid(), nom: data.nom.trim(), prenom: data.prenom.trim(), sexe: data.sexe,
                naissance: data.naissance.trim(), matricule: data.matricule.trim()
            });
            break;
        case 'import-eleves': {
            const n = importerEleves(data.liste);
            toast(`${n} élève(s) importé(s)`);
            break;
        }
    }
    save();
    render();
    // garde le focus sur le premier champ pour enchaîner les saisies
    const again = app.querySelector(`form[data-form="${f.dataset.form}"] input`);
    if (again && f.dataset.form !== 'import-eleves') again.focus();
});

// Sélecteurs et champs éditables
app.addEventListener('change', ev => {
    const el = ev.target;
    const a = el.dataset.action;
    if (a === 'set-classe') { ui.classeId = el.value; ui.eleveId = 'all'; render(); return; }
    if (a === 'set-trim') { ui.trim = Number(el.value); render(); return; }
    if (a === 'set-resTrim') { ui.resTrim = el.value === 'annuel' ? 'annuel' : Number(el.value); render(); return; }
    if (a === 'set-matiere') { ui.matiereId = el.value; render(); return; }
    if (a === 'set-eleve') { ui.eleveId = el.value; render(); return; }
    if (a === 'logo') {
        const file = el.files[0];
        if (!file) return;
        if (file.size > 500 * 1024) toast("Image volumineuse : préférez un logo de moins de 500 Ko");
        const reader = new FileReader();
        reader.onload = () => { state.ecole.logo = reader.result; saveNow(); render(); };
        reader.readAsDataURL(file);
        return;
    }

    const edit = el.dataset.edit;
    if (!edit) return;
    const key = el.dataset.key;
    let val = el.value;
    if (edit === 'ecole') {
        state.ecole[key] = val;
        if (key === 'nom' || key === 'annee') {
            document.getElementById('brand-ecole').textContent = state.ecole.nom || 'Mon école';
            document.getElementById('brand-annee').textContent = `Année scolaire ${state.ecole.annee || ''}`;
        }
    } else if (edit === 'config') {
        val = Number(val);
        const bornes = { nbDevoirs: [1, 10], poidsCompo: [0, 100], seuil: [0, 20] }[key];
        if (!Number.isFinite(val)) val = state.config[key];
        val = Math.min(bornes[1], Math.max(bornes[0], val));
        if (key === 'nbDevoirs') val = Math.round(val);
        state.config[key] = val;
        el.value = val;
    } else if (edit === 'classe') {
        const c = getClasse(el.dataset.id);
        c[key] = val;
        const lbl = app.querySelector(`[data-classe-label="${c.id}"]`);
        if (lbl && key === 'nom') lbl.textContent = val;
    } else {
        const c = getClasse();
        const list = edit === 'matiere' ? c.matieres : c.eleves;
        const obj = list.find(x => x.id === el.dataset.id);
        obj[key] = key === 'coef' ? (Number(val) || 0) : val;
    }
    save();
});

// Saisie des notes en direct
app.addEventListener('input', ev => {
    const el = ev.target;
    const c = getClasse();
    if (el.dataset.note) {
        const v = parseNote(el.value);
        el.classList.toggle('invalid', Number.isNaN(v));
        if (Number.isNaN(v)) return;
        const rec = getRecForWrite(c.id, ui.trim, ui.matiereId, el.dataset.eid);
        if (el.dataset.note === 'c') rec.c = v;
        else rec.d[Number(el.dataset.idx)] = v;
        save();
        rafraichirGrille();
    } else if (el.dataset.vie) {
        const v = getVieForWrite(c.id, ui.trim, el.dataset.eid);
        v[el.dataset.vie] = el.value;
        save();
    }
});

// Navigation clavier dans les grilles
app.addEventListener('keydown', ev => {
    const el = ev.target;
    if (el.dataset.row === undefined) return;
    let dRow = 0;
    if (ev.key === 'Enter' || ev.key === 'ArrowDown') dRow = 1;
    else if (ev.key === 'ArrowUp') dRow = -1;
    else return;
    ev.preventDefault();
    const next = app.querySelector(`[data-row="${Number(el.dataset.row) + dRow}"][data-col="${el.dataset.col}"]`);
    if (next) { next.focus(); next.select(); }
});

// ---------------------------------------------------------------------
// Données de démonstration
// ---------------------------------------------------------------------

function chargerDemo() {
    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const note = (base) => Math.max(0, Math.min(20, Math.round((base + (rnd() - 0.5) * 8) * 2) / 2));

    const matieres = [
        ['Français', 4, 'M. KONÉ'], ['Mathématiques', 4, 'Mme DIALLO'], ['Anglais', 2, 'M. MENSAH'],
        ['Histoire-Géographie', 2, 'Mme BAMBA'], ['Sciences de la vie et de la terre', 2, 'M. OUÉDRAOGO'],
        ['Physique-Chimie', 2, 'M. SANOGO'], ['Éducation civique et morale', 1, 'Mme BAMBA'],
        ['Éducation physique et sportive', 1, 'M. YAO']
    ];
    const eleves = [
        ['ADJOVI', 'Ruth', 'F'], ['AKAKPO', 'Elie', 'M'], ['BAMBA', 'Fatoumata', 'F'], ['COULIBALY', 'Ibrahim', 'M'],
        ['DOSSOU', 'Grâce', 'F'], ['GBAGUIDI', 'Samuel', 'M'], ['HOUNKPATIN', 'Esther', 'F'], ['KOFFI', 'Jean-Marc', 'M'],
        ['KOUASSI', 'Aya', 'F'], ['MENSAH', 'Prince', 'M'], ['SOGLO', 'Mireille', 'F'], ['TRAORÉ', 'Moussa', 'M']
    ];

    ['6e A', '3e B'].forEach((nomClasse, ci) => {
        const c = {
            id: uid(),
            nom: nomClasse,
            titulaire: ci === 0 ? 'Mme DIALLO' : 'M. KONÉ',
            matieres: matieres.map(([nom, coef, prof]) => ({ id: uid(), nom, coef: ci === 1 && coef === 4 ? 3 : coef, prof })),
            eleves: eleves.map(([nom, prenom, sexe], i) => ({
                id: uid(), nom, prenom, sexe,
                naissance: `${String(1 + (i * 7) % 28).padStart(2, '0')}/${String(1 + (i * 5) % 12).padStart(2, '0')}/${ci === 0 ? 2014 : 2011}`,
                matricule: `${ci === 0 ? '6A' : '3B'}${String(i + 1).padStart(3, '0')}`
            }))
        };
        state.classes.push(c);
        const niveaux = c.eleves.map(() => 7 + rnd() * 10);
        [1, 2].forEach(t => {
            c.matieres.forEach(m => {
                c.eleves.forEach((e, i) => {
                    const rec = getRecForWrite(c.id, t, m.id, e.id);
                    rec.d = Array.from({ length: state.config.nbDevoirs }, () => note(niveaux[i]));
                    rec.c = note(niveaux[i]);
                });
            });
            c.eleves.forEach(e => {
                const v = getVieForWrite(c.id, t, e.id);
                v.abs = String(Math.floor(rnd() * 3) * 2);
                v.ret = String(Math.floor(rnd() * 3));
            });
        });
        if (!ui.classeId) ui.classeId = c.id;
    });
    if (state.ecole.nom === 'Mon école') {
        Object.assign(state.ecole, {
            nom: 'Complexe scolaire Les Lauréats (démo)',
            adresse: 'BP 123',
            telephone: '00 00 00 00',
            ville: 'Cotonou',
            directeur: 'M. AHOUANDJINOU'
        });
    }
    saveNow();
}

render();
