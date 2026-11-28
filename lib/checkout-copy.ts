/**
 * The oDeliver page where a customer can check their exact delivery fee.
 * TODO(owner): replace null with the exact URL from the owner. Until then the sentence has no link.
 */
export const ODELIVER_FEE_URL: string | null = null;

/** Copy around the fee link. Only the word "here" is the link, when the URL is set. */
const FEE_LEAD = "If you would like to check your exact delivery fee before you place your order, click ";
const FEE_LINK_TEXT = "here";
const FEE_TRAIL = ".";

export type DeliveryFeeSentence = {
  lead: string;
  link: { text: string; href: string } | null;
  trail: string;
};

/** The fee sentence, split so that only the word "here" can be the link. */
export function deliveryFeeSentence(url: string | null): DeliveryFeeSentence {
  return {
    lead: FEE_LEAD,
    link: url ? { text: FEE_LINK_TEXT, href: url } : null,
    trail: FEE_TRAIL,
  };
}
