document.addEventListener('DOMContentLoaded', () => {
  const $ = s => document.querySelector(s), 
        form = $('#registerForm'), 
        msg = $('#registerMessage');
  
  if (!form || !msg) return;

  const show = (text, type = 'error') => {
    msg.textContent = text;
    msg.className = `form-error show full-field ${type}`;
  };

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#regName').value.trim(),
          email = $('#regEmail').value.trim(),
          country = $('#regCountry').value.trim(),
          phone = $('#regPhone').value.trim(),
          accountType = $('#regAccountType').value,
          currency = $('#regCurrency').value,
          password = $('#regPassword').value,
          confirm = $('#regConfirm').value;

    if (password !== confirm) return show('Passwords do not match.');
    if (password.length < 8) return show('Password must contain at least 8 characters.');
    if (!$('#regAgree').checked) return show('Please accept the account-opening terms to continue.');

    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true; 
    btn.dataset.original = btn.innerHTML; 
    btn.innerHTML = 'Creating secure account…';

    try {
      // Check if online API is active; if not, use local offline mode registration
      if (typeof vbOnlineEnabled === 'function' && vbOnlineEnabled()) {
        const r = await vbOnlineRegister({name, email, country, phone, accountType, currency, password});
        if (r.client) vbMergeRemoteClients([r.client]);
        form.reset();
        show(r.emailSent ? `Account created successfully. Your account number is ${r.client.accountNumber}. A confirmation email has been sent to ${r.client.email}.` : `Account created successfully. Your account number is ${r.client.accountNumber}. Email delivery still needs to be configured by the bank administrator.`, r.emailSent ? 'success' : 'warning');
      } else {
        // ================= OFFLINE / LOCAL STORAGE REGISTRATION =================
        let state = { clients: [], admin: { email: 'admin@velorianbank.com', password: 'password123' } };
        try {
          const rawState = localStorage.getItem('velorian_state');
          if (rawState) state = JSON.parse(rawState);
        } catch (err) {}

        if (!Array.isArray(state.clients)) state.clients = [];

        // Check if email already exists
        const existing = state.clients.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (existing) {
          throw new Error('An account with this email address already exists.');
        }

        // Generate a unique 10-digit account number
        const accountNumber = '10' + Math.floor(10000000 + Math.random() * 90000000);
        const clientId = 'client_' + Date.now();

        const newClient = {
          id: clientId,
          name,
          email,
          country,
          phone,
          accountType,
          currency,
          accountNumber,
          balance: 0,
          status: 'Active',
          password,
          createdAt: new Date().toISOString()
        };

        state.clients.push(newClient);
        localStorage.setItem('velorian_state', JSON.stringify(state));

        form.reset();
        show(`Account created successfully! Your new account number is ${accountNumber}. You can now log into your client portal.`, 'success');
      }
    } catch (err) { 
      show(err.message || 'Unable to create the account. Please try again.'); 
    } finally { 
      btn.disabled = false; 
      btn.innerHTML = btn.dataset.original || 'Open my account <span>→</span>'; 
    }
  });
});