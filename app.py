"""
==============================================================================
HOMESERVE PRO - FULL-STACK BACKEND SERVER
Python Flask + SQL Database Engine (SQLite / MySQL Compatible)
==============================================================================
"""

import os
import sqlite3
import random
from datetime import datetime
from flask import Flask, request, jsonify, session, send_from_directory
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key = os.environ.get('SECRET_KEY', 'homeserve-pro-super-secret-key-2027')

# On OpenShift, DB_PATH env var points to a writable directory (e.g. /app/data/homeserve.db)
DB_FILE = os.environ.get('DB_PATH', os.path.join(os.path.dirname(__file__), 'homeserve.db'))

def get_db():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes SQL database tables and default admin/customer accounts."""
    conn = get_db()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'customer',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Bookings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bookings (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        customer_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        service TEXT NOT NULL,
        scope TEXT NOT NULL,
        urgency TEXT NOT NULL,
        scheduled_date TEXT NOT NULL,
        address TEXT NOT NULL,
        zip TEXT NOT NULL,
        total_price REAL NOT NULL,
        status TEXT DEFAULT 'Confirmed',
        pro_assigned TEXT DEFAULT 'Nearby Certified Pro (Assigned)',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    """)

    # Seed Default Administrator if not exists
    cursor.execute("SELECT id FROM users WHERE email = 'admin@homeserve.com'")
    if not cursor.fetchone():
        admin_hash = generate_password_hash('admin123')
        cursor.execute("""
        INSERT INTO users (name, email, phone, password_hash, role)
        VALUES ('System Admin', 'admin@homeserve.com', '800-555-4663', ?, 'admin')
        """, (admin_hash,))

    # Seed Default Demo Customer if not exists
    cursor.execute("SELECT id FROM users WHERE email = 'john@example.com'")
    if not cursor.fetchone():
        cust_hash = generate_password_hash('password123')
        cursor.execute("""
        INSERT INTO users (name, email, phone, password_hash, role)
        VALUES ('John Doe', 'john@example.com', '555-234-5678', ?, 'customer')
        """, (cust_hash,))
        
        # Add a demo booking for John Doe
        cursor.execute("SELECT id FROM users WHERE email = 'john@example.com'")
        john_id = cursor.fetchone()['id']
        cursor.execute("""
        INSERT INTO bookings (id, user_id, customer_name, phone, service, scope, urgency, scheduled_date, address, zip, total_price, status, pro_assigned)
        VALUES ('HSP-849201', ?, 'John Doe', '555-234-5678', 'Plumbing & Drain Repairs', 'Standard Diagnostic & Fix', 'Standard (Next 1-2 Days)', 'Tomorrow, 10:00 AM - 12:00 PM', '742 Evergreen Terrace', '10001', 129.0, 'Confirmed', 'Mike Torres (Master Plumber ★ 4.9)')
        """, (john_id,))

    conn.commit()
    conn.close()

# Initialize DB on server start
init_db()

# ==============================================================================
# STATIC FILE ROUTES
# ==============================================================================
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# ==============================================================================
# AUTHENTICATION API ROUTES
# ==============================================================================
@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'user': None})
    
    conn = get_db()
    user = conn.execute("SELECT id, name, email, phone, role FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()

    if not user:
        session.clear()
        return jsonify({'user': None})

    return jsonify({
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'phone': user['phone'],
            'role': user['role']
        }
    })

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    phone = data.get('phone', '').strip()
    password = data.get('password', '').strip()

    if not name or not email or not password or not phone:
        return jsonify({'success': False, 'message': 'All fields are required.'}), 400

    conn = get_db()
    existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if existing:
        conn.close()
        return jsonify({'success': False, 'message': 'An account with this email already exists. Please log in.'}), 409

    pwd_hash = generate_password_hash(password)
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO users (name, email, phone, password_hash, role)
    VALUES (?, ?, ?, ?, 'customer')
    """, (name, email, phone, pwd_hash))
    user_id = cursor.lastrowid
    conn.commit()
    conn.close()

    # Automatically set session
    session['user_id'] = user_id
    session['role'] = 'customer'

    return jsonify({
        'success': True,
        'user': {'id': user_id, 'name': name, 'email': email, 'phone': phone, 'role': 'customer'},
        'message': 'Account created successfully!'
    })

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '').strip()

    if not email or not password:
        return jsonify({'success': False, 'message': 'Email and password are required.'}), 400

    conn = get_db()
    user = conn.execute("SELECT id, name, email, phone, password_hash, role FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()

    # Strict Check: If user does not exist, reject with register prompt
    if not user:
        return jsonify({
            'success': False,
            'message': 'No account found with this email. You must register first before signing in.'
        }), 404

    # Strict Check: Password verification
    if not check_password_hash(user['password_hash'], password):
        return jsonify({
            'success': False,
            'message': 'Incorrect password. Please check your password and try again.'
        }), 401

    session['user_id'] = user['id']
    session['role'] = user['role']

    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'name': user['name'],
            'email': user['email'],
            'phone': user['phone'],
            'role': user['role']
        },
        'message': f"Welcome back, {user['name']}!"
    })

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out successfully.'})

# ==============================================================================
# CUSTOMER BOOKINGS API
# ==============================================================================
@app.route('/api/bookings/my', methods=['GET'])
def get_my_bookings():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Unauthorized. Please sign in.'}), 401

    conn = get_db()
    rows = conn.execute("""
    SELECT id, customer_name, phone, service, scope, urgency, scheduled_date, address, zip, total_price, status, pro_assigned, created_at
    FROM bookings
    WHERE user_id = ?
    ORDER BY created_at DESC
    """, (user_id,)).fetchall()
    conn.close()

    bookings = [dict(row) for row in rows]
    return jsonify({'success': True, 'bookings': bookings})

@app.route('/api/bookings', methods=['POST'])
def create_booking():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'You must be registered and logged in to book an appointment.'}), 401

    data = request.get_json() or {}
    customer_name = data.get('customerName', '').strip()
    phone = data.get('phone', '').strip()
    service = data.get('service', '').strip()
    scope = data.get('scope', '').strip()
    urgency = data.get('urgency', '').strip()
    scheduled_date = data.get('scheduledDate', '').strip()
    address = data.get('address', '').strip()
    zip_code = data.get('zip', '').strip()
    total_price = float(data.get('totalPrice', 0))

    if not customer_name or not phone or not service:
        return jsonify({'success': False, 'message': 'Missing required booking information.'}), 400

    booking_id = f"HSP-{random.randint(100000, 999999)}"

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO bookings (id, user_id, customer_name, phone, service, scope, urgency, scheduled_date, address, zip, total_price, status, pro_assigned)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', 'Nearby Certified Pro (Assigned)')
    """, (booking_id, user_id, customer_name, phone, service, scope, urgency, scheduled_date, address, zip_code, total_price))
    conn.commit()

    new_booking = conn.execute("SELECT * FROM bookings WHERE id = ?", (booking_id,)).fetchone()
    conn.close()

    return jsonify({
        'success': True,
        'booking': dict(new_booking),
        'message': 'Booking confirmed and saved to SQL database!'
    })

# ==============================================================================
# ADMIN DISPATCH DASHBOARD API (PROTECTED: ADMIN ONLY)
# ==============================================================================
@app.route('/api/admin/bookings', methods=['GET'])
def get_all_bookings_admin():
    if session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Access denied. Administrator privileges required.'}), 403

    conn = get_db()
    rows = conn.execute("""
    SELECT b.id, b.user_id, b.customer_name, b.phone, b.service, b.scope, b.urgency, b.scheduled_date, b.address, b.zip, b.total_price, b.status, b.pro_assigned, b.created_at, u.email as customer_email
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    ORDER BY b.created_at DESC
    """).fetchall()
    conn.close()

    bookings = [dict(row) for row in rows]
    return jsonify({'success': True, 'bookings': bookings})

@app.route('/api/admin/update-status', methods=['POST'])
def update_booking_status():
    if session.get('role') != 'admin':
        return jsonify({'success': False, 'message': 'Access denied. Administrator privileges required.'}), 403

    data = request.get_json() or {}
    booking_id = data.get('bookingId')
    new_status = data.get('status')

    if not booking_id or not new_status:
        return jsonify({'success': False, 'message': 'Booking ID and new status required.'}), 400

    conn = get_db()
    conn.execute("UPDATE bookings SET status = ? WHERE id = ?", (new_status, booking_id))
    conn.commit()
    conn.close()

    return jsonify({'success': True, 'message': f'Booking {booking_id} updated to {new_status}.'})

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    print(f"🚀 HomeServe Pro SQL Server running on http://localhost:{port}")
    app.run(host='0.0.0.0', port=port, debug=False)
