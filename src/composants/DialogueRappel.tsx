// Rappel de rendez-vous préparé « à la main » : le message est rédigé à
// partir du modèle (Paramètres > Emploi du temps), le thérapeute l'envoie
// depuis sa messagerie puis confirme.

import { useState } from 'react';
import { MODALITES } from '../config/agenda';
import { donnees } from '../donnees';
import { heureLisible, jourDe } from '../domaine/agenda';
import { messageErreur } from '../domaine/format';
import { lienMailto, lienSms, remplirModele } from '../domaine/messages';
import type { CanalEnvoi, ClientResume, RendezVous } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { useTherapeute } from '../etat/session';
import { Dialogue, Erreur, useNotifier } from './Commun';
import { Icone } from './Icone';

export function DialogueRappel({
  rdv,
  client,
  canal,
  fermer,
}: {
  rdv: RendezVous;
  client: Pick<ClientResume, 'prenom' | 'nom' | 'email' | 'telephone'>;
  canal: CanalEnvoi;
  /** `true` si le rappel a été marqué comme envoyé. */
  fermer: (envoye: boolean) => void;
}) {
  const t = useTherapeute();
  const { parametres: p } = useReglages();
  const notifier = useNotifier();
  const [erreur, setErreur] = useState<string | null>(null);
  const jour = new Date(`${jourDe(rdv.debut)}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const [corps, setCorps] = useState(() =>
    remplirModele(p.modele_rappel, {
      prenom: client.prenom,
      nom: client.nom,
      therapeute: `${t.prenom} ${t.nom}`.trim(),
      signature: p.signature,
      site: p.nom_site,
      date: jour,
      heure: heureLisible(rdv.debut),
      lieu: MODALITES[rdv.modalite].lieu,
    }),
  );
  const objet = `Rappel : rendez-vous du ${jour}`;
  const destinataire = canal === 'email' ? (client.email ?? '') : (client.telephone ?? '');

  async function marquer(message: string) {
    try {
      await donnees.modifierRendezVous(rdv.id, { rappel_envoye_le: new Date().toISOString() });
      notifier(message);
      fermer(true);
    } catch (e) {
      setErreur(messageErreur(e));
    }
  }

  return (
    <Dialogue
      ouvert
      fermer={() => fermer(false)}
      titre={`Rappel à ${client.prenom} ${client.nom}`}
      pied={
        <>
          <button className="bouton" onClick={() => fermer(false)}>
            Annuler
          </button>
          <button className="bouton bouton-principal" onClick={() => marquer('Rappel noté comme envoyé.')}>
            <Icone nom="valider" taille={16} /> J'ai envoyé le rappel
          </button>
        </>
      }
    >
      <p className="meta">
        {canal === 'email' ? 'E-mail' : 'SMS'} à <strong style={{ color: 'var(--encre)' }}>{destinataire}</strong>
      </p>
      <div className="champ">
        <label htmlFor="rappel-corps">Message</label>
        <textarea id="rappel-corps" rows={5} value={corps} onChange={(e) => setCorps(e.target.value)} />
        {canal === 'sms' && <span className="indication">{corps.length} caractères</span>}
      </div>
      <div className="actions">
        <a
          className="bouton bouton-doux"
          href={canal === 'email' ? lienMailto(destinataire, objet, corps) : lienSms(destinataire, corps)}
        >
          <Icone nom={canal === 'email' ? 'courriel' : 'sms'} taille={16} />
          {canal === 'email' ? 'Ouvrir dans ma messagerie' : 'Ouvrir dans Messages'}
        </a>
        <button
          className="bouton"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(canal === 'email' ? `${objet}\n\n${corps}` : corps);
              notifier('Message copié.');
            } catch {
              setErreur('Copie impossible : sélectionnez le texte à la main.');
            }
          }}
        >
          <Icone nom="copier" taille={16} /> Copier
        </button>
        <button className="bouton-lien" onClick={() => marquer('Rappel marqué comme inutile.')}>
          Pas besoin de rappel
        </button>
      </div>
      {erreur && <Erreur message={erreur} />}
    </Dialogue>
  );
}
