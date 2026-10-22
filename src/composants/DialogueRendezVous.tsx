// Créer ou modifier un rendez-vous, dans l'ordre où l'on y pense (0.11.0) :
// 1. avec qui (client, puis type suggéré d'après son parcours) ; 2. quand (prochains
// créneaux libres en un clic, d'abord aux habitudes du client ; jour, heure, durée) ;
// 3. où (modalité). Une phrase récapitule le rendez-vous en tête. Répétition et note
// sont dans « Plus d'options ». Depuis un rendez-vous avec un client : démarrer la
// séance (fiche datée du jour du rendez-vous), envoyer un rappel, marquer absent ou annulé.

import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { CATEGORIES, categorie, couleursAgenda, MODALITES, STATUTS } from '../config/agenda';
import { donnees } from '../donnees';
import {
  categorieSuggeree,
  conflits,
  creneauxLibres,
  decalerJour,
  dureeMinutes,
  heureDe,
  heureLisible,
  habitudesClient,
  horodatage,
  jourDe,
} from '../domaine/agenda';
import { dateDuJour, jourLisible, messageErreur } from '../domaine/format';
import type { CategorieRdv, ClientResume, ModaliteRdv, RendezVous, StatutRdv } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { Dialogue, Erreur, useNotifier } from './Commun';
import { DialogueRappel } from './DialogueRappel';
import { Icone, type NomIcone } from './Icone';

const DUREES = [30, 45, 60, 75, 90, 120];

/** Pictogramme de chaque modalité (avec son libellé : jamais l'icône seule). */
const ICONES_MODALITE: Record<ModaliteRdv, NomIcone> = {
  cabinet: 'epingle',
  visio: 'visio',
  telephone: 'sms',
  domicile: 'utilisateur',
};

const libelleDuree = (d: number) => (d < 60 ? `${d} min` : `${Math.floor(d / 60)} h${d % 60 ? ` ${d % 60}` : ''}`);

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

  // Création : on charge l'agenda (un an en arrière pour les habitudes du client, deux
  // semaines devant pour les créneaux libres et les chevauchements).
  const [agenda, setAgenda] = useState<RendezVous[] | null>(null);
  useEffect(() => {
    if (rdv) return;
    const aujourdhui = dateDuJour();
    let actif = true;
    donnees
      .listerRendezVous(
        horodatage(decalerJour(aujourdhui, -365), '00:00'),
        horodatage(decalerJour(aujourdhui, 16), '00:00'),
      )
      .then((r) => actif && setAgenda(r))
      .catch(() => actif && setAgenda([]));
    return () => {
      actif = false;
    };
  }, [rdv]);
  const connus = useMemo(() => {
    const parIdRdv = new Map(existants.map((r) => [r.id, r]));
    for (const r of agenda ?? []) parIdRdv.set(r.id, r);
    return [...parIdRdv.values()];
  }, [existants, agenda]);
  const suggestions = useMemo(() => {
    if (rdv || !agenda) return [];
    const maintenant = new Date();
    const habitudes = clientId ? habitudesClient(connus, clientId, maintenant) : [];
    return creneauxLibres(connus, { ...parametres, duree_rdv_minutes: duree }, maintenant, { nombre: 6, habitudes });
  }, [rdv, agenda, connus, clientId, parametres, duree]);

  const avecClient = categorie(cat).avecClient;
  const client = clientId ? parId.get(clientId) : undefined;
  const debut = jour && heure ? horodatage(jour, heure) : null;
  const fin = debut ? new Date(Date.parse(debut) + duree * 60_000).toISOString() : null;
  const chevauchements = debut && fin ? conflits({ id: rdv?.id, debut, fin }, connus) : [];

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
  const jourTexte = jour ? jourLisible(jour) : '';
  const resume = debut
    ? [
        `${jourTexte.charAt(0).toUpperCase()}${jourTexte.slice(1)}, ${heureLisible(debut)} – ${heureLisible(fin!)}`,
        `${categorie(cat).libelle}${client ? ` avec ${client.prenom} ${client.nom}` : titre.trim() ? ` : ${titre.trim()}` : ''}`,
        MODALITES[modalite].lieu,
      ].join(' · ')
    : 'Choisissez un créneau ci-dessous.';

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
      <form id="form-rdv" onSubmit={valider} className="formulaire-rdv" noValidate>
        <p className="resume-rdv" role="status">
          <Icone nom="calendrier" taille={16} /> <span>{resume}</span>
        </p>

        <section className="etape-rdv" aria-labelledby="rdv-qui">
          <h3 id="rdv-qui" className="titre-etape">
            <span className="numero-etape" aria-hidden>
              1
            </span>{' '}
            Avec qui ?
          </h3>
          <div className="champ">
            <label htmlFor="rdv-client">Client</label>
            <select id="rdv-client" value={clientId} onChange={(e) => choisirClient(e.target.value)}>
              <option value="">
                {avecClient
                  ? cat === 'premier'
                    ? '— Pas encore de fiche —'
                    : '— Choisir un client —'
                  : '— Pas de client (créneau à vous) —'}
              </option>
              {tries.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom.toUpperCase()} {c.prenom} ({c.nb_seances} séance{c.nb_seances > 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>
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
            {client && cat !== categorieSuggeree(client.nb_seances) && avecClient && (
              <span className="indication">
                Suggestion d’après le parcours : {categorie(categorieSuggeree(client.nb_seances)).libelle.toLowerCase()}
                .
              </span>
            )}
          </fieldset>
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
        </section>

        <section className="etape-rdv" aria-labelledby="rdv-quand">
          <h3 id="rdv-quand" className="titre-etape">
            <span className="numero-etape" aria-hidden>
              2
            </span>{' '}
            Quand ?
          </h3>
          {!rdv && (
            <div className="champ">
              <span className="etiquette" id="rdv-libres">
                Prochains créneaux libres{client ? ` (d’abord aux habitudes de ${client.prenom})` : ''}
              </span>
              {agenda === null ? (
                <span className="indication">Recherche des créneaux libres…</span>
              ) : suggestions.length === 0 ? (
                <span className="indication">
                  Aucun créneau libre dans les deux semaines (heures de travail : Paramètres › Emploi du temps).
                </span>
              ) : (
                <div className="creneaux-libres" role="group" aria-labelledby="rdv-libres">
                  {suggestions.map((c) => {
                    const choisi = jour === jourDe(c.debut) && heure === heureDe(c.debut);
                    const j = jourLisible(jourDe(c.debut));
                    return (
                      <button
                        key={c.debut}
                        type="button"
                        className="creneau-libre"
                        aria-pressed={choisi}
                        onClick={() => {
                          setJour(jourDe(c.debut));
                          setHeure(heureDe(c.debut));
                        }}
                      >
                        <span>{j.charAt(0).toUpperCase() + j.slice(1)}</span>
                        <strong>{heureLisible(c.debut)}</strong>
                        {c.habituel && (
                          <span className="creneau-habituel">
                            <Icone nom="etoile" taille={11} /> habituel
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <div className="grille-quand">
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
          </div>
          <fieldset className="champ segments-champ">
            <legend className="etiquette">Durée</legend>
            <div className="segments" role="radiogroup" aria-label="Durée">
              {[...new Set([...DUREES, duree])]
                .sort((a, b) => a - b)
                .map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={duree === d}
                    className="segment"
                    onClick={() => setDuree(d)}
                  >
                    {libelleDuree(d)}
                  </button>
                ))}
            </div>
          </fieldset>
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
        </section>

        <section className="etape-rdv" aria-labelledby="rdv-ou">
          <h3 id="rdv-ou" className="titre-etape">
            <span className="numero-etape" aria-hidden>
              3
            </span>{' '}
            Où ?
          </h3>
          <div className="segments" role="radiogroup" aria-label="Modalité">
            {(Object.keys(MODALITES) as ModaliteRdv[]).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={modalite === m}
                className="segment"
                onClick={() => setModalite(m)}
              >
                <Icone nom={ICONES_MODALITE[m]} taille={14} /> {MODALITES[m].libelle}
              </button>
            ))}
          </div>
        </section>

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

        <details className="plus-options" open={Boolean(rdv?.note)}>
          <summary>Plus d’options (répéter, note privée)</summary>
          <div className="plus-options-corps">
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
              <textarea
                id="rdv-note"
                rows={2}
                maxLength={1000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
        </details>

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
