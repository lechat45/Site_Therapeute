// Préparer une relance « à la main » : l'application crée le lien
// personnel du questionnaire choisi et rédige le message à partir du
// modèle ; le thérapeute l'envoie depuis SA messagerie, puis confirme.
//
// Le lien ne devient actif qu'en quittant l'application (messagerie
// ouverte, message copié). Fermer sans confirmer après cela ne supprime
// plus rien d'office : on demande si le message est parti.

import { useEffect, useRef, useState } from 'react';
import { donnees } from '../donnees';
import {
  creneauxLibres,
  decalerJour,
  habitudesClient,
  heureLisible,
  horodatage,
  texteCreneaux,
} from '../domaine/agenda';
import { dateDuJour, dateLongue, messageErreur } from '../domaine/format';
import {
  insererAvantSignature,
  lienMailto,
  lienQuestionnaire,
  lienSms,
  masquerLien,
  remplirModele,
} from '../domaine/messages';
import type { CanalEnvoi, ClientResume, EnvoiPrepare, Questionnaire } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { useTherapeute } from '../etat/session';
import { useChargement } from '../etat/useChargement';
import { Dialogue, Erreur, useNotifier } from './Commun';
import { Icone } from './Icone';

type ClientEnvoi = Pick<ClientResume, 'id' | 'nom' | 'prenom' | 'email' | 'telephone'>;

export function DialogueEnvoi({
  client,
  canal,
  fermer,
}: {
  client: ClientEnvoi;
  canal: CanalEnvoi;
  /** `true` si l'envoi a été confirmé. */
  fermer: (envoye: boolean) => void;
}) {
  const liste = useChargement(() => donnees.questionnaires(), []);
  const [questionnaireId, setQuestionnaireId] = useState<string | null>(null);
  const questionnaires = (liste.donnees ?? []).filter((q) => q.questions.some((x) => x.active));
  const choisi = questionnaireId ?? questionnaires.find((q) => q.par_defaut)?.id ?? questionnaires[0]?.id ?? null;
  // Fermeture demandée par Échap : la rédaction décide (question si le lien est déjà sorti).
  const [demandeFermeture, setDemandeFermeture] = useState(0);

  return (
    <Dialogue
      ouvert
      fermer={() => (choisi ? setDemandeFermeture((n) => n + 1) : fermer(false))}
      titre={canal === 'email' ? `E-mail à ${client.prenom} ${client.nom}` : `SMS à ${client.prenom} ${client.nom}`}
      pied={null}
    >
      {liste.erreur && <Erreur message={liste.erreur} />}
      {questionnaires.length > 1 && (
        <div className="champ">
          <label htmlFor="env-questionnaire">Questionnaire envoyé</label>
          <select id="env-questionnaire" value={choisi ?? ''} onChange={(e) => setQuestionnaireId(e.target.value)}>
            {questionnaires.map((q) => (
              <option key={q.id} value={q.id}>
                {q.titre}
                {q.par_defaut ? ' (par défaut)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
      {liste.donnees && !choisi && (
        <Erreur message="Aucun questionnaire actif : créez-en un dans Paramètres > Questionnaires." />
      )}
      {/* Un lien par questionnaire : changer de questionnaire prépare un nouveau lien. */}
      {choisi && (
        <Redaction
          key={choisi}
          client={client}
          canal={canal}
          questionnaire={questionnaires.find((q) => q.id === choisi)!}
          fermer={fermer}
          demandeFermeture={demandeFermeture}
        />
      )}
    </Dialogue>
  );
}

function Redaction({
  client,
  canal,
  questionnaire,
  fermer,
  demandeFermeture,
}: {
  client: ClientEnvoi;
  canal: CanalEnvoi;
  questionnaire: Questionnaire;
  fermer: (envoye: boolean) => void;
  demandeFermeture: number;
}) {
  const t = useTherapeute();
  const { parametres: p } = useReglages();
  const notifier = useNotifier();
  const [prep, setPrep] = useState<EnvoiPrepare | null>(null);
  const [objet, setObjet] = useState('');
  const [corps, setCorps] = useState('');
  const [ouvertDansMessagerie, setOuvertDansMessagerie] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [questionSortie, setQuestionSortie] = useState(false);
  const [creneaux, setCreneaux] = useState<'aucun' | 'recherche' | 'ajoutes'>('aucun');
  const prepRef = useRef<EnvoiPrepare | null>(null);
  const confirmeRef = useRef(false);
  /** Le lien a quitté l'application : il est actif, on ne l'annule plus en silence. */
  const sortiRef = useRef(false);

  const lien = prep ? lienQuestionnaire(prep.jeton) : '';

  function marquerSorti() {
    setOuvertDansMessagerie(true);
    if (sortiRef.current || !prepRef.current) return;
    sortiRef.current = true;
    void donnees.marquerLienSorti(prepRef.current.id).catch(() => {});
  }

  /** Annuler : direct si le lien n'est jamais sorti, sinon on demande si le message est parti. */
  function quitter() {
    if (sortiRef.current && !confirmeRef.current) setQuestionSortie(true);
    else fermer(false);
  }
  useEffect(() => {
    if (demandeFermeture) quitter();
    // seule une nouvelle demande (Échap) doit déclencher la question
  }, [demandeFermeture]);

  useEffect(() => {
    let actif = true;
    donnees.preparerEnvoi(client.id, canal, questionnaire.id).then(
      (r) => {
        // Préparation devenue inutile (double montage, fermeture rapide) : on la retire.
        if (!actif) return void donnees.annulerEnvoi(r.id).catch(() => {});
        prepRef.current = r;
        setPrep(r);
        const vars = {
          prenom: client.prenom,
          nom: client.nom,
          therapeute: `${t.prenom} ${t.nom}`.trim(),
          signature: p.signature,
          lien: lienQuestionnaire(r.jeton),
          expiration: dateLongue(r.expire_le),
          site: p.nom_site,
        };
        setObjet(remplirModele(p.modele_email_objet, vars));
        setCorps(remplirModele(canal === 'email' ? p.modele_email : p.modele_sms, vars));
      },
      (e) => actif && setErreur(messageErreur(e)),
    );
    return () => {
      actif = false;
      // un lien jamais sorti de l'application est inutile ; un lien sorti est gardé
      if (prepRef.current && !confirmeRef.current && !sortiRef.current)
        void donnees.annulerEnvoi(prepRef.current.id).catch(() => {});
    };
    // Le message est rédigé une fois, à l'ouverture ; la clé du composant change avec le questionnaire.
  }, []);

  /**
   * Ajoute au message quelques créneaux libres des deux prochaines semaines
   * (emploi du temps), en commençant par les jours et heures habituels du
   * client (ses rendez-vous de l'année écoulée).
   */
  async function proposerCreneaux() {
    setCreneaux('recherche');
    try {
      const maintenant = new Date();
      const jour = dateDuJour(maintenant);
      const rdv = await donnees.listerRendezVous(
        horodatage(decalerJour(jour, -365), '00:00'),
        horodatage(decalerJour(jour, 16), '00:00'),
      );
      const habitudes = habitudesClient(rdv, client.id, maintenant);
      const libres = creneauxLibres(rdv, p, maintenant, { nombre: canal === 'sms' ? 3 : 6, habitudes });
      if (!libres.length) {
        notifier('Aucun créneau libre dans les deux prochaines semaines (voir Paramètres > Emploi du temps).', true);
        setCreneaux('aucun');
        return;
      }
      setCorps((c) => insererAvantSignature(c, texteCreneaux(libres), p.signature || `${t.prenom} ${t.nom}`.trim()));
      setCreneaux('ajoutes');
      const habituels = libres.filter((c) => c.habituel);
      notifier(
        habituels.length
          ? `${libres.length} créneaux libres ajoutés, dont ${habituels.length} à ses horaires habituels (${heureLisible(habituels[0].debut)}…) : relisez-les avant d'envoyer.`
          : `${libres.length} créneaux libres ajoutés au message : relisez-les avant d'envoyer.`,
      );
    } catch (e) {
      setErreur(messageErreur(e));
      setCreneaux('aucun');
    }
  }

  async function copier() {
    try {
      await navigator.clipboard.writeText(canal === 'email' ? `${objet}\n\n${corps}` : corps);
      notifier('Message copié.');
      marquerSorti();
    } catch {
      setErreur('Copie impossible : sélectionnez le texte à la main.');
    }
  }

  async function confirmer() {
    if (!prep) return;
    setConfirmation(true);
    try {
      await donnees.confirmerEnvoi(prep.id, canal === 'email' ? objet : '', masquerLien(corps, lien));
      confirmeRef.current = true;
      notifier(`Envoi à ${client.prenom} ${client.nom} enregistré.`);
      fermer(true);
    } catch (e) {
      setErreur(messageErreur(e));
      setConfirmation(false);
    }
  }

  const ouvrir =
    canal === 'email' ? lienMailto(prep?.destinataire ?? '', objet, corps) : lienSms(prep?.destinataire ?? '', corps);

  return (
    <>
      {erreur && <Erreur message={erreur} />}
      {!prep && !erreur && <p className="meta">Préparation du lien personnel…</p>}
      {prep && (
        <>
          <p className="meta">
            À : <strong style={{ color: 'var(--encre)' }}>{prep.destinataire}</strong> · « {questionnaire.titre} » ·
            lien valable jusqu'au {dateLongue(prep.expire_le)}
          </p>
          {canal === 'email' && (
            <div className="champ">
              <label htmlFor="env-objet">Objet</label>
              <input id="env-objet" value={objet} onChange={(e) => setObjet(e.target.value)} />
            </div>
          )}
          <div className="champ">
            <label htmlFor="env-corps">Message</label>
            <textarea
              id="env-corps"
              rows={canal === 'email' ? 11 : 5}
              value={corps}
              onChange={(e) => setCorps(e.target.value)}
            />
            {canal === 'sms' && <span className="indication">{corps.length} caractères</span>}
          </div>
          <div>
            <button
              type="button"
              className="bouton bouton-petit"
              onClick={proposerCreneaux}
              disabled={creneaux !== 'aucun'}
            >
              <Icone nom="calendrier" taille={14} />
              {creneaux === 'ajoutes'
                ? 'Créneaux ajoutés'
                : creneaux === 'recherche'
                  ? 'Recherche…'
                  : 'Proposer des créneaux libres'}
            </button>
          </div>
          <div className="actions">
            <a className="bouton bouton-doux" href={ouvrir} onClick={marquerSorti}>
              <Icone nom={canal === 'email' ? 'courriel' : 'sms'} taille={16} />
              {canal === 'email' ? 'Ouvrir dans ma messagerie' : 'Ouvrir dans Messages'}
            </a>
            <button className="bouton" onClick={copier}>
              <Icone nom="copier" taille={16} /> Copier le message
            </button>
            {donnees.mode === 'demo' && (
              <a className="bouton" href={lien} target="_blank" rel="noopener noreferrer" onClick={marquerSorti}>
                <Icone nom="questionnaire" taille={16} /> Tester le questionnaire
              </a>
            )}
          </div>
          <p className="meta">Le lien devient actif dès que le message quitte l'application (messagerie ou copie).</p>
          {ouvertDansMessagerie && (
            <div className="alerte" role="status">
              <Icone nom="info" />
              <span>
                Une fois le message parti, cliquez sur « J'ai envoyé le message » pour l'ajouter à l'historique.
              </span>
            </div>
          )}
          {donnees.mode === 'demo' && (
            <p className="meta">
              Mode démonstration : le lien ne fonctionne que dans ce navigateur, où sont stockées les données fictives.
            </p>
          )}
        </>
      )}
      {questionSortie ? (
        <div
          className="dialogue-pied dialogue-pied-integre question-sortie"
          role="alertdialog"
          aria-label="Le message est-il parti ?"
        >
          <p>
            <strong>Le message est-il parti ?</strong> Le lien est déjà actif : s'il a été envoyé, gardez-le pour que{' '}
            {client.prenom} puisse répondre.
          </p>
          <button className="bouton" onClick={() => setQuestionSortie(false)}>
            Retour
          </button>
          <button
            className="bouton bouton-danger"
            onClick={() => {
              sortiRef.current = false;
              if (prepRef.current) void donnees.annulerEnvoi(prepRef.current.id).catch(() => {});
              prepRef.current = null;
              fermer(false);
            }}
          >
            Non, annuler l'envoi
          </button>
          <button className="bouton bouton-principal" onClick={confirmer} disabled={!prep || confirmation}>
            <Icone nom="valider" taille={16} /> Oui, il est parti
          </button>
        </div>
      ) : (
        <div className="dialogue-pied dialogue-pied-integre">
          <button className="bouton" onClick={quitter}>
            Annuler
          </button>
          <button className="bouton bouton-principal" onClick={confirmer} disabled={!prep || confirmation}>
            <Icone nom="valider" taille={16} /> J'ai envoyé le message
          </button>
        </div>
      )}
    </>
  );
}
