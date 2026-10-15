// Questionnaires de suivi : plusieurs questionnaires par thérapeute, sept
// types de questions, bibliothèque de questions prêtes et aperçu en direct.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import { Chargement, Dialogue, Erreur, useNotifier } from '../../composants/Commun';
import { Icone } from '../../composants/Icone';
import { BIBLIOTHEQUE_QUESTIONS } from '../../config/parametresDefaut';
import { donnees } from '../../donnees';
import { messageErreur } from '../../domaine/format';
import type { Question, Questionnaire, TypeQuestion, ValeurReponse } from '../../domaine/types';
import { useTherapeute } from '../../etat/session';
import { useChargement } from '../../etat/useChargement';
import { QuestionPublique } from '../QuestionnairePublic';

type NouvelleQuestion = Omit<Question, 'id'> & { id?: string };
type Ligne = NouvelleQuestion & { cle: string };
interface Brouillon {
  id: string;
  titre: string;
  introduction: string;
  remerciement: string;
  lignes: Ligne[];
}

export const TYPES_QUESTION: { valeur: TypeQuestion; libelle: string; detail: string }[] = [
  { valeur: 'curseur', libelle: 'Curseur', detail: 'Une valeur sur une échelle (0 à 10 par défaut).' },
  { valeur: 'etoiles', libelle: 'Étoiles', detail: 'Une note de 1 à 5 étoiles (jusqu’à 10).' },
  { valeur: 'choix_unique', libelle: 'Choix unique', detail: 'Une seule réponse parmi celles que vous proposez.' },
  { valeur: 'choix_multiple', libelle: 'Choix multiples', detail: 'Plusieurs réponses possibles.' },
  { valeur: 'oui_non', libelle: 'Oui / non', detail: 'Deux gros boutons.' },
  { valeur: 'emotions', libelle: 'Émotions', detail: 'Le client coche parmi les 14 émotions de la fiche.' },
  { valeur: 'texte', libelle: 'Texte libre', detail: 'Réponse rédigée (2 000 caractères au plus).' },
];
const libelleType = (t: TypeQuestion) => TYPES_QUESTION.find((x) => x.valeur === t)!.libelle;
const estChoix = (t: TypeQuestion) => t === 'choix_unique' || t === 'choix_multiple';
const OPTIONS_MAX = 12;

function questionVide(type: TypeQuestion): NouvelleQuestion {
  return {
    ordre: 0,
    libelle: '',
    type,
    aide: '',
    obligatoire: type !== 'texte',
    options: estChoix(type) ? ['', ''] : [],
    minimum: type === 'etoiles' ? 1 : 0,
    maximum: type === 'etoiles' ? 5 : 10,
    sens: 'haut',
    libelle_min: '',
    libelle_max: '',
    active: true,
  };
}

const versLigne = (q: NouvelleQuestion): Ligne => ({ ...q, options: [...q.options], cle: q.id ?? crypto.randomUUID() });

const versBrouillon = (q: Questionnaire): Brouillon => ({
  id: q.id,
  titre: q.titre,
  introduction: q.introduction,
  remerciement: q.remerciement,
  lignes: q.questions.map(versLigne),
});

/** Empreinte comparable (sans clés techniques ni ordre stocké). */
const empreinte = (b: Brouillon) => JSON.stringify({ ...b, lignes: b.lignes.map(({ cle: _c, ordre: _o, ...l }) => l) });

/** Changer de type garde l'intitulé, l'aide et ce qui reste pertinent. */
function changerType(l: Ligne, type: TypeQuestion): Ligne {
  const vide = questionVide(type);
  return {
    ...l,
    type,
    options: estChoix(type) ? (estChoix(l.type) ? l.options : vide.options) : [],
    minimum: type === 'curseur' && l.type === 'curseur' ? l.minimum : vide.minimum,
    maximum: type === l.type ? l.maximum : vide.maximum,
    libelle_min: type === 'curseur' ? l.libelle_min : '',
    libelle_max: type === 'curseur' ? l.libelle_max : '',
    sens: type === 'curseur' ? l.sens : 'haut',
  };
}

/** Mêmes règles que la base (contraintes de la table `questions`). */
function probleme(l: Ligne): string | null {
  if (!l.libelle.trim()) return "Écrivez l'intitulé de la question.";
  if (l.type === 'curseur') {
    if (![l.minimum, l.maximum].every(Number.isInteger) || l.minimum < 0 || l.maximum > 100)
      return 'Les bornes du curseur vont de 0 à 100.';
    if (l.minimum >= l.maximum) return 'Le minimum doit être inférieur au maximum.';
  }
  if (estChoix(l.type)) {
    const options = l.options.map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) return 'Proposez au moins deux réponses.';
    if (new Set(options.map((o) => o.toLowerCase())).size !== options.length) return 'Deux réponses sont identiques.';
  }
  return null;
}

// ---------------------------------------------------------------------
export function OngletQuestionnaires() {
  const charge = useChargement(() => donnees.questionnaires(), []);
  if (!charge.donnees && charge.erreur) return <Erreur message={charge.erreur} reessayer={charge.recharger} />;
  if (!charge.donnees) return <Chargement />;
  return <Gestion questionnaires={charge.donnees} remplacer={charge.remplacer} />;
}

function Gestion({
  questionnaires,
  remplacer,
}: {
  questionnaires: Questionnaire[];
  remplacer: (q: Questionnaire[]) => void;
}) {
  const notifier = useNotifier();
  const parDefaut = questionnaires.find((q) => q.par_defaut) ?? questionnaires[0];
  const [selection, setSelection] = useState<string | null>(parDefaut?.id ?? null);
  const [modifie, setModifie] = useState(false);
  const [aOuvrir, setAOuvrir] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<Questionnaire | null>(null);
  const courant = questionnaires.find((q) => q.id === selection) ?? parDefaut ?? null;

  // Garde-fous contre la perte de saisie (y compris le changement d'onglet).
  useEffect(() => {
    if (!modifie) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [modifie]);
  const blocage = useBlocker(
    ({ currentLocation: a, nextLocation: b }) => modifie && (a.pathname !== b.pathname || a.search !== b.search),
  );

  async function rafraichir(choisir?: string) {
    remplacer(await donnees.questionnaires());
    if (choisir) setSelection(choisir);
  }

  function ouvrir(id: string) {
    if (id === courant?.id) return;
    if (modifie) setAOuvrir(id);
    else setSelection(id);
  }

  async function creer(modele?: Questionnaire) {
    try {
      const q = await donnees.enregistrerQuestionnaire(
        modele
          ? {
              titre: `${modele.titre} (copie)`.slice(0, 120),
              introduction: modele.introduction,
              remerciement: modele.remerciement,
              questions: modele.questions.map(({ id: _, ...q }) => q),
            }
          : {
              titre: 'Nouveau questionnaire',
              introduction: '',
              remerciement: 'Merci ! Vos réponses ont bien été transmises.',
              questions: [
                {
                  ...questionVide('curseur'),
                  libelle: 'Comment vous sentez-vous en ce moment ?',
                  libelle_min: 'Très mal',
                  libelle_max: 'Très bien',
                },
              ],
            },
      );
      await rafraichir(q.id);
      notifier(modele ? 'Copie créée.' : 'Questionnaire créé : personnalisez-le ci-dessous.');
    } catch (err) {
      notifier(messageErreur(err), true);
    }
  }

  async function rendreParDefaut(q: Questionnaire) {
    try {
      await donnees.definirQuestionnaireParDefaut(q.id);
      await rafraichir();
      notifier(`« ${q.titre} » sera proposé par défaut pour les relances.`);
    } catch (err) {
      notifier(messageErreur(err), true);
    }
  }

  async function supprimer(q: Questionnaire) {
    setASupprimer(null);
    try {
      await donnees.supprimerQuestionnaire(q.id);
      setModifie(false);
      await rafraichir(parDefaut?.id);
      notifier('Questionnaire supprimé. Les réponses déjà reçues sont conservées.');
    } catch (err) {
      notifier(messageErreur(err), true);
    }
  }

  const rester = () => {
    blocage.reset?.();
    setAOuvrir(null);
  };
  const abandonner = () => {
    if (blocage.state === 'blocked') return blocage.proceed();
    setModifie(false);
    if (aOuvrir) setSelection(aOuvrir);
    setAOuvrir(null);
  };

  return (
    <>
      <section className="carte" aria-labelledby="t-questionnaires">
        <div className="carte-entete">
          <div>
            <h2 id="t-questionnaires" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Icone nom="questionnaire" /> Mes questionnaires
            </h2>
            <p className="aide">
              Celui « par défaut » est proposé à chaque relance ; vous pouvez en choisir un autre au moment d'envoyer.
            </p>
          </div>
          <button
            className="bouton bouton-principal"
            onClick={() => creer()}
            disabled={modifie}
            title={modifie ? "Enregistrez d'abord le questionnaire en cours" : undefined}
          >
            <Icone nom="plus" taille={16} /> Nouveau questionnaire
          </button>
        </div>
        <div className="carte-corps">
          <ul className="liste-questionnaires">
            {questionnaires.map((q) => {
              const actives = q.questions.filter((x) => x.active).length;
              return (
                <li key={q.id}>
                  <button
                    className="questionnaire-ligne"
                    aria-current={q.id === courant?.id ? 'true' : undefined}
                    onClick={() => ouvrir(q.id)}
                  >
                    <strong>{q.titre}</strong>
                    <span className="meta">
                      {actives} question{actives > 1 ? 's' : ''}
                    </span>
                    {q.par_defaut && (
                      <span className="puce puce-succes">
                        <Icone nom="valider" taille={13} /> Par défaut
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {courant && (
        <Editeur
          key={courant.id}
          questionnaire={courant}
          signalerModif={setModifie}
          enregistre={(q) => remplacer(questionnaires.map((x) => (x.id === q.id ? q : x)))}
          actions={
            <>
              <button className="bouton bouton-petit" onClick={() => creer(courant)} disabled={modifie}>
                <Icone nom="copier" taille={15} /> Dupliquer
              </button>
              {!courant.par_defaut && (
                <button className="bouton bouton-petit" onClick={() => rendreParDefaut(courant)} disabled={modifie}>
                  <Icone nom="valider" taille={15} /> Utiliser par défaut
                </button>
              )}
              {!courant.par_defaut && (
                <button className="bouton bouton-petit bouton-danger" onClick={() => setASupprimer(courant)}>
                  <Icone nom="corbeille" taille={15} /> Supprimer
                </button>
              )}
            </>
          }
        />
      )}

      <Dialogue
        ouvert={blocage.state === 'blocked' || aOuvrir !== null}
        fermer={rester}
        titre="Modifications non enregistrées"
        pied={
          <>
            <button className="bouton" onClick={rester}>
              Continuer la modification
            </button>
            <button className="bouton bouton-danger" onClick={abandonner}>
              Abandonner les modifications
            </button>
          </>
        }
      >
        <p>Le questionnaire « {courant?.titre} » a été modifié sans être enregistré.</p>
      </Dialogue>

      <Dialogue
        ouvert={aSupprimer !== null}
        fermer={() => setASupprimer(null)}
        titre="Supprimer ce questionnaire ?"
        pied={
          <>
            <button className="bouton" onClick={() => setASupprimer(null)}>
              Annuler
            </button>
            <button className="bouton bouton-danger" onClick={() => aSupprimer && supprimer(aSupprimer)}>
              Supprimer
            </button>
          </>
        }
      >
        <p>
          « {aSupprimer?.titre} » ne pourra plus être envoyé. Les questionnaires déjà envoyés et les réponses reçues
          sont conservés.
        </p>
      </Dialogue>
    </>
  );
}

// ---------------------------------------------------------------------
function Editeur({
  questionnaire,
  signalerModif,
  enregistre,
  actions,
}: {
  questionnaire: Questionnaire;
  signalerModif: (m: boolean) => void;
  enregistre: (q: Questionnaire) => void;
  actions: ReactNode;
}) {
  const notifier = useNotifier();
  const t = useTherapeute();
  const [b, setB] = useState<Brouillon>(() => versBrouillon(questionnaire));
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [bibliotheque, setBibliotheque] = useState(false);
  const [apercu, setApercu] = useState<Record<string, ValeurReponse>>({});

  const reference = useMemo(() => empreinte(versBrouillon(questionnaire)), [questionnaire]);
  const modifie = empreinte(b) !== reference;
  useEffect(() => signalerModif(modifie), [modifie, signalerModif]);
  useEffect(() => () => signalerModif(false), [signalerModif]);

  const maj = (cle: string, champs: Partial<Ligne>) => {
    setB((x) => ({ ...x, lignes: x.lignes.map((l) => (l.cle === cle ? { ...l, ...champs } : l)) }));
    setErreurs((e) => {
      if (!e[cle]) return e;
      const { [cle]: _, ...reste } = e;
      return reste;
    });
  };
  const remplacerLigne = (cle: string, f: (l: Ligne) => Ligne) =>
    setB((x) => ({ ...x, lignes: x.lignes.map((l) => (l.cle === cle ? f(l) : l)) }));
  const deplacer = (i: number, d: number) =>
    setB((x) => {
      const s = [...x.lignes];
      [s[i], s[i + d]] = [s[i + d], s[i]];
      return { ...x, lignes: s };
    });
  const ajouter = (q: NouvelleQuestion, apres?: number) => {
    const l = versLigne({ ...q, id: undefined });
    setB((x) => {
      const s = [...x.lignes];
      s.splice(apres === undefined ? s.length : apres + 1, 0, l);
      return { ...x, lignes: s };
    });
    // place le curseur dans l'intitulé de la nouvelle question
    setTimeout(() => document.getElementById(`libelle-${l.cle}`)?.focus(), 50);
  };

  async function valider() {
    setErreur(null);
    const e: Record<string, string> = {};
    for (const l of b.lignes) {
      const p = probleme(l);
      if (p) e[l.cle] = p;
    }
    setErreurs(e);
    if (!b.titre.trim()) return setErreur('Donnez un titre au questionnaire.');
    if (!b.lignes.some((l) => l.active)) return setErreur('Gardez au moins une question active.');
    const premiere = b.lignes.find((l) => e[l.cle]);
    if (premiere) {
      document.getElementById(`editeur-${premiere.cle}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return setErreur('Corrigez les questions signalées en rouge.');
    }
    setEnCours(true);
    try {
      const q = await donnees.enregistrerQuestionnaire({
        id: b.id,
        titre: b.titre.trim(),
        introduction: b.introduction.trim(),
        remerciement: b.remerciement.trim(),
        questions: b.lignes.map(({ cle: _, ...l }, i) => ({
          ...l,
          ordre: i + 1,
          libelle: l.libelle.trim(),
          aide: l.aide.trim(),
          libelle_min: l.libelle_min.trim(),
          libelle_max: l.libelle_max.trim(),
          options: estChoix(l.type) ? l.options.map((o) => o.trim()).filter(Boolean) : [],
        })),
      });
      setB(versBrouillon(q));
      enregistre(q);
      notifier('Questionnaire enregistré.');
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnCours(false);
    }
  }

  const actives = b.lignes.filter((l) => l.active && l.libelle.trim());
  const libellesPresents = new Set(b.lignes.map((l) => l.libelle.trim()));

  return (
    <div className="grille-questionnaire">
      <section className="carte" aria-labelledby="t-editeur">
        <div className="carte-entete">
          <div>
            <h2 id="t-editeur">Modifier « {questionnaire.titre} »</h2>
            <p className="aide">
              Conseil : 5 à 8 questions. Les questionnaires déjà envoyés gardent leurs questions d'origine.
            </p>
          </div>
          <div className="actions">{actions}</div>
        </div>
        <div className="carte-corps" style={{ display: 'grid', gap: 14 }}>
          <div className="champ">
            <label htmlFor="qr-titre">Titre</label>
            <input
              id="qr-titre"
              maxLength={120}
              value={b.titre}
              onChange={(e) => setB({ ...b, titre: e.target.value })}
            />
          </div>
          <div className="champ">
            <label htmlFor="qr-intro">Introduction</label>
            <textarea
              id="qr-intro"
              rows={2}
              maxLength={1000}
              placeholder="Quelques mots d'accueil, affichés en haut du questionnaire."
              value={b.introduction}
              onChange={(e) => setB({ ...b, introduction: e.target.value })}
            />
          </div>
          <div className="champ">
            <label htmlFor="qr-merci">Message de remerciement</label>
            <textarea
              id="qr-merci"
              rows={2}
              maxLength={500}
              placeholder="Affiché une fois les réponses envoyées."
              value={b.remerciement}
              onChange={(e) => setB({ ...b, remerciement: e.target.value })}
            />
          </div>

          <h3 style={{ marginTop: 6 }}>Questions</h3>
          {b.lignes.map((l, i) => (
            <EditeurQuestion
              key={l.cle}
              ligne={l}
              numero={i + 1}
              total={b.lignes.length}
              erreur={erreurs[l.cle]}
              maj={(champs) => maj(l.cle, champs)}
              changerType={(type) => remplacerLigne(l.cle, (x) => changerType(x, type))}
              deplacer={(d) => deplacer(i, d)}
              dupliquer={() => ajouter({ ...l, libelle: `${l.libelle} (copie)`.slice(0, 300) }, i)}
              supprimer={() => setB((x) => ({ ...x, lignes: x.lignes.filter((y) => y.cle !== l.cle) }))}
            />
          ))}

          <div className="ajout-question">
            <span className="etiquette">Ajouter une question :</span>
            <div className="actions">
              {TYPES_QUESTION.map((ty) => (
                <button
                  key={ty.valeur}
                  className="bouton bouton-doux bouton-petit"
                  title={ty.detail}
                  onClick={() => ajouter(questionVide(ty.valeur))}
                >
                  <Icone nom="plus" taille={14} /> {ty.libelle}
                </button>
              ))}
            </div>
            <button className="bouton bouton-petit" onClick={() => setBibliotheque(true)}>
              <Icone nom="document" taille={15} /> Choisir dans la bibliothèque
            </button>
          </div>

          {erreur && <Erreur message={erreur} />}
          <div className="actions barre-enregistrer">
            <button className="bouton bouton-principal" onClick={valider} disabled={!modifie || enCours}>
              <Icone nom="enregistrer" taille={16} /> {enCours ? 'Enregistrement…' : 'Enregistrer le questionnaire'}
            </button>
            {modifie && (
              <button
                className="bouton"
                onClick={() => (setB(versBrouillon(questionnaire)), setErreurs({}), setErreur(null))}
              >
                Annuler les modifications
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="carte apercu-questionnaire" aria-labelledby="t-apercu">
        <div className="carte-entete">
          <div>
            <h2 id="t-apercu">Aperçu</h2>
            <p className="aide">Ce que voit votre client. Vous pouvez essayer de répondre.</p>
          </div>
        </div>
        <div className="carte-corps" style={{ display: 'grid', gap: 18 }}>
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>{b.titre || 'Sans titre'}</h3>
            <p className="meta" style={{ marginTop: 4, whiteSpace: 'pre-line' }}>
              Proposé par{' '}
              <strong>
                {t.prenom} {t.nom}
              </strong>
              . {b.introduction}
            </p>
          </div>
          {actives.length === 0 && <p className="meta">Aucune question active.</p>}
          {actives.map((l, i) => (
            <QuestionPublique
              key={l.cle}
              numero={i + 1}
              question={{ ...l, id: l.cle, options: l.options.map((o) => o.trim()).filter(Boolean) }}
              valeur={apercu[l.cle] ?? null}
              changer={(v) => setApercu((a) => ({ ...a, [l.cle]: v }))}
            />
          ))}
          {b.remerciement.trim() && (
            <p className="apercu-merci">
              <Icone nom="valider" taille={16} /> Après l'envoi : « {b.remerciement.trim()} »
            </p>
          )}
        </div>
      </section>

      <Dialogue
        ouvert={bibliotheque}
        fermer={() => setBibliotheque(false)}
        titre="Bibliothèque de questions"
        pied={
          <button className="bouton" onClick={() => setBibliotheque(false)}>
            Fermer
          </button>
        }
      >
        <ul className="bibliotheque">
          {BIBLIOTHEQUE_QUESTIONS.map((q) => {
            const deja = libellesPresents.has(q.libelle);
            return (
              <li key={q.libelle}>
                <div>
                  <p>{q.libelle}</p>
                  <span className="meta">
                    {libelleType(q.type)}
                    {estChoix(q.type) && ` · ${q.options.join(' / ')}`}
                  </span>
                </div>
                <button
                  className="bouton bouton-petit"
                  disabled={deja}
                  onClick={() => {
                    ajouter(q);
                    notifier('Question ajoutée en fin de questionnaire.');
                  }}
                >
                  {deja ? 'Déjà présente' : 'Ajouter'}
                </button>
              </li>
            );
          })}
        </ul>
      </Dialogue>
    </div>
  );
}

function EditeurQuestion({
  ligne: l,
  numero,
  total,
  erreur,
  maj,
  changerType,
  deplacer,
  dupliquer,
  supprimer,
}: {
  ligne: Ligne;
  numero: number;
  total: number;
  erreur?: string;
  maj: (champs: Partial<Ligne>) => void;
  changerType: (t: TypeQuestion) => void;
  deplacer: (d: number) => void;
  dupliquer: () => void;
  supprimer: () => void;
}) {
  const id = (x: string) => `${x}-${l.cle}`;
  const detail = TYPES_QUESTION.find((x) => x.valeur === l.type)!.detail;
  return (
    <div
      id={id('editeur')}
      className={`question-editeur${l.active ? '' : ' question-inactive'}${erreur ? ' question-en-defaut' : ''}`}
    >
      <div className="question-editeur-tete">
        <span className="numero-question">{numero}</span>
        <select
          aria-label={`Type de la question ${numero}`}
          value={l.type}
          onChange={(e) => changerType(e.target.value as TypeQuestion)}
        >
          {TYPES_QUESTION.map((t) => (
            <option key={t.valeur} value={t.valeur}>
              {t.libelle}
            </option>
          ))}
        </select>
        <span className="pile-actions">
          <button
            className="bouton bouton-icone"
            aria-label={`Monter la question ${numero}`}
            disabled={numero === 1}
            onClick={() => deplacer(-1)}
          >
            <Icone nom="haut" taille={15} />
          </button>
          <button
            className="bouton bouton-icone"
            aria-label={`Descendre la question ${numero}`}
            disabled={numero === total}
            onClick={() => deplacer(1)}
          >
            <Icone nom="bas" taille={15} />
          </button>
          <button className="bouton bouton-icone" aria-label={`Dupliquer la question ${numero}`} onClick={dupliquer}>
            <Icone nom="copier" taille={15} />
          </button>
          <button
            className="bouton bouton-icone bouton-danger"
            aria-label={`Supprimer la question ${numero}`}
            onClick={supprimer}
          >
            <Icone nom="corbeille" taille={15} />
          </button>
        </span>
      </div>
      <span className="indication">{detail}</span>

      <textarea
        id={id('libelle')}
        aria-label={`Intitulé de la question ${numero}`}
        rows={2}
        maxLength={300}
        placeholder="Intitulé de la question"
        value={l.libelle}
        onChange={(e) => maj({ libelle: e.target.value })}
      />
      <input
        aria-label={`Texte d'aide de la question ${numero}`}
        maxLength={300}
        placeholder="Texte d'aide sous la question (facultatif)"
        value={l.aide}
        onChange={(e) => maj({ aide: e.target.value })}
      />

      {l.type === 'curseur' && (
        <div className="grille-reglages">
          <div className="champ">
            <label htmlFor={id('min')}>De</label>
            <input
              id={id('min')}
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              value={l.minimum}
              onChange={(e) => maj({ minimum: Math.round(Number(e.target.value)) })}
            />
          </div>
          <div className="champ">
            <label htmlFor={id('max')}>À</label>
            <input
              id={id('max')}
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={l.maximum}
              onChange={(e) => maj({ maximum: Math.round(Number(e.target.value)) })}
            />
          </div>
          <div className="champ">
            <label htmlFor={id('lmin')}>Repère du bas</label>
            <input
              id={id('lmin')}
              maxLength={40}
              placeholder="ex. Très mal"
              value={l.libelle_min}
              onChange={(e) => maj({ libelle_min: e.target.value })}
            />
          </div>
          <div className="champ">
            <label htmlFor={id('lmax')}>Repère du haut</label>
            <input
              id={id('lmax')}
              maxLength={40}
              placeholder="ex. Très bien"
              value={l.libelle_max}
              onChange={(e) => maj({ libelle_max: e.target.value })}
            />
          </div>
          <div className="champ" style={{ gridColumn: '1 / -1' }}>
            <label htmlFor={id('sens')}>Lecture des réponses</label>
            <select id={id('sens')} value={l.sens} onChange={(e) => maj({ sens: e.target.value as 'haut' | 'bas' })}>
              <option value="haut">Plus la valeur est haute, mieux c'est (ex. bien-être)</option>
              <option value="bas">Plus la valeur est basse, mieux c'est (ex. stress, douleur)</option>
            </select>
            <span className="indication">Sert à repérer une amélioration ou une dégradation dans l'onglet Tâches.</span>
          </div>
        </div>
      )}

      {l.type === 'etoiles' && (
        <div className="champ" style={{ maxWidth: 220 }}>
          <label htmlFor={id('etoiles')}>Nombre d'étoiles</label>
          <select id={id('etoiles')} value={l.maximum} onChange={(e) => maj({ maximum: Number(e.target.value) })}>
            {[3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
              <option key={n} value={n}>
                {n} étoiles
              </option>
            ))}
          </select>
        </div>
      )}

      {estChoix(l.type) && (
        <div className="options-editeur" role="group" aria-label={`Réponses proposées pour la question ${numero}`}>
          {l.options.map((o, j) => (
            <div key={j} className="option-ligne">
              <span className={`marque-option ${l.type === 'choix_unique' ? 'rond' : 'carre'}`} aria-hidden />
              <input
                aria-label={`Réponse ${j + 1}`}
                maxLength={100}
                placeholder={`Réponse ${j + 1}`}
                value={o}
                onChange={(e) => maj({ options: l.options.map((x, k) => (k === j ? e.target.value : x)) })}
              />
              <button
                className="bouton bouton-icone"
                aria-label={`Retirer la réponse ${j + 1}`}
                disabled={l.options.length <= 2}
                onClick={() => maj({ options: l.options.filter((_, k) => k !== j) })}
              >
                <Icone nom="croix" taille={14} />
              </button>
            </div>
          ))}
          <div>
            <button
              className="bouton bouton-petit"
              disabled={l.options.length >= OPTIONS_MAX}
              onClick={() => maj({ options: [...l.options, ''] })}
            >
              <Icone nom="plus" taille={14} /> Ajouter une réponse
            </button>
            {l.options.length >= OPTIONS_MAX && <span className="meta"> ({OPTIONS_MAX} au plus)</span>}
          </div>
        </div>
      )}

      <div className="question-editeur-options">
        <label className="interrupteur interrupteur-petit">
          <input type="checkbox" checked={l.obligatoire} onChange={(e) => maj({ obligatoire: e.target.checked })} />
          <span>Réponse obligatoire</span>
        </label>
        <label className="interrupteur interrupteur-petit">
          <input type="checkbox" checked={l.active} onChange={(e) => maj({ active: e.target.checked })} />
          <span>Question active</span>
        </label>
      </div>
      {erreur && (
        <p className="erreur-champ" role="alert">
          <Icone nom="info" taille={15} /> {erreur}
        </p>
      )}
    </div>
  );
}
