// Messages de relance et de rappel : modèle + variables → texte prêt à
// envoyer depuis la messagerie du thérapeute (mailto: / sms:).

export interface VariablesMessage {
  prenom: string;
  nom: string;
  therapeute: string;
  /** Signature du profil ; à défaut, le nom du thérapeute. */
  signature: string;
  site: string;
  // relance avec questionnaire
  lien?: string;
  expiration?: string;
  // rappel de rendez-vous
  date?: string;
  heure?: string;
  lieu?: string;
}

export function remplirModele(modele: string, v: VariablesMessage): string {
  return modele.replace(
    /\{(prenom|nom|therapeute|signature|lien|expiration|site|date|heure|lieu)\}/g,
    (_, cle: keyof VariablesMessage) => v[cle] || (cle === 'signature' ? v.therapeute : ''),
  );
}

/** Ce qui est conservé dans l'historique : jamais le lien personnel lui-même. */
export function masquerLien(texte: string, lien: string): string {
  return lien ? texte.split(lien).join('[lien du questionnaire]') : texte;
}

export const lienMailto = (destinataire: string, objet: string, corps: string) =>
  `mailto:${encodeURIComponent(destinataire)}?subject=${encodeURIComponent(objet)}&body=${encodeURIComponent(corps)}`;

/** Format reconnu par iOS et Android pour pré-remplir un SMS. */
export const lienSms = (telephone: string, corps: string) =>
  `sms:${telephone.replace(/[^\d+]/g, '')}?&body=${encodeURIComponent(corps)}`;

export const lienQuestionnaire = (jeton: string, origine = globalThis.location?.origin ?? '') =>
  `${origine}/q/${jeton}`;

export const lienDocument = (jeton: string, origine = globalThis.location?.origin ?? '') => `${origine}/d/${jeton}`;

export const lienRecu = (jeton: string, origine = globalThis.location?.origin ?? '') => `${origine}/r/${jeton}`;

/**
 * Ajoute un paragraphe avant celui qui contient la signature (formule de
 * politesse comprise), ou à la fin du message si elle n'est pas trouvée.
 */
export function insererAvantSignature(corps: string, ajout: string, signature: string): string {
  const s = signature.trim();
  const i = s ? corps.lastIndexOf(s) : -1;
  const coupure = i > 0 ? corps.lastIndexOf('\n\n', i) : -1;
  if (coupure < 0) return `${corps.trimEnd()}\n\n${ajout}`;
  return `${corps.slice(0, coupure).trimEnd()}\n\n${ajout}\n\n${corps.slice(coupure).trimStart()}`;
}
