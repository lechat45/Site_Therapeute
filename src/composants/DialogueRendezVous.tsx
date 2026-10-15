// Créer ou modifier un rendez-vous. Depuis un rendez-vous avec un client :
// démarrer la séance (fiche datée du jour du rendez-vous), envoyer un
// rappel, marquer absent ou annulé.

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, categorie, couleursAgenda, MODALITES, STATUTS } from '../config/agenda';
import { donnees } from '../donnees';
import {
  categorieSuggeree,
  conflits,
  decalerJour,
  dureeMinutes,
  heureDe,
  heureLisible,
  horodatage,
  jourDe,
} from '../domaine/agenda';
import { messageErreur } from '../domaine/format';
import type { CategorieRdv, ClientResume, ModaliteRdv, RendezVous, StatutRdv } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { Dialogue, Erreur, useNotifier } from './Commun';
import { DialogueRappel } from './DialogueRappel';
import { Icone } from './Icone';

const DUREES = [30, 45, 60, 75, 90, 120];

export function DialogueRendezVous({
  rdv,
  initial,
  clients,
  existants,
  fermer,
}: {
  /** Rendez-vous à modifier ; absent = création. */
  rdv?: RendezVous;
  /** Valeurs de départ d'une création (jour, heure, client). */
  initial?: { jour?: string; heure?: string; clientId?: string };
  clients: ClientResume[];
  /** Rendez-vous déjà connus, pour signaler les chevauchements. */
  existants: RendezVous[];
  /** `true` si quelque chose a changé. */
  fermer: (modifie: boolean) => void;
}) {
  const { parametres } = useReglages();
  const couleurs = couleursAgenda(parametres);
  const notifier = useNotifier();
  const naviguer = useNavigate();
  const tries = useMemo(
    () => [...clients].sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr')),
    [clients],
  );
  const parId = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const clientInitial = rdv?.client_id ?? initial?.clientId ?? '';
  const [clientId, setClientId] = useState(clientInitial);
  const [cat, setCat] = useState<CategorieRdv>(
    rdv?.categorie ?? (clientInitial ? categorieSuggeree(parId.get(clientInitial)?.nb_seances ?? 1) : 'seance'),
  );
  const [jour, setJour] = useState(rdv ? jourDe(rdv.debut) : (initial?.jour ?? ''));
  const [heure, setHeure] = useState(rdv ? heureDe(rdv.debut) : (initial?.heure ?? '09:00'));
  const [duree, setDuree] = useState(rdv ? dureeMinutes(rdv) : parametres.duree_rdv_minutes);
  const [modalite, setModalite] = useState<ModaliteRdv>(rdv?.modalite ?? 'cabinet');
  const [titre, setTitre] = useState(rdv?.titre ?? '');
  const [note, setNote] = useState(rdv?.note ?? '');
  const [statut, setStatut] = useState<StatutRdv>(rdv?.statut ?? 'prevu');
  const [repeter, setRepeter] = useState(1);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [suppression, setSuppression] = useState(false);
  const [rappel, setRappel] = useState<'email' | 'sms' | null>(null);

  const avecClient = categorie(cat).avecClient;
  const client = clientId ? parId.get(clientId) : undefined;
  const debut = jour && heure ? horodatage(jour, heure) : null;
  const fin = debut ? new Date(Date.parse(debut) + duree * 60_000).toISOString() : null;
  const chevauchements = debut && fin ? conflits({ id: rdv?.id, debut, fin }, existants) : [];

  function choisirClient(id: string) {
    setClientId(id);
    // la catégorie suit l'avancement du parcours, sauf choix explicite d'un créneau sans client
    if (id && categorie(cat).avecClient) setCat(categorieSuggeree(parId.get(id)?.nb_seances ?? 1));
  }

  async function valider(e: FormEvent) {
    e.preventDefault();
    setErreur(null);
    if (!debut || !fin) return setErreur('Indiquez le jour et l’heure.');
    if ((cat === 'seance' || cat === 'bilan') && !clientId) return setErreur('Choisissez le client de cette séance.');
    if (!clientId && !titre.trim()) return setErreur('Donnez un intitulé à ce créneau.');
    const champs = {
      client_id: avecClient || clientId ? clientId || null : null,
      categorie: cat,
      modalite,
      titre: titre.trim(),
      note: note.trim(),
      statut,
    };
    setEnvoi(true);
    try {
      if (rdv) {
        await donnees.modifierRendezVous(rdv.id, { ...champs, debut, fin });
        notifier('Rendez-vous modifié.');
      } else {
        for (let i = 0; i < repeter; i++) {
          const jourI = decalerJour(jour, 7 * i);
          const d = horodatage(jourI, heure);
          await donnees.creerRendezVous({
            ...champs,
            debut: d,
            fin: new Date(Date.parse(d) + duree * 60_000).toISOString(),
          });
        }
        notifier(repeter > 1 ? `${repeter} rendez-vous créés (un par semaine).` : 'Rendez-vous ajouté.');
      }
      fermer(true);
    } catch (err) {
      setErreur(messageErreur(err));
    } finally {
      setEnvoi(false);
    }
  }

  async function demarrerSeance() {
    if (!rdv?.client_id) return;
    setEnvoi(true);
    try {
      const s = await donnees.creerSeance(rdv.client_id, jourDe(rdv.debut));
      await donnees.modifierRendezVous(rdv.id, { seance_id: s.id, statut: 'honore' });
      naviguer(`/clients/${rdv.client_id}/seances/${s.id}`);
    } catch (err) {
      setErreur(messageErreur(err));
      setEnvoi(false);
    }
  }

  async function supprimer() {
    if (!rdv) return;
    try {
      await donnees.supprimerRendezVous(rdv.id);
      notifier('Rendez-vous supprimé.');
      fermer(true);
    } catch (err) {
      setErreur(messageErreur(err));
    }
  }

  const futur = rdv ? Date.parse(rdv.debut) > Date.now() : false;

  return (
    <Dialogue
      ouvert
      fermer={() => fermer(false)}
      titre={rdv ? 'Rendez-vous' : 'Nouveau rendez-vous'}
      pied={
        <>
          {rdv && (
            <button
              type="button"
              className="bouton bouton-danger"
              onClick={() => setSuppression(true)}
              style={{ marginRight: 'auto' }}
            >
              <Icone nom="corbeille" taille={15} /> Supprimer
            </button>
          )}
          <button type="button" className="bouton" onClick={() => fermer(false)}>
            Annuler
          </button>
          <button type="submit" form="form-rdv" className="bouton bouton-principal" disabled={envoi}>
            {envoi ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </>
      }
    >
      <form id="form-rdv" onSubmit={valider} style={{ display: 'grid', gap: 14 }} noValidate>
        <fieldset className="champ segments-champ">
          <legend className="etiquette">Type de rendez-vous</legend>
          <div className="choix-categories" role="radiogroup" aria-label="Type de rendez-vous">
            {CATEGORIES.map((c) => (
              <button
                key={c.cle}
                type="button"
                role="radio"
                aria-checked={cat === c.cle}
                className={`choix-categorie pave-${c.cle}`}
                style={{ '--c': couleurs[c.cle] } as CSSProperties}
                onClick={() => setCat(c.cle)}
              >
                <span className="legende-pastille" aria-hidden />
                <Icone nom={c.icone} taille={14} /> {c.libelle}
              </button>
            ))}
          </div>
        </fieldset>

        {(avecClient || clientId) && (
          <div className="champ">
            <label htmlFor="rdv-client">Client{cat === 'premier' ? ' (facultatif pour un premier contact)' : ''}</label>
            <select id="rdv-client" value={clientId} onChange={(e) => choisirClient(e.target.value)}>
              <option value="">{cat === 'premier' ? '— Pas encore de fiche —' : '— Choisir —'}</option>
              {tries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom.toUpperCase()} {c.prenom} ({c.nb_seances} séance{c.nb_seances > 1 ? 's' : ''})
                </option>
              ))}
            </select>
            {client && cat !== categorieSuggeree(client.nb_seances) && avecClient && (
              <span className="indication">
                Suggestion d’après le parcours : {categorie(categorieSuggeree(client.nb_seances)).libelle.toLowerCase()}
                .
              </span>
            )}
          </div>
        )}

        {!clientId && (
          <div className="champ">
            <label htmlFor="rdv-titre">Intitulé</label>
            <input
              id="rdv-titre"
              maxLength={120}
              placeholder={
                cat === 'personnel'
                  ? 'ex. Congé, formation…'
                  : cat === 'premier'
                    ? 'ex. Nom de la personne'
                    : 'ex. Supervision'
              }
              value={titre}
              onChange={(e) => setTitre(e.target.value)}
            />
          </div>
        )}

        <div className="grille-reglages">
          <div className="champ">
            <label htmlFor="rdv-jour">Jour</label>
            <input id="rdv-jour" type="date" value={jour} onChange={(e) => setJour(e.target.value)} required />
          </div>
          <div className="champ">
            <label htmlFor="rdv-heure">Heure</label>
            <input
              id="rdv-heure"
              type="time"
              step={300}
              value={heure}
              onChange={(e) => setHeure(e.target.value)}
              required
            />
          </div>
          <div className="champ">
            <label htmlFor="rdv-duree">Durée</label>
            <select id="rdv-duree" value={duree} onChange={(e) => setDuree(Number(e.target.value))}>
              {[...new Set([...DUREES, duree])]
                .sort((a, b) => a - b)
                .map((d) => (
                  <option key={d} value={d}>
                    {d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60}` : ''}`}
                  </option>
                ))}
            </select>
          </div>
          <div className="champ">
            <label htmlFor="rdv-modalite">Modalité</label>
            <select id="rdv-modalite" value={modalite} onChange={(e) => setModalite(e.target.value as ModaliteRdv)}>
              {(Object.keys(MODALITES) as ModaliteRdv[]).map((m) => (
                <option key={m} value={m}>
                  {MODALITES[m].libelle}
                </option>
              ))}
            </select>
          </div>
        </div>

        {chevauchements.length > 0 && (
          <p className="alerte" role="status">
            <Icone nom="info" /> Ce créneau chevauche :{' '}
            {chevauchements
              .map(
                (r) =>
                  `${r.titre || (r.client_id ? parId.get(r.client_id)?.prenom : '') || categorie(r.categorie).libelle} (${heureLisible(r.debut)}–${heureLisible(r.fin)})`,
              )
              .join(', ')}
            .
          </p>
        )}

        {rdv && (
          <fieldset className="champ segments-champ">
            <legend className="etiquette">Statut</legend>
            <div className="segments" role="radiogroup" aria-label="Statut">
              {(Object.keys(STATUTS) as StatutRdv[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={statut === s}
                  className="segment"
                  onClick={() => setStatut(s)}
                >
                  {STATUTS[s].icone && <Icone nom={STATUTS[s].icone!} taille={13} />} {STATUTS[s].libelle}
                </button>
              ))}
            </div>
          </fieldset>
        )}

        {!rdv && (
          <div className="champ" style={{ maxWidth: 260 }}>
            <label htmlFor="rdv-repeter">Répéter chaque semaine</label>
            <select id="rdv-repeter" value={repeter} onChange={(e) => setRepeter(Number(e.target.value))}>
              <option value={1}>Non, une seule fois</option>
              {[2, 3, 4, 6, 8, 10, 12].map((n) => (
                <option key={n} value={n}>
                  {n} semaines de suite
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="champ">
          <label htmlFor="rdv-note">Note privée (facultatif)</label>
          <textarea id="rdv-note" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>

        {rdv?.client_id && client && (
          <div className="actions">
            {rdv.seance_id ? (
              <button
                type="button"
                className="bouton bouton-doux"
                onClick={() => naviguer(`/clients/${rdv.client_id}/seances/${rdv.seance_id}`)}
              >
                <Icone nom="document" taille={15} /> Ouvrir la fiche de séance
              </button>
            ) : (
              categorie(rdv.categorie).avecClient && (
                <button type="button" className="bouton bouton-doux" onClick={demarrerSeance} disabled={envoi}>
                  <Icone nom="crayon" taille={15} /> Commencer la séance
                </button>
              )
            )}
            {futur && client.email && (
              <button type="button" className="bouton" onClick={() => setRappel('email')}>
                <Icone nom="courriel" taille={15} /> Rappel par e-mail
              </button>
            )}
            {futur && client.telephone && (
              <button type="button" className="bouton" onClick={() => setRappel('sms')}>
                <Icone nom="sms" taille={15} /> Rappel par SMS
              </button>
            )}
            {rdv.rappel_envoye_le && <span className="meta">Rappel déjà envoyé.</span>}
          </div>
        )}

        {suppression && (
          <div className="alerte alerte-danger" role="alert">
            <span>
              Supprimer ce rendez-vous ? (Pour garder une trace, préférez le statut « Annulé ».){' '}
              <button type="button" className="bouton bouton-petit bouton-danger" onClick={supprimer}>
                Supprimer
              </button>{' '}
              <button type="button" className="bouton bouton-petit" onClick={() => setSuppression(false)}>
                Garder
              </button>
            </span>
          </div>
        )}
        {erreur && <Erreur message={erreur} />}
      </form>

      {rappel && rdv && client && (
        <DialogueRappel
          rdv={rdv}
          client={client}
          canal={rappel}
          fermer={(envoye) => {
            setRappel(null);
            if (envoye) fermer(true);
          }}
        />
      )}
    </Dialogue>
  );
}
