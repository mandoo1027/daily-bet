#!/usr/bin/env python3
"""일별 내기 웹 애플리케이션"""

import sqlite3
import random
import secrets
from datetime import datetime, date
from pathlib import Path
from flask import Flask, Blueprint, render_template, request, jsonify, session, redirect

KAKAO_JS_KEY = "73ca63b50b44b890e1452b8ed68d7464"

# URL prefix for nginx reverse proxy
PREFIX = "/daily-bet"

app = Flask(__name__,
            static_url_path=f"{PREFIX}/static",
            static_folder="static")
app.secret_key = secrets.token_hex(32)
DB_PATH = Path(__file__).parent / "daily_bet.db"

bp = Blueprint("daily_bet", __name__, template_folder="templates")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            active INTEGER DEFAULT 1
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS draws (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            bet_name TEXT DEFAULT '커피',
            drawn_at DATE NOT NULL,
            FOREIGN KEY (member_id) REFERENCES members(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kakao_id TEXT UNIQUE,
            nickname TEXT,
            profile_image TEXT,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        )
    """)
    conn.commit()
    return conn


# ── 카카오 로그인 API ──

@bp.route("/api/auth/kakao", methods=["POST"])
def api_kakao_login():
    data = request.json
    kakao_id = str(data.get("id", ""))
    nickname = data.get("nickname", "")
    profile_image = data.get("profile_image", "")
    if not kakao_id:
        return jsonify({"error": "kakao_id required"}), 400

    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE kakao_id = ?", (kakao_id,)).fetchone()
    if not user:
        conn.execute("INSERT INTO users (kakao_id, nickname, profile_image) VALUES (?, ?, ?)",
                     (kakao_id, nickname, profile_image))
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE kakao_id = ?", (kakao_id,)).fetchone()
    else:
        conn.execute("UPDATE users SET nickname = ?, profile_image = ? WHERE kakao_id = ?",
                     (nickname, profile_image, kakao_id))
        conn.commit()
    conn.close()

    session["user_id"] = user["id"]
    session["nickname"] = nickname
    session["profile_image"] = profile_image
    return jsonify({"ok": True, "user": {"id": user["id"], "nickname": nickname, "profile_image": profile_image}})


@bp.route("/api/auth/me")
def api_auth_me():
    if "user_id" in session:
        return jsonify({"ok": True, "user": {
            "id": session["user_id"],
            "nickname": session.get("nickname", ""),
            "profile_image": session.get("profile_image", "")
        }})
    return jsonify({"ok": False})


@bp.route("/api/auth/logout", methods=["POST"])
def api_auth_logout():
    session.clear()
    return jsonify({"ok": True})


# ── Pages ──

@bp.route("/")
def index():
    return render_template("index.html", prefix=PREFIX, kakao_js_key=KAKAO_JS_KEY)


@bp.route("/<path:path>")
def catch_all(path):
    if path.startswith("api/") or path.startswith("static/"):
        return "", 404
    return render_template("index.html", prefix=PREFIX)


# ── API: Members ──

@bp.route("/api/members", methods=["GET"])
def api_members():
    conn = get_db()
    rows = conn.execute(
        "SELECT id, name FROM members WHERE active = 1 ORDER BY name"
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/members", methods=["POST"])
def api_add_member():
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "이름을 입력하세요"}), 400

    conn = get_db()
    existing = conn.execute(
        "SELECT id, active FROM members WHERE name = ?", (name,)
    ).fetchone()

    if existing:
        if existing["active"]:
            conn.close()
            return jsonify({"error": "이미 등록된 멤버입니다"}), 409
        conn.execute("UPDATE members SET active = 1 WHERE id = ?", (existing["id"],))
        conn.commit()
        conn.close()
        return jsonify({"message": f"'{name}' 다시 활성화됨", "id": existing["id"]})

    cur = conn.execute("INSERT INTO members (name) VALUES (?)", (name,))
    conn.commit()
    member_id = cur.lastrowid
    conn.close()
    return jsonify({"message": f"'{name}' 추가 완료", "id": member_id}), 201


@bp.route("/api/members/<int:member_id>", methods=["DELETE"])
def api_remove_member(member_id):
    conn = get_db()
    cur = conn.execute(
        "UPDATE members SET active = 0 WHERE id = ? AND active = 1", (member_id,)
    )
    conn.commit()
    conn.close()
    if cur.rowcount:
        return jsonify({"message": "삭제 완료"})
    return jsonify({"error": "멤버를 찾을 수 없습니다"}), 404


# ── API: Draw ──

@bp.route("/api/draw", methods=["POST"])
def api_draw():
    data = request.get_json() or {}
    bet_name = data.get("bet_name", "커피").strip() or "커피"
    winner_name = data.get("winner", "").strip()
    today = date.today().isoformat()

    conn = get_db()
    members = conn.execute(
        "SELECT id, name FROM members WHERE active = 1"
    ).fetchall()

    if len(members) < 2:
        conn.close()
        return jsonify({"error": "최소 2명 이상의 참가자가 필요합니다"}), 400

    if winner_name:
        chosen = next((m for m in members if m["name"] == winner_name), None)
        if not chosen:
            conn.close()
            return jsonify({"error": "멤버를 찾을 수 없습니다"}), 404
    else:
        chosen = random.choice(members)

    conn.execute(
        "INSERT INTO draws (member_id, bet_name, drawn_at) VALUES (?, ?, ?)",
        (chosen["id"], bet_name, today)
    )
    conn.commit()
    conn.close()

    return jsonify({
        "name": chosen["name"],
        "bet_name": bet_name,
        "date": today
    })


@bp.route("/api/today", methods=["GET"])
def api_today():
    today = date.today().isoformat()
    conn = get_db()
    rows = conn.execute("""
        SELECT d.id, m.name, d.bet_name, d.drawn_at
        FROM draws d JOIN members m ON d.member_id = m.id
        WHERE d.drawn_at = ?
        ORDER BY d.id DESC
    """, (today,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ── API: History ──

@bp.route("/api/history", methods=["GET"])
def api_history():
    limit = request.args.get("limit", 30, type=int)
    conn = get_db()
    rows = conn.execute("""
        SELECT d.id, d.drawn_at, m.name, d.bet_name
        FROM draws d JOIN members m ON d.member_id = m.id
        ORDER BY d.drawn_at DESC, d.id DESC
        LIMIT ?
    """, (limit,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/history/<int:draw_id>", methods=["DELETE"])
def api_delete_draw(draw_id):
    conn = get_db()
    cur = conn.execute("DELETE FROM draws WHERE id = ?", (draw_id,))
    conn.commit()
    conn.close()
    if cur.rowcount:
        return jsonify({"message": "삭제 완료"})
    return jsonify({"error": "기록을 찾을 수 없습니다"}), 404


# ── API: Stats ──

@bp.route("/api/stats/monthly", methods=["GET"])
def api_monthly_stats():
    year = request.args.get("year", datetime.now().year, type=int)
    month = request.args.get("month", datetime.now().month, type=int)
    month_str = f"{year}-{month:02d}"

    conn = get_db()
    rows = conn.execute("""
        SELECT m.name, d.bet_name, COUNT(*) as count
        FROM draws d JOIN members m ON d.member_id = m.id
        WHERE strftime('%Y-%m', d.drawn_at) = ?
        GROUP BY m.name, d.bet_name
        ORDER BY count DESC, m.name
    """, (month_str,)).fetchall()
    conn.close()

    return jsonify({
        "period": month_str,
        "data": [dict(r) for r in rows]
    })


@bp.route("/api/stats/yearly", methods=["GET"])
def api_yearly_stats():
    year = request.args.get("year", datetime.now().year, type=int)

    conn = get_db()
    rows = conn.execute("""
        SELECT strftime('%m', d.drawn_at) as month,
               m.name, d.bet_name, COUNT(*) as count
        FROM draws d JOIN members m ON d.member_id = m.id
        WHERE strftime('%Y', d.drawn_at) = ?
        GROUP BY month, m.name, d.bet_name
        ORDER BY month, count DESC
    """, (str(year),)).fetchall()
    conn.close()

    return jsonify({
        "year": year,
        "data": [dict(r) for r in rows]
    })


@bp.route("/api/stats/reset", methods=["DELETE"])
def api_reset_stats():
    conn = get_db()
    conn.execute("DELETE FROM draws")
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "message": "All draw history deleted"})


app.register_blueprint(bp, url_prefix=PREFIX)

if __name__ == "__main__":
    app.run(debug=True, port=3005)
