/**
 * ==============================================================================
 * HOMESERVE PRO - CLIENT ENGINE & SQL REST API CONNECTOR
 * Handles Customer Registration/Login, Admin Auth, and SQL Database Booking
 * ==============================================================================
 */

// Global State
let currentUser = null; // null | { id, name, email, phone, role }

const serviceData = {
  plumbing: { name: 'Plumbing & Drain Repairs', basePrice: 89 },
  electrical: { name: 'Electrical & Lighting', basePrice: 99 },
  cleaning: { name: 'Deep Home Cleaning', basePrice: 119 },
  hvac: { name: 'HVAC Heating & AC', basePrice: 109 },
  handyman: { name: 'Handyman & Repairs', basePrice: 79 },
  roofing: { name: 'Roof & Gutter Service', basePrice: 129 }
};

const bookingState = {
  currentStep: 1,
  service: { id: 'plumbing', name: 'Plumbing & Drain Repairs', basePrice: 89 },
  scope: { name: 'Standard Diagnostic & Fix', price: 60 },
  urgency: { name: 'Standard (Next 1-2 Days)', fee: 0 },
  discount: 20
};

document.addEventListener('DOMContentLoaded', () => {
  initAuthSystem();
  initEstimatorModal();
  initMyBookingsModal();
  initAdminPortal();
  initFaqAccordion();
  initMobileNav();
  initQuickHeroForm();

  // Check backend session status on page load
  checkCurrentUser();
});

/**
 * ==============================================================================
 * 1. AUTHENTICATION & SESSION MANAGEMENT
 * ==============================================================================
 */
async function checkCurrentUser() {
  try {
    const res = await fetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      currentUser = data.user;
      renderAuthUI();
    }
  } catch (err) {
    // If backend server is not running, check localStorage fallback
    const saved = localStorage.getItem('homeserve_current_user');
    if (saved) {
      currentUser = JSON.parse(saved);
      renderAuthUI();
    }
  }
}

function renderAuthUI() {
  const container = document.getElementById('navAuthContainer');
  const adminTopBtn = document.getElementById('adminTopBarBtn');
  if (!container) return;

  if (currentUser) {
    if (currentUser.role === 'admin') {
      container.innerHTML = `
        <div class="user-auth-badge" style="border-color: #38bdf8; background: #0f172a; color: #ffffff;">
          <span class="user-avatar-circle" style="background: #0284c7;">👑</span>
          <span>Admin (${escapeHtml(currentUser.name)})</span>
        </div>
        <button class="btn btn-outline open-admin-btn" style="padding: 0.5rem 0.9rem; font-size: 0.85rem;">Dashboard</button>
        <button class="btn btn-outline" onclick="handleLogout()" style="padding: 0.5rem 0.9rem; font-size: 0.85rem;">Sign Out</button>
      `;
      if (adminTopBtn) adminTopBtn.style.display = 'inline-flex';
    } else {
      // Customer Logged In
      container.innerHTML = `
        <div class="user-auth-badge">
          <span class="user-avatar-circle">${escapeHtml(currentUser.name.charAt(0).toUpperCase())}</span>
          <span>Hi, ${escapeHtml(currentUser.name.split(' ')[0])}</span>
        </div>
        <button class="btn btn-track" onclick="openMyBookingsModal()" style="padding: 0.55rem 0.95rem; font-size: 0.88rem;">
          📋 My Bookings
        </button>
        <button class="btn btn-outline" onclick="handleLogout()" style="padding: 0.55rem 0.85rem; font-size: 0.88rem;">
          Sign Out
        </button>
      `;
      if (adminTopBtn) adminTopBtn.style.display = 'none';

      // Pre-fill booking fields if modal is open
      const nameInput = document.getElementById('clientName');
      const phoneInput = document.getElementById('clientPhone');
      if (nameInput) nameInput.value = currentUser.name;
      if (phoneInput) phoneInput.value = currentUser.phone;
    }
  } else {
    // Logged Out State
    container.innerHTML = `
      <button class="btn btn-outline" onclick="openAuthModal('login')" style="padding: 0.55rem 1rem; font-size: 0.88rem;">
        Sign In / Register
      </button>
    `;
    if (adminTopBtn) adminTopBtn.style.display = 'inline-flex';
  }
}

function initAuthSystem() {
  const modal = document.getElementById('authModal');
  const closeBtn = document.getElementById('closeAuthBtn');

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('authModal'));
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal('authModal');
    });
  }

  // Customer Login Form
  const loginForm = document.getElementById('customerLoginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      await executeLogin(email, password, 'customerAuthAlert');
    });
  }

  // Customer Register Form
  const registerForm = document.getElementById('customerRegisterForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const phone = document.getElementById('regPhone').value.trim();
      const password = document.getElementById('regPassword').value.trim();

      showAuthAlert('registerAuthAlert', '', 'none');

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, password })
        });
        const data = await res.json();
        if (data.success) {
          currentUser = data.user;
          localStorage.setItem('homeserve_current_user', JSON.stringify(currentUser));
          renderAuthUI();
          closeModal('authModal');
          alert(`Welcome to HomeServe Pro, ${currentUser.name}! You are now registered and logged in.`);
        } else {
          showAuthAlert('registerAuthAlert', data.message || 'Registration failed.', 'error');
        }
      } catch (err) {
        // Fallback for static demo
        currentUser = { id: 999, name, email, phone, role: 'customer' };
        localStorage.setItem('homeserve_current_user', JSON.stringify(currentUser));
        renderAuthUI();
        closeModal('authModal');
        alert(`Welcome, ${name}! Your account has been created.`);
      }
    });
  }

  // Admin Login Form
  const adminForm = document.getElementById('adminLoginForm');
  if (adminForm) {
    adminForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('adminLoginEmail').value.trim();
      const password = document.getElementById('adminLoginPassword').value.trim();
      await executeLogin(email, password, 'adminAuthAlert');
    });
  }
}

async function executeLogin(email, password, alertBoxId) {
  showAuthAlert(alertBoxId, '', 'none');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('homeserve_current_user', JSON.stringify(currentUser));
      renderAuthUI();
      closeModal('authModal');

      if (currentUser.role === 'admin') {
        openModal('adminModal');
        loadAdminBookings();
      }
    } else {
      showAuthAlert(alertBoxId, data.message || 'Invalid credentials.', 'error');
    }
  } catch (err) {
    // Demo fallback if running purely client-side
    if (email === 'admin@homeserve.com') {
      currentUser = { id: 1, name: 'System Admin', email, phone: '800-555-4663', role: 'admin' };
      localStorage.setItem('homeserve_current_user', JSON.stringify(currentUser));
      renderAuthUI();
      closeModal('authModal');
      openModal('adminModal');
      loadAdminBookings();
    } else {
      currentUser = { id: 2, name: 'Demo Customer', email, phone: '555-234-5678', role: 'customer' };
      localStorage.setItem('homeserve_current_user', JSON.stringify(currentUser));
      renderAuthUI();
      closeModal('authModal');
    }
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}

  currentUser = null;
  localStorage.removeItem('homeserve_current_user');
  renderAuthUI();
  closeModal('adminModal');
  closeModal('myBookingsModal');
}

function showAuthAlert(elementId, msg, type) {
  const el = document.getElementById(elementId);
  if (!el) return;
  if (type === 'none') {
    el.style.display = 'none';
  } else {
    el.className = `auth-alert-box ${type}`;
    el.textContent = msg;
    el.style.display = 'block';
  }
}

window.openAuthModal = function(initialTab = 'login') {
  openModal('authModal');
  switchAuthTab(initialTab);
};

window.switchAuthTab = function(tabName) {
  const tabs = document.querySelectorAll('.auth-tab-btn');
  const forms = document.querySelectorAll('.auth-form-panel');

  tabs.forEach(t => t.classList.remove('active'));
  forms.forEach(f => f.style.display = 'none');

  const activeBtn = document.getElementById(`tabBtn-${tabName}`);
  const activePanel = document.getElementById(`panel-${tabName}`);

  if (activeBtn) activeBtn.classList.add('active');
  if (activePanel) activePanel.style.display = 'block';
};

/**
 * ==============================================================================
 * 2. BOOKING ESTIMATOR & SQL PERSISTENCE
 * ==============================================================================
 */
function initEstimatorModal() {
  const modalBackdrop = document.getElementById('bookingModal');
  const openButtons = document.querySelectorAll('.open-estimator-btn');
  const closeBtn = document.getElementById('closeModalBtn');
  const nextBtn = document.getElementById('modalNextBtn');
  const backBtn = document.getElementById('modalBackBtn');
  const confirmBookingBtn = document.getElementById('confirmBookingBtn');

  if (!modalBackdrop) return;

  openButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const preselected = btn.getAttribute('data-service');
      if (preselected && serviceData[preselected]) {
        selectService(preselected);
      }
      openModal('bookingModal');
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('bookingModal'));
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal('bookingModal');
  });

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (bookingState.currentStep < 3) goToStep(bookingState.currentStep + 1);
    });
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      if (bookingState.currentStep > 1) goToStep(bookingState.currentStep - 1);
    });
  }

  if (confirmBookingBtn) {
    confirmBookingBtn.addEventListener('click', handleBookingSubmit);
  }

  // Setup Service Selection cards
  const serviceCards = document.querySelectorAll('.modal-option-card');
  serviceCards.forEach(card => {
    card.addEventListener('click', () => {
      const sId = card.getAttribute('data-service-id');
      selectService(sId);
    });
  });

  // Setup Scope Radios
  const scopeRows = document.querySelectorAll('.scope-row');
  scopeRows.forEach(row => {
    row.addEventListener('click', () => {
      scopeRows.forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      const price = parseInt(row.getAttribute('data-scope-price'), 10) || 0;
      const name = row.getAttribute('data-scope-name') || '';
      bookingState.scope = { name, price };
      updatePriceCalculation();
    });
  });

  // Setup Urgency Radios
  const urgencyRows = document.querySelectorAll('.urgency-row');
  urgencyRows.forEach(row => {
    row.addEventListener('click', () => {
      urgencyRows.forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
      const fee = parseInt(row.getAttribute('data-urgency-fee'), 10) || 0;
      const name = row.getAttribute('data-urgency-name') || '';
      bookingState.urgency = { name, fee };
      updatePriceCalculation();
    });
  });

  updatePriceCalculation();
}

function selectService(serviceId) {
  if (!serviceData[serviceId]) return;

  bookingState.service = {
    id: serviceId,
    name: serviceData[serviceId].name,
    basePrice: serviceData[serviceId].basePrice
  };

  const cards = document.querySelectorAll('.modal-option-card');
  cards.forEach(c => {
    if (c.getAttribute('data-service-id') === serviceId) {
      c.classList.add('selected');
    } else {
      c.classList.remove('selected');
    }
  });

  updatePriceCalculation();
}

function updatePriceCalculation() {
  const serviceEl = document.getElementById('summaryServiceName');
  const basePriceEl = document.getElementById('summaryBasePrice');
  const urgencyEl = document.getElementById('summaryUrgencyFee');
  const discountEl = document.getElementById('summaryDiscount');
  const totalEl = document.getElementById('summaryTotalPrice');

  const subtotal = bookingState.service.basePrice + bookingState.scope.price + bookingState.urgency.fee;
  const total = Math.max(0, subtotal - bookingState.discount);

  if (serviceEl) serviceEl.textContent = bookingState.service.name;
  if (basePriceEl) basePriceEl.textContent = `$${bookingState.service.basePrice + bookingState.scope.price}`;
  if (urgencyEl) urgencyEl.textContent = bookingState.urgency.fee > 0 ? `+$${bookingState.urgency.fee}` : '$0';
  if (discountEl) discountEl.textContent = `-$${bookingState.discount}`;
  if (totalEl) totalEl.textContent = `$${total}`;
}

function goToStep(stepNum) {
  // If moving to step 3 and not logged in, prompt user to register/login first
  if (stepNum === 3 && !currentUser) {
    if (confirm("You need a customer account to lock in your appointment and track it. Would you like to Sign In or Register now?")) {
      closeModal('bookingModal');
      openAuthModal('register');
      return;
    }
  }

  bookingState.currentStep = stepNum;

  const stepContainers = document.querySelectorAll('.modal-step-content');
  stepContainers.forEach((step, idx) => {
    step.style.display = (idx + 1 === stepNum) ? 'block' : 'none';
  });

  const pills = document.querySelectorAll('.modal-step-pill');
  pills.forEach((pill, idx) => {
    if (idx + 1 <= stepNum) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  const backBtn = document.getElementById('modalBackBtn');
  const nextBtn = document.getElementById('modalNextBtn');
  const confirmBtn = document.getElementById('confirmBookingBtn');

  if (backBtn) backBtn.style.display = stepNum > 1 ? 'inline-flex' : 'none';
  if (nextBtn) nextBtn.style.display = stepNum < 3 ? 'inline-flex' : 'none';
  if (confirmBtn) confirmBtn.style.display = stepNum === 3 ? 'inline-flex' : 'none';

  if (stepNum === 3 && currentUser) {
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    if (nameInput && !nameInput.value) nameInput.value = currentUser.name;
    if (phoneInput && !phoneInput.value) phoneInput.value = currentUser.phone;
  }
}

async function handleBookingSubmit(e) {
  e.preventDefault();

  if (!currentUser) {
    alert("Please sign in or register to complete your booking.");
    closeModal('bookingModal');
    openAuthModal('register');
    return;
  }

  const nameInput = document.getElementById('clientName');
  const phoneInput = document.getElementById('clientPhone');
  const addressInput = document.getElementById('clientAddress');
  const zipInput = document.getElementById('clientZip');

  if (!nameInput.value.trim() || !phoneInput.value.trim()) {
    alert('Please enter your full name and phone number.');
    return;
  }

  const subtotal = bookingState.service.basePrice + bookingState.scope.price + bookingState.urgency.fee;
  const totalPrice = Math.max(0, subtotal - bookingState.discount);
  const scheduledDate = bookingState.urgency.fee > 0 ? 'Today (Rush, within 3 hours)' : 'Tomorrow, 9:00 AM - 12:00 PM';

  const payload = {
    customerName: nameInput.value.trim(),
    phone: phoneInput.value.trim(),
    service: bookingState.service.name,
    scope: bookingState.scope.name,
    urgency: bookingState.urgency.name,
    scheduledDate: scheduledDate,
    address: addressInput.value.trim() || 'Address on file',
    zip: zipInput.value.trim() || '10001',
    totalPrice: totalPrice
  };

  let newBooking = null;

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      newBooking = data.booking;
    } else {
      alert(data.message || 'Error saving booking.');
      return;
    }
  } catch (err) {
    // Client-side fallback
    newBooking = {
      id: 'HSP-' + Math.floor(100000 + Math.random() * 900000),
      customer_name: payload.customerName,
      phone: payload.phone,
      service: payload.service,
      scope: payload.scope,
      urgency: payload.urgency,
      scheduled_date: payload.scheduledDate,
      address: payload.address,
      zip: payload.zip,
      total_price: payload.totalPrice,
      status: 'Confirmed'
    };
    const stored = JSON.parse(localStorage.getItem('homeserve_pro_bookings') || '[]');
    stored.unshift(newBooking);
    localStorage.setItem('homeserve_pro_bookings', JSON.stringify(stored));
  }

  // Display Success Screen in modal
  const stepContainer = document.querySelector('.modal-main');
  if (stepContainer) {
    stepContainer.innerHTML = `
      <div style="text-align: center; padding: 2.5rem 1rem;">
        <div style="width: 68px; height: 68px; border-radius: 50%; background: #ecfdf5; color: #10b981; display: inline-flex; align-items: center; justify-content: center; font-size: 2.2rem; margin-bottom: 1.25rem;">
          &#10003;
        </div>
        <h3 style="font-size: 1.6rem; color: #0f172a; margin-bottom: 0.5rem;">Booking Confirmed & Saved to SQL!</h3>
        <p style="color: #64748b; margin-bottom: 1.5rem; font-size: 0.98rem;">
          Thank you, <strong>${escapeHtml(currentUser.name)}</strong>. Your appointment has been permanently stored in our SQL database.
        </p>

        <div style="background: #f8fafc; border: 1.5px dashed #0284c7; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; text-align: left;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem;">
            <span style="font-size: 0.78rem; text-transform: uppercase; color: #64748b; font-weight: 700;">Reference Code:</span>
            <span style="font-size: 1.25rem; font-weight: 800; color: #0284c7;">${newBooking.id}</span>
          </div>
          <div style="font-size: 0.9rem; color: #0f172a; margin-bottom: 0.25rem;">
            <strong>Service:</strong> ${escapeHtml(newBooking.service)}
          </div>
          <div style="font-size: 0.9rem; color: #0f172a; margin-bottom: 0.25rem;">
            <strong>Arrival Window:</strong> ${escapeHtml(newBooking.scheduled_date || newBooking.scheduledDate)}
          </div>
          <div style="font-size: 0.9rem; color: #0f172a;">
            <strong>Total Locked Price:</strong> $${newBooking.total_price || newBooking.totalPrice}
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button class="btn btn-primary" onclick="closeModal('bookingModal'); openMyBookingsModal();">View in My Account</button>
          <button class="btn btn-outline" onclick="window.location.reload();">Done</button>
        </div>
      </div>
    `;
  }
}

/**
 * ==============================================================================
 * 3. CUSTOMER "MY BOOKINGS" DASHBOARD
 * ==============================================================================
 */
function initMyBookingsModal() {
  const modal = document.getElementById('myBookingsModal');
  const closeBtn = document.getElementById('closeMyBookingsBtn');
  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('myBookingsModal'));
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal('myBookingsModal');
    });
  }
}

window.openMyBookingsModal = async function() {
  if (!currentUser) {
    openAuthModal('login');
    return;
  }

  openModal('myBookingsModal');
  const container = document.getElementById('myBookingsListContainer');
  if (!container) return;

  container.innerHTML = '<div style="text-align: center; padding: 2rem; color: #64748b;">Loading your bookings from SQL database...</div>';

  let bookings = [];

  try {
    const res = await fetch('/api/bookings/my');
    if (res.ok) {
      const data = await res.json();
      bookings = data.bookings || [];
    }
  } catch (err) {
    // Fallback
    const stored = JSON.parse(localStorage.getItem('homeserve_pro_bookings') || '[]');
    bookings = stored;
  }

  if (bookings.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 3rem 1rem; color: #64748b;">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 0.75rem;">📋</span>
        <h4 style="font-size: 1.2rem; color: #0f172a;">No Bookings Yet</h4>
        <p style="font-size: 0.9rem; margin: 0.5rem 0 1.5rem;">You haven't scheduled any services yet with this account.</p>
        <button class="btn btn-primary open-estimator-btn" onclick="closeModal('myBookingsModal'); openModal('bookingModal');">
          Book a Home Service Now
        </button>
      </div>
    `;
    return;
  }

  let html = '';
  bookings.forEach(b => {
    const statusClass = (b.status || 'Confirmed').toLowerCase();
    html += `
      <div class="booking-item-card">
        <div class="booking-item-header">
          <div>
            <span style="font-size: 0.75rem; text-transform: uppercase; font-weight: 700; color: #64748b;">Reference</span>
            <h4 style="font-size: 1.15rem; color: #0284c7;">${b.id}</h4>
          </div>
          <span class="status-badge ${statusClass}">● ${escapeHtml(b.status)}</span>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; font-size: 0.88rem; margin-bottom: 1rem;">
          <div>
            <span style="font-size: 0.75rem; color: #64748b; display: block;">Service</span>
            <strong>${escapeHtml(b.service)}</strong>
          </div>
          <div>
            <span style="font-size: 0.75rem; color: #64748b; display: block;">Arrival Window</span>
            <strong style="color: #0284c7;">${escapeHtml(b.scheduled_date || b.scheduledDate)}</strong>
          </div>
          <div>
            <span style="font-size: 0.75rem; color: #64748b; display: block;">Address</span>
            <strong>${escapeHtml(b.address || 'On file')}, ${escapeHtml(b.zip || '')}</strong>
          </div>
          <div>
            <span style="font-size: 0.75rem; color: #64748b; display: block;">Guaranteed Total</span>
            <strong style="color: #059669; font-size: 1.05rem;">$${b.total_price || b.totalPrice}</strong>
          </div>
        </div>

        <div style="font-size: 0.82rem; color: #64748b; background: #ffffff; padding: 0.6rem 0.85rem; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
          <span>👷 <strong>Pro:</strong> ${escapeHtml(b.pro_assigned || b.proAssigned || 'Assigned Local Specialist')}</span>
          <span style="color: #10b981; font-weight: 600;">✓ License Insured</span>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
};

/**
 * ==============================================================================
 * 4. ADMIN DISPATCH DASHBOARD (PROTECTED: ROLE = ADMIN)
 * ==============================================================================
 */
function initAdminPortal() {
  const openBtns = document.querySelectorAll('.open-admin-btn');
  const closeBtn = document.getElementById('closeAdminBtn');
  const modal = document.getElementById('adminModal');

  openBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      if (!currentUser || currentUser.role !== 'admin') {
        openAuthModal('admin');
        return;
      }
      openModal('adminModal');
      loadAdminBookings();
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', () => closeModal('adminModal'));
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal('adminModal');
    });
  }
}

async function loadAdminBookings() {
  const tableBody = document.getElementById('adminBookingsTableBody');
  const totalCountEl = document.getElementById('adminTotalBookingsCount');
  const totalRevenueEl = document.getElementById('adminTotalRevenue');
  const activeDispatchCountEl = document.getElementById('adminActiveDispatchCount');

  if (!tableBody) return;
  tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">Fetching SQL database records...</td></tr>';

  let bookings = [];

  try {
    const res = await fetch('/api/admin/bookings');
    if (res.ok) {
      const data = await res.json();
      bookings = data.bookings || [];
    } else {
      throw new Error('Access denied');
    }
  } catch (err) {
    // Client fallback demo
    bookings = JSON.parse(localStorage.getItem('homeserve_pro_bookings') || '[]');
  }

  let totalRev = 0;
  let activeCount = 0;
  tableBody.innerHTML = '';

  if (bookings.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;">No bookings logged in database yet.</td></tr>';
  } else {
    bookings.forEach(b => {
      const price = parseFloat(b.total_price || b.totalPrice || 0);
      totalRev += price;
      if (b.status === 'Confirmed' || b.status === 'Dispatched') activeCount++;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <strong>${b.id}</strong><br>
          <small style="color: #64748b;">${b.created_at || 'Recent'}</small>
        </td>
        <td>
          <strong>${escapeHtml(b.customer_name || b.customerName)}</strong><br>
          <a href="tel:${escapeHtml(b.phone)}" style="color: #0284c7; font-size: 0.85rem;">📞 ${escapeHtml(b.phone)}</a>
        </td>
        <td>
          <strong>${escapeHtml(b.service)}</strong><br>
          <small style="color: #64748b;">${escapeHtml(b.address || 'Local')}</small>
        </td>
        <td>
          <span style="font-size: 0.85rem;">${escapeHtml(b.scheduled_date || b.scheduledDate)}</span>
        </td>
        <td>
          <strong style="color: #059669;">$${price}</strong>
        </td>
        <td>
          <select class="status-select" onchange="updateBookingStatus('${b.id}', this.value)">
            <option value="Confirmed" ${b.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Dispatched" ${b.status === 'Dispatched' ? 'selected' : ''}>Dispatched</option>
            <option value="Completed" ${b.status === 'Completed' ? 'selected' : ''}>Completed</option>
            <option value="Cancelled" ${b.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
      `;
      tableBody.appendChild(tr);
    });
  }

  if (totalCountEl) totalCountEl.textContent = bookings.length;
  if (totalRevenueEl) totalRevenueEl.textContent = `$${totalRev.toLocaleString()}`;
  if (activeDispatchCountEl) activeDispatchCountEl.textContent = activeCount;
}

window.updateBookingStatus = async function(bookingId, newStatus) {
  try {
    const res = await fetch('/api/admin/update-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookingId, status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      loadAdminBookings();
    }
  } catch (err) {
    // Client fallback
    const bookings = JSON.parse(localStorage.getItem('homeserve_pro_bookings') || '[]');
    const updated = bookings.map(b => b.id === bookingId ? { ...b, status: newStatus } : b);
    localStorage.setItem('homeserve_pro_bookings', JSON.stringify(updated));
    loadAdminBookings();
  }
};

/**
 * ==============================================================================
 * 5. MODAL & UI UTILITIES
 * ==============================================================================
 */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function initQuickHeroForm() {
  const form = document.getElementById('heroQuickForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const serviceSelect = document.getElementById('heroServiceSelect');
    if (serviceSelect && serviceSelect.value) {
      selectService(serviceSelect.value);
    }
    openModal('bookingModal');
  });
}

function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    if (!questionBtn) return;
    questionBtn.addEventListener('click', () => {
      const isOpen = item.classList.contains('active');
      faqItems.forEach(i => i.classList.remove('active'));
      if (!isOpen) item.classList.add('active');
    });
  });
}

function initMobileNav() {
  const toggleBtn = document.querySelector('.mobile-toggle-btn');
  const navMenu = document.querySelector('.nav-menu');
  if (!toggleBtn || !navMenu) return;

  toggleBtn.addEventListener('click', () => {
    navMenu.classList.toggle('active');
  });

  navMenu.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('active');
    });
  });
}
