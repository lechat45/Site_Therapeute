// Briques communes : Chargement, Erreur, Dialogue (modale <dialog> native),
// Confirmation (avant une action définitive) et notifications éphémères
// (FournisseurNotifications / useNotifier).

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icone } from './Icone';

export function Chargement({ texte = 'Chargement…' }: { texte?: string }) {
  return (
    <div className="chargement" role="status">
      <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
        <div className="rouage" />
        <span>{texte}</span>
      </div>
    </div>
  );
}

export function Erreur({ message, reessayer }: { message: string; reessayer?: () => void }) {
  return (
    <div className="alerte alerte-danger" role="alert">
      <Icone nom="info" />
      <div style={{ display: 'grid', gap: 8 }}>
        <span>{message}</span>
        {reessayer && (
          <div>
            <button className="bouton bouton-petit" onClick={reessayer}>
              Réessayer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Boîte de dialogue modale native (<dialog>), fermée par Échap ou « Annuler ». */
export function Dialogue({
  ouvert,
  fermer,
  titre,
  children,
  pied,
  classe,
}: {
  ouvert: boolean;
  fermer: () => void;
  titre: string;
  children: ReactNode;
  /** Boutons du bas ; `null` si le contenu les porte lui-même. */
  pied: ReactNode;
  /** Classe en plus sur la boîte (ex. « presentation » : grand format). */
  classe?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const ouvertRef = useRef(ouvert);
  ouvertRef.current = ouvert;
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) {
      d.showModal();
      // Le navigateur donne le focus au premier élément focalisable : s'il est
      // loin en bas (ex. « Message envoyé »), on garde la boîte affichée en haut.
      const actif = document.activeElement as HTMLElement | null;
      if (actif && actif !== d && actif.getBoundingClientRect().bottom > d.getBoundingClientRect().bottom) d.focus();
      d.scrollTop = 0;
    }
    if (!ouvert && d.open) d.close();
  }, [ouvert]);
  return (
    <dialog
      ref={ref}
      className={classe}
      aria-labelledby="titre-dialogue"
      tabIndex={-1}
      // Échap : c'est le parent qui décide de fermer (il peut d'abord poser une question).
      onCancel={(e) => {
        e.preventDefault();
        fermer();
      }}
      onClose={() => {
        fermer();
        // fermeture forcée par le navigateur alors que le parent garde la boîte ouverte
        setTimeout(() => {
          const d = ref.current;
          if (d && ouvertRef.current && !d.open) d.showModal();
        }, 0);
      }}
    >
      <div className="dialogue-entete">
        <h2 id="titre-dialogue">{titre}</h2>
      </div>
      <div className="dialogue-corps">{children}</div>
      {pied !== null && <div className="dialogue-pied">{pied}</div>}
    </dialog>
  );
}

/** Question avant une action définitive (supprimer une note, annuler un reçu…). */
export function Confirmation({
  titre,
  children,
  action,
  confirmer,
  fermer,
}: {
  titre: string;
  children: ReactNode;
  /** Libellé du bouton de confirmation. */
  action: string;
  confirmer: () => void;
  fermer: () => void;
}) {
  return (
    <Dialogue
      ouvert
      fermer={fermer}
      titre={titre}
      pied={
        <>
          <button className="bouton" onClick={fermer}>
            Annuler
          </button>
          <button className="bouton bouton-danger" onClick={confirmer}>
            {action}
          </button>
        </>
      }
    >
      {children}
    </Dialogue>
  );
}

// ---------------------------------------------------------------------
// Notifications éphémères
// ---------------------------------------------------------------------
type Notif = { id: number; message: string; erreur: boolean };
const ContexteNotif = createContext<(message: string, erreur?: boolean) => void>(() => {});

export function FournisseurNotifications({ children }: { children: ReactNode }) {
  const [notif, setNotif] = useState<Notif | null>(null);
  const notifier = useCallback((message: string, erreur = false) => {
    const id = Date.now();
    setNotif({ id, message, erreur });
    setTimeout(() => setNotif((n) => (n?.id === id ? null : n)), erreur ? 6000 : 3200);
  }, []);
  return (
    <ContexteNotif.Provider value={notifier}>
      {children}
      <div aria-live="polite" role="status">
        {notif && (
          <div className={`toast${notif.erreur ? ' toast-erreur' : ''}`}>
            <Icone nom={notif.erreur ? 'info' : 'valider'} />
            {notif.message}
          </div>
        )}
      </div>
    </ContexteNotif.Provider>
  );
}

export const useNotifier = () => useContext(ContexteNotif);
