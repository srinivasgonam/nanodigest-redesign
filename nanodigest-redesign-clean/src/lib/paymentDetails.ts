/**
 * Bank transfer details shown on the checkout page.
 *
 * FILL THESE IN with the details your client gave you. Everything in this file
 * is visible to every visitor of the website, so only enter details the client
 * has agreed to show publicly. Never put passwords, PINs, OTPs, card numbers or
 * net-banking logins here.
 *
 * While accountNumber or ifsc is empty, the checkout page shows no bank section.
 */
export const bankTransfer = {
  accountName: 'Typical Creatives', // e.g. 'Nano Digest Publications'
  accountNumber: '1439115000002533', // e.g. '123456789012'
  ifsc: 'KVBL0001439', // e.g. 'SBIN0001234'
  bankName: 'The Karur Vysya Bank Ltd.', // e.g. 'State Bank of India'
  branch: 'New Nallakunta', // optional, e.g. 'Hyderabad Main Branch'
  accountType: 'Current', // optional, e.g. 'Current'
  upiId: '', // optional, e.g. 'nanodigest@sbi'

  /**
   * Optional. Email address that receives orders when no form backend is
   * connected (the GitHub Pages site). The customer's own email app opens with
   * the order filled in. Leave empty to disable.
   */
  orderEmail: 'typicalcreatives@gmail.com',
}

export const bankTransferEnabled = Boolean(
  bankTransfer.accountNumber.trim() && bankTransfer.ifsc.trim(),
)
