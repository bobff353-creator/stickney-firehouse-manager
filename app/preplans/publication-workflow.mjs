export const publicationTransitions = Object.freeze({
  draft: Object.freeze({ submitReview: "in_review" }),
  in_review: Object.freeze({ returnDraft: "draft", publish: "published" }),
  published: Object.freeze({
    returnDraft: "draft",
    publish: "published",
    archive: "archived",
  }),
  archived: Object.freeze({ returnDraft: "draft" }),
});

export function normalizedPublicationStatus(value) {
  const status = String(value ?? "published").trim().toLowerCase();
  return Object.hasOwn(publicationTransitions, status) ? status : "published";
}

export function publicationActionsFor(value) {
  return Object.keys(publicationTransitions[normalizedPublicationStatus(value)]);
}

export function nextPublicationStatus(currentStatus, action) {
  return publicationTransitions[normalizedPublicationStatus(currentStatus)][action] ?? null;
}
