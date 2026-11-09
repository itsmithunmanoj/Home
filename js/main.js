/**
 * ==============================================================================
 * HOMESERVE PRO - PURE CLIENT-SIDE ENGINE
 * 100% localStorage based: No SQL, No Server, No Backend needed.
 * Just open index.html in any browser.
 * ==============================================================================
 *
 * localStorage Keys Used:
 *  - "hsp_users"          → array of all registered user objects
 *  - "hsp_session"        → currently logged-in user object (or null)
 *  - "hsp_bookings"       → array of all booking objects
 */

// ─────────────────────────────────────────────────────────
// STORAGE HELPERS (The "Database")
// ─────────────────────────────────────────────────────────

function DB_getUsers() {
  try { return JSON.parse(localStorage.getItem('hsp_users')) || []; }
  catch (e) { return []; }
}

function DB_saveUsers(users) {
  localStorage.setItem('hsp_users', JSON.stringify(users));
}

function DB_getUserByEmail(email) {
  return DB_getUsers().find(u => u.email === email.trim().toLowerCase()) || null;
}

function DB_addUser(user) {
  const users = DB_getUsers();
  users.push(user);
  DB_saveUsers(users);
}

function DB_getSession() {
  try { return JSON.parse(localStorage.getItem('hsp_session')) || null; }
  catch (e) { return null; }
}

function DB_setSession(user) {
  localStorage.setItem('hsp_session', user ? JSON.stringify(user) : 'null');
}

function DB_clearSession() {
  localStorage.removeItem('hsp_session');
}

function DB_getBookings() {
  try { return JSON.parse(localStorage.getItem('hsp_bookings')) || []; }
  catch (e) { return []; }
}

function DB_saveBookings(bookings) {
  localStorage.setItem('hsp_bookings', JSON.stringify(bookings));
}

function DB_addBooking(booking) {
  const bookings = DB_getBookings();
  bookings.unshift(booking);
  DB_saveBookings(bookings);
}

function DB_getBookingsByUserId(userId) {
  return DB_getBookings().filter(b => b.userId === userId);
}

function DB_updateBookingStatus(bookingId, newStatus) {
  const bookings = DB_getBookings();
  const index = bookings.findIndex(b => b.id === bookingId);
  if (index !== -1) bookings[index].status = newStatus;
  DB_saveBookings(bookings);
}

// Seed a default admin and one demo customer if localStorage is completely fresh
function DB_seed() {
  const users = DB_getUsers();
  if (users.length === 0) {
    DB_saveUsers([
      {
        id: 'admin_001',
        name: 'System Admin',
        email: 'admin@homeserve.com',
        phone: '800-555-4663',
        password: 'admin123',
        role: 'admin',
        createdAt: new Date().toISOString()
      }
    ]);
  }
}

// ─────────────────────────────────────────────────────────
// GLOBAL STATE
// ─────────────────────────────────────────────────────────

let currentUser = null;

const serviceData = {
  plumbing:   { name: 'Plumbing & Drain Repairs', basePrice: 89 },
  electrical: { name: 'Electrical & Lighting',    basePrice: 99 },
  cleaning:   { name: 'Deep Home Cleaning',        basePrice: 119 },
  hvac:       { name: 'HVAC Heating & AC',         basePrice: 109 },
  handyman:   { name: 'Handyman & Repairs',         basePrice: 79 },
  roofing:    { name: 'Roof & Gutter Service',      basePrice: 129 }
};

const bookingState = {
  currentStep: 1,
  service: { id: 'plumbing', name: 'Plumbing & Drain Repairs', basePrice: 89 },
  scope:   { name: 'Standard Diagnostic & Fix', price: 60 },
  urgency: { name: 'Standard (Next 1-2 Days)',  fee: 0 },
  discount: 20
};

// ─────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  DB_seed();

  // Restore session from storage if user was previously logged in
  currentUser = DB_getSession();

  renderAuthUI();
  initAuthSystem();
  initEstimatorModal();
  initMyBookingsModal();
  initAdminPortal();
  initFaqAccordion();
  initMobileNav();
  initQuickHeroForm();
});

// ─────────────────────────────────────────────────────────
// 1. AUTH UI RENDERER
// ─────────────────────────────────────────────────────────

function renderAuthUI() {
  const container = document.getElementById('navAuthContainer');
  const adminTopBtn = document.getElementById('adminTopBarBtn');
  if (!container) return;

  if (currentUser) {
    if (currentUser.role === 'admin') {
      container.innerHTML = `
        <div class="user-auth-badge" style="border-color:#38bdf8;background:#0f172a;color:#fff;">
          <span class="user-avatar-circle" style="background:#0284c7;">&#128081;</span>
          <span>Admin: ${esc(currentUser.name)}</span>
        </div>
        <button class="btn btn-outline open-admin-btn"
          style="padding:.5rem .9rem;font-size:.85rem;">Dashboard</button>
        <button class="btn btn-outline" onclick="handleLogout()"
          style="padding:.5rem .9rem;font-size:.85rem;">Sign Out</button>`;
      if (adminTopBtn) adminTopBtn.style.display = 'inline-flex';
    } else {
      const initials = currentUser.name.charAt(0).toUpperCase();
      container.innerHTML = `
        <div class="user-auth-badge">
          <span class="user-avatar-circle">${esc(initials)}</span>
          <span>Hi, ${esc(currentUser.name.split(' ')[0])}</span>
        </div>
        <button class="btn btn-track" onclick="openMyBookingsModal()"
          style="padding:.55rem .95rem;font-size:.88rem;">&#128203; My Bookings</button>
        <button class="btn btn-outline" onclick="handleLogout()"
          style="padding:.55rem .85rem;font-size:.88rem;">Sign Out</button>`;
      if (adminTopBtn) adminTopBtn.style.display = 'none';
    }
  } else {
    container.innerHTML = `
      <button class="btn btn-outline" onclick="openAuthModal('login')"
        style="padding:.55rem 1rem;font-size:.88rem;">Sign In</button>
      <button class="btn btn-primary" onclick="openAuthModal('register')"
        style="padding:.55rem 1rem;font-size:.88rem;">Register</button>`;
    if (adminTopBtn) adminTopBtn.style.display = 'inline-flex';
  }
}

// ─────────────────────────────────────────────────────────
// 2. AUTH SYSTEM (Register / Login / Logout)
// ─────────────────────────────────────────────────────────

function initAuthSystem() {
  const modal   = document.getElementById('authModal');
  const closeBtn = document.getElementById('closeAuthBtn');

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('authModal'));
  if (modal)    modal.addEventListener('click', e => { if (e.target === modal) closeModal('authModal'); });

  /* ── REGISTER FORM ── */
  const registerForm = document.getElementById('customerRegisterForm');
  if (registerForm) {
    registerForm.addEventListener('submit', e => {
      e.preventDefault();
      const alertId  = 'registerAuthAlert';
      const name     = document.getElementById('regName').value.trim();
      const email    = document.getElementById('regEmail').value.trim().toLowerCase();
      const phone    = document.getElementById('regPhone').value.trim();
      const password = document.getElementById('regPassword').value;
      const confirm  = document.getElementById('regConfirmPassword').value;

      showAlert(alertId, '', 'none');

      if (!name || !email || !phone || !password) {
        return showAlert(alertId, 'Please fill in all required fields.', 'error');
      }
      if (password.length < 6) {
        return showAlert(alertId, 'Password must be at least 6 characters.', 'error');
      }
      if (password !== confirm) {
        return showAlert(alertId, 'Passwords do not match.', 'error');
      }
      if (DB_getUserByEmail(email)) {
        return showAlert(alertId, 'An account with this email already exists. Please Sign In.', 'error');
      }

      // Save to localStorage "database"
      const newUser = {
        id:        'usr_' + Date.now(),
        name,
        email,
        phone,
        password,
        role:      'customer',
        createdAt: new Date().toISOString()
      };
      DB_addUser(newUser);

      // Auto sign-in after registration
      const sessionUser = { id: newUser.id, name, email, phone, role: 'customer' };
      DB_setSession(sessionUser);
      currentUser = sessionUser;
      renderAuthUI();
      closeModal('authModal');
      registerForm.reset();

      alert(`Welcome to HomeServe Pro, ${name}!\nYour account is saved. You can sign out and sign back in anytime.`);
    });
  }

  /* ── CUSTOMER LOGIN FORM ── */
  const loginForm = document.getElementById('customerLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', e => {
      e.preventDefault();
      const alertId  = 'customerAuthAlert';
      const email    = document.getElementById('loginEmail').value.trim().toLowerCase();
      const password = document.getElementById('loginPassword').value;

      showAlert(alertId, '', 'none');

      if (!email || !password) {
        return showAlert(alertId, 'Please enter your email and password.', 'error');
      }

      const user = DB_getUserByEmail(email);

      if (!user) {
        return showAlert(alertId,
          'No account found with this email. Please register first.', 'error');
      }
      if (user.password !== password) {
        return showAlert(alertId, 'Incorrect password. Please try again.', 'error');
      }
      if (user.role === 'admin') {
        return showAlert(alertId,
          'Admin accounts must use the Admin Login tab.', 'error');
      }

      // Success
      const sessionUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: 'customer' };
      DB_setSession(sessionUser);
      currentUser = sessionUser;
      renderAuthUI();
      closeModal('authModal');
      loginForm.reset();
    });
  }

  /* ── ADMIN LOGIN FORM ── */
  const adminForm = document.getElementById('adminLoginForm');
  if (adminForm) {
    adminForm.addEventListener('submit', e => {
      e.preventDefault();
      const alertId  = 'adminAuthAlert';
      const email    = document.getElementById('adminLoginEmail').value.trim().toLowerCase();
      const password = document.getElementById('adminLoginPassword').value;

      showAlert(alertId, '', 'none');

      const user = DB_getUserByEmail(email);

      if (!user) {
        return showAlert(alertId, 'No admin account found with this email.', 'error');
      }
      if (user.role !== 'admin') {
        return showAlert(alertId, 'This account does not have admin privileges.', 'error');
      }
      if (user.password !== password) {
        return showAlert(alertId, 'Incorrect admin password.', 'error');
      }

      // Success
      const sessionUser = { id: user.id, name: user.name, email: user.email, phone: user.phone, role: 'admin' };
      DB_setSession(sessionUser);
      currentUser = sessionUser;
      renderAuthUI();
      closeModal('authModal');
      adminForm.reset();
      openModal('adminModal');
      renderAdminDashboard();
    });
  }
}

function handleLogout() {
  DB_clearSession();
  currentUser = null;
  renderAuthUI();
  closeModal('adminModal');
  closeModal('myBookingsModal');
}

window.openAuthModal = function(tab = 'login') {
  openModal('authModal');
  switchAuthTab(tab);
};

window.switchAuthTab = function(tab) {
  document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.auth-form-panel').forEach(p => p.style.display = 'none');
  const btn   = document.getElementById('tabBtn-' + tab);
  const panel = document.getElementById('panel-' + tab);
  if (btn)   btn.classList.add('active');
  if (panel) panel.style.display = 'block';
};

// ─────────────────────────────────────────────────────────
// 3. BOOKING ESTIMATOR MODAL
// ─────────────────────────────────────────────────────────

function initEstimatorModal() {
  const backdrop = document.getElementById('bookingModal');
  const closeBtn = document.getElementById('closeModalBtn');
  const nextBtn  = document.getElementById('modalNextBtn');
  const backBtn  = document.getElementById('modalBackBtn');
  const confirmBtn = document.getElementById('confirmBookingBtn');

  if (!backdrop) return;

  document.querySelectorAll('.open-estimator-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const svc = btn.getAttribute('data-service');
      if (svc && serviceData[svc]) selectService(svc);
      openModal('bookingModal');
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('bookingModal'));
  backdrop.addEventListener('click', e => { if (e.target === backdrop) closeModal('bookingModal'); });

  if (nextBtn)    nextBtn.addEventListener('click',    () => { if (bookingState.currentStep < 3) goToStep(bookingState.currentStep + 1); });
  if (backBtn)    backBtn.addEventListener('click',    () => { if (bookingState.currentStep > 1) goToStep(bookingState.currentStep - 1); });
  if (confirmBtn) confirmBtn.addEventListener('click', handleBookingSubmit);

  // Service cards
  document.querySelectorAll('.modal-option-card').forEach(card => {
    card.addEventListener('click', () => selectService(card.getAttribute('data-service-id')));
  });

  // Scope rows
  document.querySelectorAll('.scope-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.scope-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      bookingState.scope = {
        name:  row.getAttribute('data-scope-name') || '',
        price: parseInt(row.getAttribute('data-scope-price'), 10) || 0
      };
      updatePriceCalc();
    });
  });

  // Urgency rows
  document.querySelectorAll('.urgency-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.urgency-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      bookingState.urgency = {
        name: row.getAttribute('data-urgency-name') || '',
        fee:  parseInt(row.getAttribute('data-urgency-fee'), 10) || 0
      };
      updatePriceCalc();
    });
  });

  updatePriceCalc();
}

function selectService(id) {
  if (!serviceData[id]) return;
  bookingState.service = { id, name: serviceData[id].name, basePrice: serviceData[id].basePrice };
  document.querySelectorAll('.modal-option-card').forEach(c => {
    c.classList.toggle('selected', c.getAttribute('data-service-id') === id);
  });
  updatePriceCalc();
}

function updatePriceCalc() {
  const sub   = bookingState.service.basePrice + bookingState.scope.price + bookingState.urgency.fee;
  const total = Math.max(0, sub - bookingState.discount);
  const set   = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('summaryServiceName', bookingState.service.name);
  set('summaryBasePrice',   '$' + (bookingState.service.basePrice + bookingState.scope.price));
  set('summaryUrgencyFee',  bookingState.urgency.fee > 0 ? '+$' + bookingState.urgency.fee : '$0');
  set('summaryDiscount',    '-$' + bookingState.discount);
  set('summaryTotalPrice',  '$' + total);
}

function goToStep(stepNum) {
  // If going to step 3 and not logged in, force register/login
  if (stepNum === 3 && !currentUser) {
    if (confirm('You need to be signed in to confirm a booking.\nWould you like to sign in or register now?')) {
      closeModal('bookingModal');
      openAuthModal('register');
    }
    return;
  }

  bookingState.currentStep = stepNum;

  document.querySelectorAll('.modal-step-content').forEach((el, i) => {
    el.style.display = (i + 1 === stepNum) ? 'block' : 'none';
  });
  document.querySelectorAll('.modal-step-pill').forEach((pill, i) => {
    pill.classList.toggle('active', i + 1 <= stepNum);
  });

  const show = (id, vis) => { const el = document.getElementById(id); if (el) el.style.display = vis; };
  show('modalBackBtn',       stepNum > 1       ? 'inline-flex' : 'none');
  show('modalNextBtn',       stepNum < 3       ? 'inline-flex' : 'none');
  show('confirmBookingBtn',  stepNum === 3     ? 'inline-flex' : 'none');

  // Pre-fill from current user
  if (stepNum === 3 && currentUser) {
    const nameEl  = document.getElementById('clientName');
    const phoneEl = document.getElementById('clientPhone');
    if (nameEl  && !nameEl.value)  nameEl.value  = currentUser.name;
    if (phoneEl && !phoneEl.value) phoneEl.value = currentUser.phone;
  }
}

function handleBookingSubmit() {
  if (!currentUser) {
    alert('Please sign in to confirm your booking.');
    closeModal('bookingModal');
    openAuthModal('login');
    return;
  }

  const name    = document.getElementById('clientName')?.value.trim();
  const phone   = document.getElementById('clientPhone')?.value.trim();
  const address = document.getElementById('clientAddress')?.value.trim() || 'On file';
  const zip     = document.getElementById('clientZip')?.value.trim()     || '';

  if (!name || !phone) {
    alert('Please enter your full name and phone number.');
    return;
  }

  const sub   = bookingState.service.basePrice + bookingState.scope.price + bookingState.urgency.fee;
  const total = Math.max(0, sub - bookingState.discount);
  const id    = 'HSP-' + Math.floor(100000 + Math.random() * 900000);

  const booking = {
    id,
    userId:        currentUser.id,
    customerName:  name,
    phone,
    service:       bookingState.service.name,
    scope:         bookingState.scope.name,
    urgency:       bookingState.urgency.name,
    scheduledDate: bookingState.urgency.fee > 0 ? 'Today — Rush Dispatch (within 3 hrs)' : 'Tomorrow, 9:00 AM – 12:00 PM',
    address,
    zip,
    totalPrice:    total,
    status:        'Confirmed',
    proAssigned:   'Nearby Certified Pro (Assigned)',
    createdAt:     new Date().toISOString()
  };

  DB_addBooking(booking);

  // Show success screen inside modal
  const main = document.querySelector('#bookingModal .modal-main');
  if (main) {
    main.innerHTML = `
      <div style="text-align:center;padding:2.5rem 1rem;">
        <div style="width:68px;height:68px;border-radius:50%;background:#ecfdf5;color:#10b981;display:inline-flex;align-items:center;justify-content:center;font-size:2.2rem;margin-bottom:1.25rem;">&#10003;</div>
        <h3 style="font-size:1.6rem;color:#0f172a;margin-bottom:.5rem;">Booking Confirmed!</h3>
        <p style="color:#64748b;margin-bottom:1.5rem;font-size:.98rem;">
          Your booking is saved in your browser. Sign out and sign back in anytime to view it.
        </p>
        <div style="background:#f8fafc;border:1.5px dashed #0284c7;border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;text-align:left;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:.5rem;">
            <span style="font-size:.78rem;text-transform:uppercase;color:#64748b;font-weight:700;">Reference</span>
            <span style="font-size:1.25rem;font-weight:800;color:#0284c7;">${id}</span>
          </div>
          <div style="font-size:.9rem;color:#0f172a;margin-bottom:.25rem;"><strong>Service:</strong> ${esc(booking.service)}</div>
          <div style="font-size:.9rem;color:#0f172a;margin-bottom:.25rem;"><strong>Arrival Window:</strong> ${esc(booking.scheduledDate)}</div>
          <div style="font-size:.9rem;color:#0f172a;"><strong>Total Locked Price:</strong> $${total}</div>
        </div>
        <div style="display:flex;gap:.75rem;justify-content:center;">
          <button class="btn btn-primary" onclick="closeModal('bookingModal');openMyBookingsModal();">View My Bookings</button>
          <button class="btn btn-outline" onclick="closeModal('bookingModal');">Done</button>
        </div>
      </div>`;
  }
}

// ─────────────────────────────────────────────────────────
// 4. CUSTOMER "MY BOOKINGS" MODAL
// ─────────────────────────────────────────────────────────

function initMyBookingsModal() {
  const modal   = document.getElementById('myBookingsModal');
  const closeBtn = document.getElementById('closeMyBookingsBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('myBookingsModal'));
  if (modal)    modal.addEventListener('click', e => { if (e.target === modal) closeModal('myBookingsModal'); });
}

window.openMyBookingsModal = function() {
  if (!currentUser) { openAuthModal('login'); return; }
  openModal('myBookingsModal');

  const container = document.getElementById('myBookingsListContainer');
  if (!container) return;

  const bookings = DB_getBookingsByUserId(currentUser.id);

  if (bookings.length === 0) {
    container.innerHTML = `
      <div style="text-align:center;padding:3rem 1rem;color:#64748b;">
        <span style="font-size:2.5rem;display:block;margin-bottom:.75rem;">&#128203;</span>
        <h4 style="font-size:1.2rem;color:#0f172a;">No Bookings Yet</h4>
        <p style="font-size:.9rem;margin:.5rem 0 1.5rem;">You haven't scheduled any services yet.</p>
        <button class="btn btn-primary" onclick="closeModal('myBookingsModal');openModal('bookingModal');">
          Book a Service Now
        </button>
      </div>`;
    return;
  }

  container.innerHTML = bookings.map(b => {
    const sc = (b.status || 'Confirmed').toLowerCase();
    return `
      <div class="booking-item-card">
        <div class="booking-item-header">
          <div>
            <span style="font-size:.75rem;text-transform:uppercase;font-weight:700;color:#64748b;">Reference</span>
            <h4 style="font-size:1.15rem;color:#0284c7;">${b.id}</h4>
          </div>
          <span class="status-badge ${sc}">&#9679; ${esc(b.status)}</span>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:.75rem;font-size:.88rem;margin-bottom:1rem;">
          <div><span style="font-size:.75rem;color:#64748b;display:block;">Service</span><strong>${esc(b.service)}</strong></div>
          <div><span style="font-size:.75rem;color:#64748b;display:block;">Arrival Window</span><strong style="color:#0284c7;">${esc(b.scheduledDate)}</strong></div>
          <div><span style="font-size:.75rem;color:#64748b;display:block;">Address</span><strong>${esc(b.address)}, ${esc(b.zip)}</strong></div>
          <div><span style="font-size:.75rem;color:#64748b;display:block;">Total Price</span><strong style="color:#059669;font-size:1.05rem;">$${b.totalPrice}</strong></div>
        </div>
        <div style="font-size:.82rem;color:#64748b;background:#fff;padding:.6rem .85rem;border-radius:8px;border:1px solid #e2e8f0;">
          &#128119; <strong>Pro:</strong> ${esc(b.proAssigned)}
        </div>
      </div>`;
  }).join('');
};

// ─────────────────────────────────────────────────────────
// 5. ADMIN DISPATCH DASHBOARD
// ─────────────────────────────────────────────────────────

function initAdminPortal() {
  const closeBtn = document.getElementById('closeAdminBtn');
  const modal    = document.getElementById('adminModal');

  document.querySelectorAll('.open-admin-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      if (!currentUser || currentUser.role !== 'admin') {
        openAuthModal('admin');
        return;
      }
      openModal('adminModal');
      renderAdminDashboard();
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('adminModal'));
  if (modal)    modal.addEventListener('click', e => { if (e.target === modal) closeModal('adminModal'); });
}

function renderAdminDashboard() {
  const tbody        = document.getElementById('adminBookingsTableBody');
  const totalEl      = document.getElementById('adminTotalBookingsCount');
  const revenueEl    = document.getElementById('adminTotalRevenue');
  const activeEl     = document.getElementById('adminActiveDispatchCount');
  if (!tbody) return;

  const allBookings = DB_getBookings();
  let totalRev = 0, activeCount = 0;

  tbody.innerHTML = '';

  if (allBookings.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:2rem;color:#64748b;">No bookings yet.</td></tr>';
  } else {
    allBookings.forEach(b => {
      totalRev += parseFloat(b.totalPrice || 0);
      if (b.status === 'Confirmed' || b.status === 'Dispatched') activeCount++;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(b.id)}</strong><br><small style="color:#64748b;">${(b.createdAt||'').slice(0,10)}</small></td>
        <td><strong>${esc(b.customerName)}</strong><br><a href="tel:${esc(b.phone)}" style="color:#0284c7;font-size:.85rem;">&#128222; ${esc(b.phone)}</a></td>
        <td><strong>${esc(b.service)}</strong><br><small style="color:#64748b;">${esc(b.address||'')}</small></td>
        <td><span style="font-size:.85rem;">${esc(b.scheduledDate)}</span></td>
        <td><strong style="color:#059669;">$${b.totalPrice}</strong></td>
        <td>
          <select class="status-select" onchange="adminUpdateStatus('${b.id}', this.value)">
            <option value="Confirmed"  ${b.status==='Confirmed'  ? 'selected' : ''}>Confirmed</option>
            <option value="Dispatched" ${b.status==='Dispatched' ? 'selected' : ''}>Dispatched</option>
            <option value="Completed"  ${b.status==='Completed'  ? 'selected' : ''}>Completed</option>
            <option value="Cancelled"  ${b.status==='Cancelled'  ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>`;
      tbody.appendChild(tr);
    });
  }

  if (totalEl)   totalEl.textContent   = allBookings.length;
  if (revenueEl) revenueEl.textContent = '$' + totalRev.toLocaleString();
  if (activeEl)  activeEl.textContent  = activeCount;
}

window.adminUpdateStatus = function(bookingId, newStatus) {
  DB_updateBookingStatus(bookingId, newStatus);
  renderAdminDashboard();
};

// ─────────────────────────────────────────────────────────
// 6. GENERAL MODAL HELPERS
// ─────────────────────────────────────────────────────────

function openModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.add('open'); document.body.style.overflow = 'hidden'; }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) { el.classList.remove('open'); document.body.style.overflow = ''; }
}

// ─────────────────────────────────────────────────────────
// 7. OTHER UI INTERACTIONS
// ─────────────────────────────────────────────────────────

function initQuickHeroForm() {
  const form = document.getElementById('heroQuickForm');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const sel = document.getElementById('heroServiceSelect');
    if (sel && sel.value) selectService(sel.value);
    openModal('bookingModal');
  });
}

function initFaqAccordion() {
  document.querySelectorAll('.faq-item').forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('active');
      document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
      if (!isOpen) item.classList.add('active');
    });
  });
}

function initMobileNav() {
  const toggleBtn = document.querySelector('.mobile-toggle-btn');
  const navMenu   = document.querySelector('.nav-menu');
  if (!toggleBtn || !navMenu) return;
  toggleBtn.addEventListener('click', () => navMenu.classList.toggle('active'));
  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navMenu.classList.remove('active'));
  });
}

function showAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  if (type === 'none') { el.style.display = 'none'; return; }
  el.className = 'auth-alert-box ' + type;
  el.textContent = msg;
  el.style.display = 'block';
}

function esc(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
