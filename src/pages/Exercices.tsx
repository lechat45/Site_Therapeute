// Exercices et documents : bibliothèque du thérapeute, remises aux
// clients (lien personnel ou papier) et version à imprimer.

import { useState, type FormEvent } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Chargement, Confirmation, Dialogue, Erreur, useNotifier } from '../composants/Commun';
import { DialogueRemise } from '../composants/DialogueRemise';
import { DocumentTexte } from '../composants/DocumentTexte';
import { DialogueReponsesExercice } from '../composants/ReponsesExercice';
import { Icone } from '../composants/Icone';
import { CATEGORIES_RESSOURCES, MODELES_RESSOURCES } from '../config/ressources';
import { donnees } from '../donnees';
import { dateCourte, dateDuJour, dateLongue, messageErreur } from '../domaine/format';
import { questionsDocument } from '../domaine/texte';
import type { CategorieRessource, ClientResume, Remise, Ressource } from '../domaine/types';
import { useReglages } from '../etat/reglages';
import { useTherapeute } from '../etat/session';
import { useTaches } from '../etat/tachesContexte';
import { useChargement } from '../etat/useChargement';

export function Exercices() {
  const ressources = useChargement(() => donnees.ressources(), [], 'ressources');
  const remises = useChargement(() => donnees.listerRemises(), [], 'remises');
  const { clients } = useTaches();
  const notifier = useNotifier();
  const [categorie, setCategorie] = useState<CategorieRessource | ''>('');
  const [edition, setEdition] = useState<Ressource | 'nouvelle' | null>(null);
  const [apercu, setApercu] = useState<Ressource | null>(null);
  const [remise, setRemise] = useState<string | null>(null);
  const [suppression, setSuppression] = useState<Ressource | null>(null);
  const [retrait, setRetrait] = useState<Remise | null>(null);
  const [lecture, setLecture] = useState<Remise | null>(null);
  const [ajoutModeles, setAjoutModeles] = useState(false);

  const liste = ressources.donnees ?? [];
  const visibles = categorie ? liste.filter((r) => r.categorie === categorie) : liste;
  const titres = new Set(liste.map((r) => r.titre));
  const modelesAbsents = MODELES_RESSOURCES.filter((m) => !titres.has(m.titre));
  const parId = new Map(clients.map((c) => [c.id, c]));

  async function ajouterModeles() {
    setAjoutModeles(true);
    try {
      for (const m of modelesAbsents) await donnees.enregistrerRessource(null, m);
      notifier(
        `${modelesAbsents.length} modèle${modelesAbsents.length > 1 ? 's' : ''} ajouté(s) : adaptez-les à votre façon de travailler.`,
      );
      ressources.recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    } finally {
      setAjoutModeles(false);
    }
  }
  async function supprimer(r: Ressource) {
    setSuppression(null);
    try {
      await donnees.supprimerRessource(r.id);
      notifier(`« ${r.titre} » retiré de la bibliothèque (les copies déjà remises restent lisibles).`);
      ressources.recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }
  async function retirer(r: Remise) {
    setRetrait(null);
    try {
      await donnees.supprimerRemise(r.id);
      notifier(r.mode === 'lien' ? 'Lien désactivé et remise effacée.' : 'Remise effacée.');
      remises.recharger();
    } catch (e) {
      notifier(messageErreur(e), true);
    }
  }

  return (
    <div className="page">
      <div className="entete-page">
        <div>
          <h1>Exercices et documents</h1>
          <p className="sous-titre">
            Votre bibliothèque d'exercices et de fiches à remettre aux clients : par lien personnel (valable 90 jours)
            ou sur papier.
          </p>
        </div>
        <div className="actions">
          {modelesAbsents.length > 0 && liste.length > 0 && (
            <button className="bouton" onClick={ajouterModeles} disabled={ajoutModeles}>
              <Icone nom="copier" taille={16} /> Ajouter les modèles proposés ({modelesAbsents.length})
            </button>
          )}
          <button className="bouton bouton-principal" onClick={() => setEdition('nouvelle')}>
            <Icone nom="plus" /> Nouveau document
          </button>
        </div>
      </div>

      {ressources.erreur && <Erreur message={ressources.erreur} reessayer={ressources.recharger} />}

      {liste.length > 0 && (
        <div className="segments" role="group" aria-label="Catégorie">
          <button className="segment" aria-pressed={categorie === ''} onClick={() => setCategorie('')}>
            Tout <span className="compteur">{liste.length}</span>
          </button>
          {(Object.keys(CATEGORIES_RESSOURCES) as CategorieRessource[]).map((c) => {
            const n = liste.filter((r) => r.categorie === c).length;
            return n ? (
              <button key={c} className="segment" aria-pressed={categorie === c} onClick={() => setCategorie(c)}>
                <Icone nom={CATEGORIES_RESSOURCES[c].icone} taille={14} /> {CATEGORIES_RESSOURCES[c].libelle}{' '}
                <span className="compteur">{n}</span>
              </button>
            ) : null;
          })}
        </div>
      )}

      {!ressources.donnees && ressources.chargement ? (
        <Chargement />
      ) : liste.length === 0 ? (
        <div className="carte vide">
          <Icone nom="document" taille={28} />
          <p>Votre bibliothèque est vide.</p>
          <p className="meta">
            Commencez avec quelques modèles (respiration carrée, journal des émotions, ancrage 5-4-3-2-1, lettre que
            l'on n'envoie pas), puis adaptez-les.
          </p>
          <div className="actions" style={{ justifyContent: 'center' }}>
            <button className="bouton bouton-principal" onClick={ajouterModeles} disabled={ajoutModeles}>
              <Icone nom="copier" taille={16} /> Ajouter les modèles proposés
            </button>
            <button className="bouton" onClick={() => setEdition('nouvelle')}>
              <Icone nom="plus" taille={16} /> Écrire mon propre document
            </button>
          </div>
        </div>
      ) : (
        <div className="grille-documents">
          {visibles.map((r) => (
            <article key={r.id} className={`carte document document-${r.categorie}`}>
              <span className="puce puce-neutre document-categorie">
                <Icone nom={CATEGORIES_RESSOURCES[r.categorie].icone} taille={12} />
                {CATEGORIES_RESSOURCES[r.categorie].libelle}
              </span>
              <h2>{r.titre}</h2>
              {questionsDocument(r.contenu).length > 0 && (
                <span className="puce puce-neutre document-categorie">
                  <Icone nom="crayon" taille={12} /> À compléter · {questionsDocument(r.contenu).length} question
                  {questionsDocument(r.contenu).length > 1 ? 's' : ''}
                </span>
              )}
              {r.resume && <p className="meta">{r.resume}</p>}
              <p className="meta document-remises">
                {(() => {
                  const n = (remises.donnees ?? []).filter((x) => x.document_id === r.id).length;
                  return n ? `Remis ${n} fois` : 'Jamais remis';
                })()}
              </p>
              <div className="actions">
                <button className="bouton bouton-principal bouton-petit" onClick={() => setRemise(r.id)}>
                  <Icone nom="envoyer" taille={14} /> Remettre à un client
                </button>
                <button className="bouton bouton-petit" onClick={() => setApercu(r)}>
                  <Icone nom="document" taille={14} /> Aperçu
                </button>
                <button className="bouton bouton-petit" onClick={() => setEdition(r)}>
                  <Icone nom="crayon" taille={14} /> Modifier
                </button>
                <button
                  className="bouton-lien"
                  onClick={() => setSuppression(r)}
                  aria-label={`Supprimer « ${r.titre} »`}
                >
                  <Icone nom="corbeille" taille={14} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <section className="carte" aria-labelledby="ex-remises">
        <div className="carte-entete">
          <div>
            <h2 id="ex-remises">Documents remis</h2>
            <p className="aide">
              Ce que chaque client a reçu, s'il a ouvert son lien et, pour un exercice à compléter, ses réponses.
              Retirer une remise désactive le lien.
            </p>
          </div>
        </div>
        <div className="carte-corps" style={{ paddingTop: 8 }}>
          <TableauRemises
            remises={remises.donnees ?? []}
            clients={parId}
            retirer={(r) => setRetrait(r)}
            voirReponses={setLecture}
            chargement={!remises.donnees && remises.chargement}
          />
        </div>
      </section>

      {edition && (
        <DialogueRessource
          ressource={edition === 'nouvelle' ? null : edition}
          fermer={(modifiee) => {
            setEdition(null);
            if (modifiee) ressources.recharger();
          }}
        />
      )}
      {apercu && (
        <Dialogue
          ouvert
          fermer={() => setApercu(null)}
          titre={apercu.titre}
          pied={
            <>
              <Link className="bouton" to={`/exercices/${apercu.id}/imprimer`}>
                <Icone nom="imprimer" taille={16} /> Version à imprimer
              </Link>
              <button className="bouton bouton-principal" onClick={() => setApercu(null)}>
                Fermer
              </button>
            </>
          }
        >
          <DocumentTexte contenu={apercu.contenu} />
        </Dialogue>
      )}
      {remise && (
        <DialogueRemise
          ressources={liste}
          ressourceInitiale={remise}
          clients={clients}
          fermer={(remis) => {
            setRemise(null);
            if (remis) remises.recharger();
          }}
        />
      )}
      {suppression && (
        <Confirmation
          titre="Supprimer ce document ?"
          action="Supprimer"
          confirmer={() => supprimer(suppression)}
          fermer={() => setSuppression(null)}
        >
          <p>
            « {suppression.titre} » sera retiré de votre bibliothèque. Les clients qui l'ont déjà reçu gardent leur
            copie jusqu'à l'expiration du lien.
          </p>
        </Confirmation>
      )}
      {lecture && (
        <DialogueReponsesExercice
          remise={lecture}
          client={parId.get(lecture.client_id)}
          fermer={(lues) => {
            setLecture(null);
            if (lues) remises.recharger();
          }}
        />
      )}
      {retrait && (
        <Confirmation
          titre="Retirer cette remise ?"
          action={retrait.mode === 'lien' ? 'Désactiver le lien' : 'Effacer la remise'}
          confirmer={() => retirer(retrait)}
          fermer={() => setRetrait(null)}
        >
          <p>
            {retrait.mode === 'lien'
              ? 'Le client ne pourra plus ouvrir ce document avec son lien.'
              : 'La remise disparaîtra de la liste.'}
          </p>
        </Confirmation>
      )}
    </div>
  );
}

/** Remises (toutes, ou celles d'un client sur sa fiche). */
export function TableauRemises({
  remises,
  clients,
  retirer,
  voirReponses,
  chargement,
}: {
  remises: Remise[];
  clients?: Map<string, Pick<ClientResume, 'id' | 'nom' | 'prenom'>>;
  retirer: (r: Remise) => void;
  voirReponses: (r: Remise) => void;
  chargement?: boolean;
}) {
  if (chargement) return <Chargement />;
  if (!remises.length) return <p className="meta">Aucun document remis pour l'instant.</p>;
  const aujourdhui = new Date().toISOString();
  return (
    <div className="tableau-conteneur">
      <table>
        <thead>
          <tr>
            <th scope="col">Date</th>
            {clients && <th scope="col">Client</th>}
            <th scope="col">Document</th>
            <th scope="col">Remis</th>
            <th scope="col">Suivi</th>
            <th scope="col">
              <span className="visuellement-cache">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {remises.map((r) => {
            const c = clients?.get(r.client_id);
            const expire = r.mode === 'lien' && r.expire_le !== null && r.expire_le < aujourdhui;
            return (
              <tr key={r.id}>
                <td>{dateCourte(r.cree_le)}</td>
                {clients && (
                  <td>
                    {c ? (
                      <Link to={`/clients/${c.id}`}>
                        {c.prenom} {c.nom}
                      </Link>
                    ) : (
                      '—'
                    )}
                  </td>
                )}
                <td>{r.titre}</td>
                <td>
                  <span className="puce puce-neutre">
                    <Icone nom={r.mode === 'lien' ? 'lien' : 'imprimer'} taille={12} />
                    {r.mode === 'lien' ? 'Par lien' : 'Sur papier'}
                  </span>
                </td>
                <td>
                  {r.repondu_le ? (
                    <button className="puce puce-succes puce-bouton" onClick={() => voirReponses(r)}>
                      <Icone nom={r.consulte_le ? 'valider' : 'cloche'} taille={12} />
                      {r.consulte_le ? 'Réponses lues' : 'Réponses reçues'} · voir
                    </button>
                  ) : r.mode === 'imprime' ? (
                    <span className="meta">—</span>
                  ) : r.ouvert_le ? (
                    <span className="puce puce-succes">
                      <Icone nom="valider" taille={12} /> Ouvert le {dateCourte(r.ouvert_le)}
                    </span>
                  ) : expire ? (
                    <span className="puce puce-neutre">
                      <Icone nom="cadenas" taille={12} /> Expiré
                    </span>
                  ) : (
                    <span className="puce puce-alerte">
                      <Icone nom="horloge" taille={12} /> Pas encore ouvert
                    </span>
                  )}
                </td>
                <td className="num">
                  <button className="bouton bouton-petit" onClick={() => retirer(r)}>
                    Retirer
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DialogueRessource({
  ressource,
  fermer,
}: {
  ressource: Ressource | null;
  fermer: (modifiee: boolean) => void;
}) {
  const notifier = useNotifier();
  const [titre, setTitre] = useState(ressource?.titre ?? '');
  const [categorie, setCategorie] = useState<CategorieRessource>(ressource?.categorie ?? 'exercice');
  const [resume, setResume] = useState(ressource?.resume ?? '');
  const [contenu, setContenu] = useState(ressource?.contenu ?? '');
  const [voir, setVoir] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  async function valider(e: FormEvent) {
    e.preventDefault();
    if (!titre.trim()) return setErreur('Donnez un titre au document.');
    setEnvoi(true);
    try {
      await donnees.enregistrerRessource(ressource?.id ?? null, {
        titre: titre.trim(),
        categorie,
        resume: resume.trim(),
        contenu: contenu.trim(),
      });
      notifier(ressource ? 'Document enregistré.' : 'Document ajouté à la bibliothèque.');
      fermer(true);
    } catch (err) {
      setErreur(messageErreur(err));
      setEnvoi(false);
    }
  }

  return (
    <Dialogue
      ouvert
      fermer={() => fermer(false)}
      titre={ressource ? 'Modifier le document' : 'Nouveau document'}
      pied={
        <>
          <button className="bouton" onClick={() => fermer(false)}>
            Annuler
          </button>
          <button type="submit" form="form-ressource" className="bouton bouton-principal" disabled={envoi}>
            <Icone nom="enregistrer" taille={16} /> Enregistrer
          </button>
        </>
      }
    >
      <form id="form-ressource" onSubmit={valider} style={{ display: 'grid', gap: 14 }}>
        {erreur && <Erreur message={erreur} />}
        <div className="champ">
          <label htmlFor="res-titre">Titre</label>
          <input id="res-titre" maxLength={120} required value={titre} onChange={(e) => setTitre(e.target.value)} />
        </div>
        <div className="champ">
          <label htmlFor="res-cat">Catégorie</label>
          <select id="res-cat" value={categorie} onChange={(e) => setCategorie(e.target.value as CategorieRessource)}>
            {(Object.keys(CATEGORIES_RESSOURCES) as CategorieRessource[]).map((c) => (
              <option key={c} value={c}>
                {CATEGORIES_RESSOURCES[c].libelle}
              </option>
            ))}
          </select>
        </div>
        <div className="champ">
          <label htmlFor="res-resume">Résumé (pour vous, facultatif)</label>
          <input id="res-resume" maxLength={300} value={resume} onChange={(e) => setResume(e.target.value)} />
        </div>
        <div className="champ">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <label htmlFor="res-contenu">Texte remis au client</label>
            <button type="button" className="bouton-lien" onClick={() => setVoir((v) => !v)} aria-pressed={voir}>
              {voir ? 'Modifier le texte' : 'Aperçu'}
            </button>
          </div>
          {voir ? (
            <div className="apercu-document">
              <DocumentTexte contenu={contenu} />
            </div>
          ) : (
            <textarea
              id="res-contenu"
              rows={12}
              maxLength={20000}
              value={contenu}
              onChange={(e) => setContenu(e.target.value)}
            />
          )}
          <span className="indication">
            Mise en forme simple : une ligne commençant par « # » devient un intertitre, par « - » un élément de liste,
            par « ? » une question à laquelle le client répond depuis son lien (exercice à compléter) ; une ligne vide
            sépare les paragraphes.
          </span>
        </div>
      </form>
    </Dialogue>
  );
}

/** Version à imprimer (ou à enregistrer en PDF) d'un document. */
export function ImpressionDocument() {
  const { ressourceId = '' } = useParams();
  const [params] = useSearchParams();
  const t = useTherapeute();
  const { parametres: p } = useReglages();
  const { clients } = useTaches();
  const ressources = useChargement(() => donnees.ressources(), [], 'ressources');
  const r = ressources.donnees?.find((x) => x.id === ressourceId);
  const client = clients.find((c) => c.id === params.get('client'));

  if (!ressources.donnees) return ressources.erreur ? <Erreur message={ressources.erreur} /> : <Chargement />;
  if (!r) return ressources.chargement ? <Chargement /> : <Erreur message="Document introuvable." />;
  return (
    <div className="page page-etroite">
      <div className="entete-page ne-pas-imprimer">
        <Link to="/exercices" className="bouton">
          <Icone nom="precedent" taille={16} /> Exercices et documents
        </Link>
        <button className="bouton bouton-principal" onClick={() => window.print()}>
          <Icone nom="imprimer" taille={16} /> Imprimer ou enregistrer en PDF
        </button>
      </div>
      <article className="feuille">
        <header className="feuille-entete">
          <div>
            <strong>
              {t.prenom} {t.nom}
            </strong>
            {p.specialite && <div>{p.specialite}</div>}
          </div>
          <div className="feuille-droite">
            {p.telephone_pro && <div>{p.telephone_pro}</div>}
            <div>{p.nom_site}</div>
          </div>
        </header>
        <h1>{r.titre}</h1>
        {client && (
          <p className="meta">
            Pour {client.prenom} {client.nom} · remis le {dateLongue(dateDuJour())}
          </p>
        )}
        <DocumentTexte contenu={r.contenu} />
      </article>
    </div>
  );
}
