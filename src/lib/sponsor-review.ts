/** Every box on the sponsor approval form must be ticked. */
export const APPROVAL_CHECKS = [
  ["noSexual", "No nudity, sexual images, or sexual wording"],
  ["ownSite", "The link goes to the sponsor's own https website"],
  ["noMoney", "Not a cash, gifting, findom, or 'pay me' offer"],
  ["accurate", "The label and sponsor name are accurate"],
] as const;
