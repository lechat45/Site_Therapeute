// Libellés des tâches personnelles récurrentes.

import type { Recurrence } from '../domaine/types';

export const RECURRENCES: Record<Recurrence, string> = {
  aucune: 'Jamais',
  semaine: 'Chaque semaine',
  mois: 'Chaque mois',
};
