# HomeServe Pro — Switching Between localStorage and Server Mode

The project is designed so you can flip between **pure browser mode** (no server) and **full server + SQL mode** in minutes.

---

## Current Mode: Pure Browser (localStorage)

```
Just double-click index.html — no setup needed.
Data is stored in your browser's localStorage.
```

---

## Switching to Server Mode (Flask + SQLite / MySQL)

### What you change — only 1 thing

Open `js/main.js` and **replace the top "STORAGE HELPERS" block** with the
contents of `js/db_server_mode.js`.

That's it. Every other line of code (UI, modals, booking forms, admin dashboard)
stays completely unchanged.

---

### Side-by-Side Comparison

| Feature               | localStorage Mode        | Server Mode (Flask)              |
|-----------------------|--------------------------|----------------------------------|
| Setup required        | None — open HTML file    | `python app.py`                  |
| Open in browser via   | `file://` double-click   | `http://localhost:5000`          |
| Data stored in        | Browser localStorage     | `homeserve.db` (SQLite) or MySQL |
| Works across devices  | No (this browser only)   | Yes (any device on same network) |
| Data survives browser clear | No               | Yes                              |
| Needs internet        | No                       | No (runs locally)                |

---

### Step-by-Step to Switch to Server Mode

**Step 1 — Start the backend server**
```bash
cd "C:\Users\Mithun manoj\.gemini\antigravity\scratch\homeserve-pro"
python app.py
# Server starts at http://localhost:5000
```

**Step 2 — Swap the DB block in js/main.js**

In `js/main.js`, find this comment at the top:
```
// STORAGE HELPERS (The "Database")
```
Delete everything from that comment down to (and including) `function DB_seed() { ... }`.
Then paste in the entire contents of `js/db_server_mode.js` in its place.

**Step 3 — Open the site via the server URL**
```
http://localhost:5000
```
(Do NOT use `file://` in server mode — cookies/sessions need HTTP)

---

### To Use MySQL Instead of SQLite

In `app.py`, replace the SQLite connection line:
```python
# SQLite (default, zero setup)
conn = sqlite3.connect(DB_FILE)
```

With a MySQL connection:
```python
# MySQL (requires: pip install flask-mysqldb)
import MySQLdb
conn = MySQLdb.connect(host='localhost', user='root', passwd='yourpassword', db='homeserve_db')
```

Then run `schema.sql` in phpMyAdmin or MySQL Workbench to create the tables.

---

## Summary

```
localStorage mode → open index.html directly in browser
Server mode       → python app.py, then open http://localhost:5000
                    (and swap the 8 DB_ functions in js/main.js)
```
