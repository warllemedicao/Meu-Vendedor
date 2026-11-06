(() => {
  if (location.hostname === 'accounts.google.com') return { email: null, credits: null, editor: false, loginRequired: true };
  if (location.hostname !== 'flow.google.com' && !(location.hostname === 'labs.google' && location.pathname.startsWith('/fx'))) return { email: null, credits: null, editor: false };
  const labels = Array.from(document.querySelectorAll('[aria-label],[title]')).slice(0, 1000).map(e => e.getAttribute('aria-label') || e.getAttribute('title') || '');
  const accountLabels = labels.filter(s => /google.*(account|conta)|(account|conta).*google/i.test(s));
  const emails = [...new Set(accountLabels.flatMap(s => s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/ig) || []))];
  const creditNodes = Array.from(document.querySelectorAll('button,[role="menuitem"],span')).slice(0, 2000).map(e => e.textContent?.trim() || '').filter(s => /^\d+\s+(credits|créditos)$/i.test(s));
  const amounts = [...new Set(creditNodes.map(s => Number(s.match(/^\d+/)[0])))];
  const loginRequired = Array.from(document.querySelectorAll('button,a')).some(e => /^(sign in|log in|fazer login|entrar|sign in with google|continue with google)$/i.test(e.textContent.trim()));
  return { email: emails.length === 1 ? emails[0] : null, credits: amounts.length === 1 ? amounts[0] : null, editor: Boolean(document.querySelector('[contenteditable="true"],textarea')), loginRequired };
})()