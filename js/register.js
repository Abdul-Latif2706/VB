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
        const STORAGE_KEY = typeof VB_STORAGE_KEY !== 'undefined' ? VB_STORAGE_KEY : 'velorian_bank_state_v5';
        let state = { clients: [], admin: { email: 'admin@velorianbank.com', password: 'Velorian@2026' } };
        try {
          const rawState = localStorage.getItem(STORAGE_KEY);
          if (rawState) state = JSON.parse(rawState);
        } catch (err) {}

        if (!Array.isArray(state.clients)) state.clients = [];

        // Check if email already exists
        const existing = state.clients.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
        if (existing) {
          throw new Error('An account with this email address already exists.');
        }

        // Generate a unique 10-digit account number
        const prefix = typeof ACCOUNT_PREFIX !== 'undefined' ? ACCOUNT_PREFIX : '1092';
        const accountNumber = prefix + Math.floor(100000 + Math.random() * 900000);
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
        
        if (typeof vbSaveState === 'function') {
          vbSaveState(state);
        } else {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        }

        // ================= RESEND EMAIL DISPATCH =================
        let emailSent = false;
        try {
          const resendApiKey = 're_fj6sKoaA_2uUKxcVvUKpoTB1sECeSwmQf'; // Replace with your actual Resend API Key (re_...)

          const emailResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${resendApiKey}`
            },
            body: JSON.stringify({
              from: 'Velorian Bank <accounts@velorianbank.com>', // Matches your verified domain or use onboarding@resend.dev for testing
              to: [email],
              subject: `Welcome to Velorian Bank, ${name}!`,
              html: `
                <div style="font-family: Arial, sans-serif; color: #333; line-height: 1.6; max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px;">
                  <h2 style="color: #0d253f;">Welcome to Velorian Bank</h2>
                  <p>Dear <strong>${name}</strong>,</p>
                  <p>Thank you for opening an account with Velorian Bank. Your digital account has been successfully created.</p>
                  
                  <div style="background-color: #f4f6f9; padding: 15px; border-radius: 6px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Account Number:</strong> ${accountNumber}</p>
                    <p style="margin: 5px 0;"><strong>Account Type:</strong> ${accountType}</p>
                    <p style="margin: 5px 0;"><strong>Currency:</strong> ${currency}</p>
                  </div>

                  <p>You can now sign in to your client portal using your registered email address and password.</p>
                  <p>Best regards,<br><strong>Velorian Bank Team</strong></p>
                </div>
              `
            })
          });

          if (emailResponse.ok) {
            emailSent = true;
          } else {
            const errorData = await emailResponse.json();
            console.error("Resend API Error:", errorData);
          }
        } catch (emailErr) {
          console.error("Resend dispatch failed:", emailErr);
        }

        form.reset();

        if (emailSent) {
          show(`Account created successfully! Your new account number is ${accountNumber}. A confirmation email has been sent to ${email}.`, 'success');
        } else {
          show(`Account created successfully! Your new account number is ${accountNumber}. You can now sign in (email delivery failed).`, 'warning');
        }
      }
    } catch (err) { 
      show(err.message || 'Unable to create the account. Please try again.'); 
    } finally { 
      btn.disabled = false; 
      btn.innerHTML = btn.dataset.original || 'Open my account <span>→</span>'; 
    }
  });
});