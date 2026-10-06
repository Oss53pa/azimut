/**
 * J4 et R7.4 — l'annotation en révision, dans le panneau de détail du
 * tableau des messages.
 *
 * Fragment à part : `message-table.ts` approche des 400 lignes que A2.4 fixe.
 */
export const REVIEW_FR = {
  'review.list.label': 'Annotations de la ligne',
  'review.state.open': 'Ouverte',
  'review.state.resolved': 'Traitée',
  'review.state.rejected': 'Refusée',
  'review.new.body': 'Nouvelle remarque',
  'review.new.ink': 'Tracé au stylet (facultatif)',
  'review.new.ink_clear': 'Effacer le tracé',
  'review.new.submit': 'Annoter',
  'review.new.submit_selection': 'Annoter les {count} lignes sélectionnées',
  'review.new.empty': 'Écrivez une remarque ou tracez-la : une annotation vide n’est pas enregistrée.',
  'review.ink.touch_refused': 'Le tracé au doigt n’est pas proposé : écrivez au stylet ou à la souris, ou au clavier.',
  'review.ink.note': 'Note manuscrite',
  'review.reply.label': 'Répondre',
  'review.reply.submit': 'Envoyer la réponse',
  'review.action.resolve': 'Traiter',
  'review.action.reject': 'Refuser',
  'review.action.reopen': 'Rouvrir',
  'review.read_only': 'Votre rôle consulte les annotations sans en poser.',
  'review.blocking': '{count} annotation(s) ouverte(s) sur ce tableau : l’approbation reste bloquée tant qu’elles ne sont ni traitées ni refusées.',
  'review.offline': 'Hors ligne : l’annotation est gardée sur ce poste et partira au retour du réseau.',
};

export const REVIEW_EN: Readonly<Record<keyof typeof REVIEW_FR, string>> = {
  'review.list.label': 'Line annotations',
  'review.state.open': 'Open',
  'review.state.resolved': 'Resolved',
  'review.state.rejected': 'Rejected',
  'review.new.body': 'New remark',
  'review.new.ink': 'Stylus note (optional)',
  'review.new.ink_clear': 'Clear the note',
  'review.new.submit': 'Annotate',
  'review.new.submit_selection': 'Annotate the {count} selected lines',
  'review.new.empty': 'Write or draw a remark: an empty annotation is not saved.',
  'review.ink.touch_refused': 'Drawing with a finger is not offered: write with a stylus or a mouse, or type.',
  'review.ink.note': 'Handwritten note',
  'review.reply.label': 'Reply',
  'review.reply.submit': 'Send the reply',
  'review.action.resolve': 'Resolve',
  'review.action.reject': 'Reject',
  'review.action.reopen': 'Reopen',
  'review.read_only': 'Your role reads annotations without adding any.',
  'review.blocking': '{count} open annotation(s) on this schedule: approval stays blocked until they are resolved or rejected.',
  'review.offline': 'Offline: the annotation is kept on this device and will be sent when the network is back.',
};
