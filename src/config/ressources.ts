// Bibliothèque d'exercices et de documents : catégories et modèles proposés
// (le thérapeute les adapte ; rien n'est imposé).

import type { NomIcone } from '../composants/Icone';
import type { CategorieRessource, ModeReglement, RessourceModifiable } from '../domaine/types';

export const CATEGORIES_RESSOURCES: Record<CategorieRessource, { libelle: string; icone: NomIcone }> = {
  exercice: { libelle: 'Exercice', icone: 'crayon' },
  fiche: { libelle: 'Fiche pratique', icone: 'document' },
  lecture: { libelle: 'Lecture', icone: 'questionnaire' },
  autre: { libelle: 'Autre', icone: 'copier' },
};

export const MODELES_RESSOURCES: RessourceModifiable[] = [
  {
    titre: 'Respiration carrée',
    categorie: 'exercice',
    resume: 'Quatre temps égaux pour apaiser une montée d’angoisse.',
    contenu: [
      '# Quand l’utiliser',
      'Dès que vous sentez la tension monter, ou chaque soir pendant une semaine pour vous entraîner.',
      '',
      '# Comment faire',
      '- Inspirez par le nez en comptant jusqu’à 4.',
      '- Gardez l’air en comptant jusqu’à 4.',
      '- Expirez doucement par la bouche en comptant jusqu’à 4.',
      '- Restez poumons vides en comptant jusqu’à 4.',
      '- Recommencez 5 fois.',
      '',
      'Si compter jusqu’à 4 est difficile, commencez à 3 : l’important est que les quatre temps soient égaux.',
    ].join('\n'),
  },
  {
    titre: 'Journal des émotions',
    categorie: 'exercice',
    resume: 'Exercice à compléter : une émotion, ce qui l’a déclenchée et ce que vous avez fait.',
    contenu: [
      '# Ce soir, quelques lignes',
      'Inutile d’écrire beaucoup : quelques mots suffisent. Vos réponses me parviendront avant la prochaine séance.',
      '',
      '? Quelle émotion avez-vous ressentie le plus fort aujourd’hui ?',
      '? Que s’est-il passé juste avant ?',
      '? Où l’avez-vous sentie dans votre corps ?',
      '? Qu’avez-vous fait ensuite ? Qu’auriez-vous aimé faire ?',
      '',
      'Nous en reparlerons ensemble à la prochaine séance.',
    ].join('\n'),
  },
  {
    titre: 'Ancrage 5-4-3-2-1',
    categorie: 'fiche',
    resume: 'Revenir au moment présent par les cinq sens.',
    contenu: [
      '# Prenez le temps de repérer autour de vous',
      '- 5 choses que vous voyez,',
      '- 4 choses que vous pouvez toucher,',
      '- 3 sons que vous entendez,',
      '- 2 odeurs,',
      '- 1 goût.',
      '',
      'Nommez-les à voix basse si vous le pouvez. L’exercice dure une à deux minutes.',
    ].join('\n'),
  },
  {
    titre: 'La lettre que l’on n’envoie pas',
    categorie: 'exercice',
    resume: 'Écrire à quelqu’un ce que l’on n’a pas pu lui dire, sans lui envoyer.',
    contenu: [
      'Écrivez une lettre à la personne de votre choix, sans vous censurer : elle ne sera jamais envoyée.',
      '',
      '# Pistes',
      '- Ce que j’ai ressenti,',
      '- ce que j’aurais aimé recevoir,',
      '- ce que je souhaite pour moi aujourd’hui.',
      '',
      'Gardez la lettre ou détruisez-la, comme vous le sentez. Nous pourrons en parler en séance si vous le souhaitez.',
    ].join('\n'),
  },
];

export const MODES_REGLEMENT: Record<ModeReglement, string> = {
  especes: 'en espèces',
  cheque: 'par chèque',
  virement: 'par virement',
  carte: 'par carte bancaire',
  autre: 'autre moyen',
};
