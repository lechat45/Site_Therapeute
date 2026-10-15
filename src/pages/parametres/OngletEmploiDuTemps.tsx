// Paramètres de l'emploi du temps : horaires, jours, durée par défaut,
// couleurs des catégories (vérifiées pour les personnes daltoniennes, avec
// un aperçu simulé) et message de rappel.

import { useState, type CSSProperties } from 'react';
import { Erreur, useNotifier } from '../../composants/Commun';
import { Icone } from '../../composants/Icone';
import { CATEGORIES, categorie, couleursAgenda, JOURS, NUANCIER_AGENDA } from '../../config/agenda';
import { PARAMETRES_PAR_DEFAUT, VARIABLES_RAPPEL } from '../../config/parametresDefaut';
import { confusions, contraste, NOMS_DALTONISME, type Daltonisme } from '../../domaine/couleurs';
import { messageErreur } from '../../domaine/format';
import { remplirModele } from '../../domaine/messages';
import type { CategorieRdv } from '../../domaine/types';
import { useReglages } from '../../etat/reglages';
import { useTherapeute } from '../../etat/session';

// Mêmes matrices que domaine/couleurs.ts (Machado 2009), appliquées par un
// filtre SVG à l'aperçu : on voit les couleurs comme une personne daltonienne.
const FILTRES: Record<Daltonisme, string> = {
  protan:
    '0.152286 1.052583 -0.204868 0 0  0.114503 0.786281 0.099216 0 0  -0.003882 -0.048116 1.051998 0 0  0 0 0 1 0',
  deutan: '0.367322 0.860646 -0.227968 0 0  0.280085 0.672501 0.047413 0 0  -0.01182 0.04294 0.968881 0 0  0 0 0 1 0',
  tritan: '1.255528 -0.076749 -0.178779 0 0  -0.078411 0.930809 0.147602 0 0  0.004733 0.691367 0.3039 0 0  0 0 0 1 0',
};

export function OngletEmploiDuTemps() {
  const { parametres, enregistrer } = useReglages();
  const t = useTherapeute();
  const notifier = useNotifier();
  const [debut, setDebut] = useState(parametres.agenda_heure_debut);
  const [fin, setFin] = useState(parametres.agenda_heure_fin);
  const [jours, setJours] = useState<number[]>(parametres.agenda_jours);
  const [duree, setDuree] = useState(parametres.duree_rdv_minutes);
  const [couleurs, setCouleurs] = useState<Partial<Record<CategorieRdv, string>>>(parametres.agenda_couleurs);
  const [modele, setModele] = useState(parametres.modele_rappel);
  const [simulation, setSimulation] = useState<Daltonisme | 'normale'>('normale');
  const [erreur, setErreur] = useState<string | null>(null);

  const effectives = couleursAgenda({ agenda_couleurs: couleurs });
  const problemes = confusions(effectives);
  const modifie =
    JSON.stringify([debut, fin, [...jours].sort(), duree, couleurs, modele]) !==
    JSON.stringify([
      parametres.agenda_heure_debut,
      parametres.agenda_heure_fin,
      [...parametres.agenda_jours].sort(),
      parametres.duree_rdv_minutes,
      parametres.agenda_couleurs,
      parametres.modele_rappel,
    ]);

  async function valider() {
    setErreur(null);
    if (debut >= fin) return setErreur('La journée doit finir après avoir commencé.');
    if (!jours.length) return setErreur('Choisissez au moins un jour de travail.');
    try {
      await enregistrer({
        agenda_heure_debut: debut,
        agenda_heure_fin: fin,
        agenda_jours: [...jours].sort((a, b) => a - b),
        duree_rdv_minutes: duree,
        agenda_couleurs: couleurs,
        modele_rappel: modele,
      });
      notifier('Emploi du temps enregistré.');
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  const choisirCouleur = (cle: CategorieRdv, c: string) =>
    setCouleurs((x) => {
      const suivant = { ...x };
      if (c === categorie(cle).couleur) delete suivant[cle];
      else suivant[cle] = c;
      return suivant;
    });

  const apercuRappel = remplirModele(modele, {
    prenom: 'Léa',
    nom: 'Exemple',
    therapeute: `${t.prenom} ${t.nom}`,
    signature: parametres.signature,
    site: parametres.nom_site,
    date: 'mardi 6 octobre',
    heure: '14 h 30',
    lieu: 'au cabinet',
  });

  return (
    <>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        {(Object.keys(FILTRES) as Daltonisme[]).map((d) => (
          <filter key={d} id={`simulation-${d}`}>
            <feColorMatrix type="matrix" values={FILTRES[d]} />
          </filter>
        ))}
      </svg>

      <section className="carte" aria-labelledby="t-horaires">
        <div className="carte-entete">
          <div>
            <h2 id="t-horaires" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icone nom="calendrier" /> Horaires
            </h2>
            <p className="aide">
              La grille de la semaine affiche ces heures et ces jours (et tout rendez-vous qui en sort).
            </p>
          </div>
        </div>
        <div className="carte-corps" style={{ display: 'grid', gap: 16 }}>
          <div className="grille-reglages">
            <div className="champ">
              <label htmlFor="ag-debut">Début de journée</label>
              <select id="ag-debut" value={debut} onChange={(e) => setDebut(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {h} h
                  </option>
                ))}
              </select>
            </div>
            <div className="champ">
              <label htmlFor="ag-fin">Fin de journée</label>
              <select id="ag-fin" value={fin} onChange={(e) => setFin(Number(e.target.value))}>
                {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                  <option key={h} value={h}>
                    {h} h
                  </option>
                ))}
              </select>
            </div>
            <div className="champ">
              <label htmlFor="ag-duree">Durée par défaut d’un rendez-vous</label>
              <select id="ag-duree" value={duree} onChange={(e) => setDuree(Number(e.target.value))}>
                {[30, 45, 50, 60, 75, 90, 120].map((d) => (
                  <option key={d} value={d}>
                    {d} min
                  </option>
                ))}
              </select>
            </div>
          </div>
          <fieldset className="champ segments-champ">
            <legend className="etiquette">Jours de travail</legend>
            <div className="segments">
              {JOURS.map((nom, i) => (
                <button
                  key={nom}
                  type="button"
                  className="segment"
                  aria-pressed={jours.includes(i + 1)}
                  onClick={() =>
                    setJours((js) => (js.includes(i + 1) ? js.filter((j) => j !== i + 1) : [...js, i + 1]))
                  }
                >
                  {jours.includes(i + 1) && <Icone nom="valider" taille={13} />} {nom}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      </section>

      <section className="carte" aria-labelledby="t-couleurs-agenda">
        <div className="carte-entete">
          <div>
            <h2 id="t-couleurs-agenda" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icone nom="palette" /> Couleurs des rendez-vous
            </h2>
            <p className="aide">
              Les couleurs d’origine restent distinctes pour toutes les formes de daltonisme. Si vous en changez,
              l’application vérifie qu’elles restent lisibles. Chaque type garde aussi son pictogramme et son nom.
            </p>
          </div>
        </div>
        <div className="carte-corps" style={{ display: 'grid', gap: 14 }}>
          {CATEGORIES.map((c) => (
            <div key={c.cle} className="ligne-couleur-agenda">
              <span className={`legende-categorie pave-${c.cle}`} style={{ '--c': effectives[c.cle] } as CSSProperties}>
                <span className="legende-pastille" aria-hidden />
                <Icone nom={c.icone} taille={14} /> {c.libelle}
              </span>
              <div className="nuancier nuancier-petit" role="radiogroup" aria-label={`Couleur : ${c.libelle}`}>
                {NUANCIER_AGENDA.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={effectives[c.cle] === n}
                    className="pastille-couleur"
                    style={{ background: n }}
                    aria-label={n === c.couleur ? `${n} (couleur d’origine)` : n}
                    title={n === c.couleur ? 'Couleur d’origine' : n}
                    onClick={() => choisirCouleur(c.cle, n)}
                  >
                    {effectives[c.cle] === n && <Icone nom="valider" taille={14} />}
                  </button>
                ))}
                <label className="couleur-libre">
                  <input
                    type="color"
                    value={effectives[c.cle]}
                    onChange={(e) => choisirCouleur(c.cle, e.target.value.toLowerCase())}
                    aria-label={`Autre couleur : ${c.libelle}`}
                  />
                </label>
              </div>
              {contraste(effectives[c.cle], '#ffffff') < 3 && (
                <span className="erreur-champ">
                  <Icone nom="info" taille={14} /> Trop claire : peu visible sur fond blanc.
                </span>
              )}
            </div>
          ))}

          {problemes.length > 0 ? (
            <div className="alerte alerte-danger" role="status">
              <Icone nom="info" />
              <div>
                <strong>Couleurs difficiles à distinguer :</strong>
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {problemes.map((p) => (
                    <li key={`${p.a}-${p.b}`}>
                      {categorie(p.a).libelle} et {categorie(p.b).libelle} —{' '}
                      {p.vision === 'normale'
                        ? 'trop proches pour tout le monde'
                        : `confondues en cas de ${NOMS_DALTONISME[p.vision]}`}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="meta">
              <Icone nom="valider" taille={14} /> Toutes les couleurs restent distinctes, y compris pour les personnes
              daltoniennes.
            </p>
          )}

          <div className="apercu-daltonisme">
            <div className="champ" style={{ maxWidth: 320 }}>
              <label htmlFor="ag-simulation">Voir l’aperçu comme…</label>
              <select
                id="ag-simulation"
                value={simulation}
                onChange={(e) => setSimulation(e.target.value as Daltonisme | 'normale')}
              >
                {(['normale', 'protan', 'deutan', 'tritan'] as const).map((v) => (
                  <option key={v} value={v}>
                    {v === 'normale'
                      ? 'une personne à la vision normale'
                      : `une personne atteinte de ${NOMS_DALTONISME[v]}`}
                  </option>
                ))}
              </select>
            </div>
            <div
              className="apercu-paves"
              style={{ filter: simulation === 'normale' ? undefined : `url(#simulation-${simulation})` }}
              aria-label="Aperçu des rendez-vous"
            >
              {CATEGORIES.map((c) => (
                <span
                  key={c.cle}
                  className={`pave pave-ligne pave-${c.cle} pave-prevu`}
                  style={{ '--c': effectives[c.cle] } as CSSProperties}
                >
                  <span className="pave-tete">
                    <Icone nom={c.icone} taille={13} /> <span className="pave-heure">14:00</span>
                  </span>
                  <span className="pave-nom">
                    {c.avecClient ? 'Léa Exemple' : c.cle === 'personnel' ? 'Congé' : 'Supervision'}
                  </span>
                  <span className="pave-meta">{c.court}</span>
                </span>
              ))}
            </div>
          </div>

          <div>
            <button
              type="button"
              className="bouton"
              onClick={() => setCouleurs({})}
              disabled={!Object.keys(couleurs).length}
            >
              Revenir aux couleurs adaptées à tous
            </button>
          </div>
        </div>
      </section>

      <section className="carte" aria-labelledby="t-rappel">
        <div className="carte-entete">
          <div>
            <h2 id="t-rappel" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icone nom="cloche" /> Message de rappel
            </h2>
            <p className="aide">
              Proposé dans les Tâches pour les rendez-vous des 48 heures à venir ; vous l’envoyez depuis votre
              messagerie.
            </p>
          </div>
        </div>
        <div className="carte-corps grille-modeles">
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="champ">
              <label htmlFor="ag-rappel">Texte (e-mail ou SMS)</label>
              <textarea
                id="ag-rappel"
                rows={5}
                maxLength={1000}
                value={modele}
                onChange={(e) => setModele(e.target.value)}
              />
              <span className="indication">Environ {apercuRappel.length} caractères une fois rempli.</span>
            </div>
            <div className="variables">
              <span className="etiquette">Variables</span>
              <ul>
                {VARIABLES_RAPPEL.map((v) => (
                  <li key={v.cle}>
                    <code>{v.cle}</code> {v.description}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <button
                type="button"
                className="bouton-lien"
                onClick={() => setModele(PARAMETRES_PAR_DEFAUT.modele_rappel)}
              >
                Revenir au texte d’origine
              </button>
            </div>
          </div>
          <div className="apercu-message">
            <span className="etiquette">Aperçu</span>
            <p className="message-envoye bulle-sms">{apercuRappel}</p>
          </div>
        </div>
      </section>

      {erreur && <Erreur message={erreur} />}
      <div className="actions">
        <button className="bouton bouton-principal" onClick={valider} disabled={!modifie}>
          <Icone nom="enregistrer" taille={16} /> Enregistrer
        </button>
      </div>
    </>
  );
}
