/** The message prefilled in the WhatsApp "questions about this order" link. */
export function orderQuestionText(orderNumber: string): string {
  return `Hi, I have a question about order ${orderNumber}.`;
}
