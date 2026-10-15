// Paramètres > Affichage : couleur et nom du site, taille du texte, densité,
// mode daltonien, animations, page d'ouverture.

import { useEffect, useRef, useState } from 'react';
import { Erreur, useNotifier } from '../../composants/Commun';
import { Icone } from '../../composants/Icone';
import { PARAMETRES_PAR_DEFAUT } from '../../config/parametresDefaut';
import { messageErreur } from '../../domaine/format';
import type { Densite, PageAccueil, Parametres, TailleTexte, Vision } from '../../domaine/types';
import { appliquerTheme, contrasteAccent, COULEURS_PROPOSEES, useReglages } from '../../etat/reglages';

const TAILLES: { valeur: TailleTexte; libelle: string }[] = [
  { valeur: 'normal', libelle: 'Normal' },
  { valeur: 'grand', libelle: 'Grand' },
  { valeur: 'tres_grand', libelle: 'Très grand' },
];

const VISIONS: { valeur: Vision; libelle: string; detail: string }[] = [
  { valeur: 'standard', libelle: 'Standard', detail: 'Vert, orange et rouge pour les états.' },
  {
    valeur: 'rouge_vert',
    libelle: 'Daltonisme rouge-vert',
    detail: 'Protanopie, deutéranopie : bleu et orange à la place du vert et du rouge.',
  },
  {
    valeur: 'bleu_jaune',
    libelle: 'Daltonisme bleu-jaune',
    detail: 'Tritanopie : sarcelle et rouge-rose, sans bleu ni jaune à départager.',
  },
];

const ACCUEILS: { valeur: PageAccueil; libelle: string }[] = [
  { valeur: '/', libelle: 'Tableau de bord' },
  { valeur: '/clients', libelle: 'Clients' },
  { valeur: '/emploi-du-temps', libelle: 'Emploi du temps' },
  { valeur: '/taches', libelle: 'Tâches' },
];

/** Choix exclusif présenté en boutons (plus simple au doigt qu'une liste). */
function Segments<T extends string>({
  legende,
  options,
  valeur,
  changer,
}: {
  legende: string;
  options: { valeur: T; libelle: string }[];
  valeur: T;
  changer: (v: T) => void;
}) {
  return (
    <fieldset className="champ segments-champ">
      <legend className="etiquette">{legende}</legend>
      <div className="segments" role="radiogroup" aria-label={legende}>
        {options.map((o) => (
          <button
            key={o.valeur}
            type="button"
            role="radio"
            aria-checked={valeur === o.valeur}
            className="segment"
            onClick={() => changer(o.valeur)}
          >
            {o.libelle}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function OngletAffichage() {
  return (
    <>
      <Theme />
      <Confort />
    </>
  );
}

function Theme() {
  const { parametres, enregistrer } = useReglages();
  const notifier = useNotifier();
  const [nomSite, setNomSite] = useState(parametres.nom_site);
  const [couleur, setCouleur] = useState(parametres.couleur);
  const [erreur, setErreur] = useState<string | null>(null);
  const contraste = contrasteAccent(couleur);
  const modifie = nomSite !== parametres.nom_site || couleur !== parametres.couleur;

  // Aperçu en direct ; en quittant l'onglet, on revient au thème enregistré.
  const enregistre = useRef(parametres);
  enregistre.current = parametres;
  useEffect(() => {
    appliquerTheme(couleur, nomSite.trim() || parametres.nom_site, false);
  }, [couleur, nomSite, parametres.nom_site]);
  useEffect(() => () => appliquerTheme(enregistre.current.couleur, enregistre.current.nom_site, false), []);

  async function valider() {
    setErreur(null);
    try {
      await enregistrer({ nom_site: nomSite.trim(), couleur });
      notifier('Apparence enregistrée.');
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  return (
    <section className="carte" aria-labelledby="t-apparence">
      <div className="carte-entete">
        <div>
          <h2 id="t-apparence" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="palette" /> Nom et couleur du site
          </h2>
          <p className="aide">
            Le nom et la couleur s'appliquent à votre espace, à vos messages et au questionnaire envoyé aux clients.
          </p>
        </div>
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 18 }}>
        <div className="champ" style={{ maxWidth: 420 }}>
          <label htmlFor="a-nom">Nom du site</label>
          <input id="a-nom" maxLength={60} value={nomSite} onChange={(e) => setNomSite(e.target.value)} />
          <span className="indication">Affiché dans le menu, l'onglet du navigateur et le questionnaire.</span>
        </div>

        <fieldset className="champ" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="etiquette">Couleur principale</legend>
          <div className="nuancier">
            {COULEURS_PROPOSEES.map((c) => (
              <button
                key={c.valeur}
                type="button"
                className="pastille-couleur"
                style={{ background: c.valeur }}
                aria-pressed={couleur === c.valeur}
                aria-label={c.nom}
                title={c.nom}
                onClick={() => setCouleur(c.valeur)}
              >
                {couleur === c.valeur && <Icone nom="valider" taille={18} />}
              </button>
            ))}
            <label className="couleur-libre">
              <input type="color" value={couleur} onChange={(e) => setCouleur(e.target.value.toLowerCase())} />
              Autre couleur
            </label>
          </div>
          {contraste < 4.5 && (
            <p className="alerte" role="status" style={{ marginTop: 8 }}>
              <Icone nom="info" /> Couleur trop claire : le texte des boutons serait difficile à lire (contraste{' '}
              {contraste.toFixed(1).replace('.', ',')}:1, il faut au moins 4,5:1). Choisissez une teinte plus foncée.
            </p>
          )}
        </fieldset>

        <div className="apercu-theme" aria-label="Aperçu">
          <span className="apercu-barre">
            <span className="marque-pastille" /> {nomSite || '…'}
          </span>
          <div className="apercu-contenu">
            <button type="button" className="bouton bouton-principal" tabIndex={-1}>
              Bouton principal
            </button>
            <span className="puce">Problématique</span>
            <a href="#apparence" onClick={(e) => e.preventDefault()} tabIndex={-1}>
              Un lien
            </a>
            <span className="mini-piste" style={{ width: 120 }}>
              <span style={{ width: '65%' }} />
            </span>
          </div>
        </div>

        {erreur && <Erreur message={erreur} />}
        <div className="actions">
          <button
            className="bouton bouton-principal"
            onClick={valider}
            disabled={!modifie || contraste < 4.5 || !nomSite.trim()}
          >
            Enregistrer
          </button>
          <button
            className="bouton"
            onClick={() => {
              setNomSite(PARAMETRES_PAR_DEFAUT.nom_site);
              setCouleur(PARAMETRES_PAR_DEFAUT.couleur);
            }}
          >
            Revenir au violet d'origine
          </button>
        </div>
      </div>
    </section>
  );
}

/** Préférences de confort : enregistrées dès qu'on les change (effet immédiat). */
function Confort() {
  const { parametres, enregistrer } = useReglages();
  const notifier = useNotifier();

  async function changer(champs: Partial<Parametres>) {
    try {
      await enregistrer(champs);
    } catch (err) {
      notifier(messageErreur(err), true);
    }
  }

  return (
    <section className="carte" aria-labelledby="t-confort">
      <div className="carte-entete">
        <div>
          <h2 id="t-confort" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Icone nom="utilisateur" /> Confort de lecture
          </h2>
          <p className="aide">Appliqué tout de suite, et mémorisé pour votre compte.</p>
        </div>
      </div>
      <div className="carte-corps" style={{ display: 'grid', gap: 20 }}>
        <fieldset className="champ segments-champ">
          <legend className="etiquette">Vision des couleurs</legend>
          <div className="choix-vision" role="radiogroup" aria-label="Vision des couleurs">
            {VISIONS.map((v) => (
              <button
                key={v.valeur}
                type="button"
                role="radio"
                aria-checked={parametres.vision === v.valeur}
                className="choix-vision-carte"
                data-apercu={v.valeur}
                onClick={() => changer({ vision: v.valeur })}
              >
                <span className="choix-vision-pastilles" aria-hidden>
                  <span className="pastille-etat etat-succes" />
                  <span className="pastille-etat etat-alerte" />
                  <span className="pastille-etat etat-danger" />
                </span>
                <strong>{v.libelle}</strong>
                <span className="meta">{v.detail}</span>
              </button>
            ))}
          </div>
          <span className="indication">
            Quel que soit le choix, les états restent aussi signalés par un pictogramme et un libellé, jamais par la
            seule couleur.
          </span>
        </fieldset>

        <Segments
          legende="Taille du texte"
          options={TAILLES}
          valeur={parametres.taille_texte}
          changer={(taille_texte) => changer({ taille_texte })}
        />
        <Segments<Densite>
          legende="Densité"
          options={[
            { valeur: 'confortable', libelle: 'Confortable' },
            { valeur: 'compacte', libelle: 'Compacte' },
          ]}
          valeur={parametres.densite}
          changer={(densite) => changer({ densite })}
        />
        <Segments
          legende="Page d'ouverture après connexion"
          options={ACCUEILS}
          valeur={parametres.page_accueil}
          changer={(page_accueil) => changer({ page_accueil })}
        />

        <label className="interrupteur">
          <input
            type="checkbox"
            checked={parametres.reduire_animations}
            onChange={(e) => changer({ reduire_animations: e.target.checked })}
          />
          <span>
            <strong>Réduire les animations</strong>
            <span className="meta"> — transitions et défilements instantanés.</span>
          </span>
        </label>
      </div>
    </section>
  );
}
