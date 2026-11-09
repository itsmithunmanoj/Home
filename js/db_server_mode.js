/**
 * ==============================================================================
 * HOMESERVE PRO - SERVER MODE (Flask + SQLite/MySQL backend)
 * Drop-in replacement for the DB_* functions in js/main.js
 *
 * HOW TO SWITCH:
 *   1. Run:  python app.py          (starts the server on port 5000)
 *   2. Open: http://localhost:5000  (NOT file:// — must be served by Flask)
 *   3. Replace the "STORAGE HELPERS" block in js/main.js with this file's content
 *
 * Everything else in main.js (UI, modals, booking forms) stays UNCHANGED.
 * ==============================================================================
 */

// ─────────────────────────────────────────────────────────
// SERVER-BACKED DB HELPERS  (replaces localStorage block)
// ─────────────────────────────────────────────────────────

async function DB_seed() { /* Server seeds itself in app.py init_db() */ }

async function DB_getUserByEmail(email) {
  // Not called directly in server mode — login/register hit /api endpoints
  return null;
}

async function DB_getSession() {
  try {
    const res  = await fetch('/api/auth/me');
    const data = await res.json();
    return data.user || null;         // {id, name, email, phone, role}
  } catch { return null; }
}

async function DB_setSession(user) {
  // Session is managed server-side via Flask sessions — nothing to do here
}

async function DB_clearSession() {
  await fetch('/api/auth/logout', { method: 'POST' });
}

async function DB_addUser(user) {
  // Handled inside the register form submit via /api/auth/register
}

async function DB_addBooking(booking) {
  await fetch('/api/bookings', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      customerName:  booking.customerName,
      phone:         booking.phone,
      service:       booking.service,
      scope:         booking.scope,
      urgency:       booking.urgency,
      scheduledDate: booking.scheduledDate,
      address:       booking.address,
      zip:           booking.zip,
      totalPrice:    booking.totalPrice
    })
  });
}

async function DB_getBookingsByUserId(userId) {
  const res  = await fetch('/api/bookings/my');
  const data = await res.json();
  return data.bookings || [];
}

async function DB_getBookings() {
  const res  = await fetch('/api/admin/bookings');
  const data = await res.json();
  return data.bookings || [];
}

async function DB_updateBookingStatus(bookingId, newStatus) {
  await fetch('/api/admin/update-status', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ bookingId, status: newStatus })
  });
}
