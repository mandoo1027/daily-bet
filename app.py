#!/usr/bin/env python3
"""일별 내기 웹 애플리케이션"""

import os
import sqlite3
import random
import secrets
from datetime import datetime, date
from pathlib import Path
from flask import Flask, Blueprint, render_template, request, jsonify, session, redirect

# .env 로더 (python-dotenv 의존성 없이)
_env_path = Path(__file__).with_name(".env")
if _env_path.exists():
    for _line in _env_path.read_text().splitlines():
        _line = _line.strip()
        if not _line or _line.startswith("#") or "=" not in _line:
            continue
        _k, _v = _line.split("=", 1)
        os.environ.setdefault(_k.strip(), _v.strip())

KAKAO_JS_KEY = os.environ.get("KAKAO_JS_KEY", "73ca63b50b44b890e1452b8ed68d7464")
KAKAO_REST_KEY = os.environ.get("KAKAO_REST_KEY", "")
KAKAO_CLIENT_SECRET = os.environ.get("KAKAO_CLIENT_SECRET", "")

# URL prefix for nginx reverse proxy
PREFIX = "/daily-bet"

app = Flask(__name__,
            static_url_path=f"{PREFIX}/static",
            static_folder="static")
app.secret_key = "dailybet_session_key_2026_fixed"
app.config['SESSION_COOKIE_NAME'] = 'dailybet_session'
app.config['SESSION_COOKIE_PATH'] = '/daily-bet'
app.config['PERMANENT_SESSION_LIFETIME'] = 30 * 24 * 60 * 60  # 30일
DB_PATH = Path(__file__).parent / "daily_bet.db"

bp = Blueprint("daily_bet", __name__, template_folder="templates")


def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("""
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            active INTEGER DEFAULT 1,
            user_id INTEGER,
            UNIQUE(name, user_id)
        )
    """)
    # 마이그레이션: user_id 컬럼 추가
    try:
        conn.execute("ALTER TABLE members ADD COLUMN user_id INTEGER")
    except:
        pass
    try:
        conn.execute("ALTER TABLE draws ADD COLUMN user_id INTEGER")
    except:
        pass
    conn.execute("""
        CREATE TABLE IF NOT EXISTS draws (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            bet_name TEXT DEFAULT '커피',
            drawn_at DATE NOT NULL,
            user_id INTEGER,
            FOREIGN KEY (member_id) REFERENCES members(id)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kakao_id TEXT UNIQUE,
            nickname TEXT,
            profile_image TEXT,
            birth_date TEXT,
            birth_time TEXT,
            gender TEXT,
            solar_lunar TEXT DEFAULT 'solar',
            registered INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime'))
        )
    """)
    # 마이그레이션: 운세 필드 추가
    for col in ['birth_date TEXT', 'birth_time TEXT', 'gender TEXT', 'solar_lunar TEXT DEFAULT "solar"', 'registered INTEGER DEFAULT 0']:
        try:
            conn.execute(f"ALTER TABLE users ADD COLUMN {col}")
        except:
            pass
    conn.execute("""
        CREATE TABLE IF NOT EXISTS member_groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            user_id INTEGER,
            member_names TEXT NOT NULL,
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

    session.permanent = True
    session["user_id"] = user["id"]
    session["nickname"] = nickname
    session["profile_image"] = profile_image
    return jsonify({"ok": True, "user": {"id": user["id"], "nickname": nickname, "profile_image": profile_image}})


@bp.route("/api/auth/logout", methods=["POST"])
def api_auth_logout():
    session.clear()
    return jsonify({"ok": True})


@bp.route("/auth/kakao/callback")
def kakao_callback():
    code = request.args.get("code")
    if not code:
        return redirect(PREFIX + "/")

    import urllib.request, urllib.parse, urllib.error, json

    # 인가 코드 → 토큰
    redirect_uri = "https://mandoo1027.duckdns.org" + PREFIX + "/auth/kakao/callback"
    token_data = urllib.parse.urlencode({
        "grant_type": "authorization_code",
        "client_id": KAKAO_REST_KEY,
        "redirect_uri": redirect_uri,
        "code": code,
        "client_secret": KAKAO_CLIENT_SECRET,
    }).encode()

    try:
        req = urllib.request.Request("https://kauth.kakao.com/oauth/token", data=token_data)
        req.add_header("Content-Type", "application/x-www-form-urlencoded")
        resp = urllib.request.urlopen(req, timeout=10)
        token_result = json.loads(resp.read())
        access_token = token_result.get("access_token", "")
    except Exception as e:
        return f"카카오 토큰 오류: {e}", 400

    if not access_token:
        return redirect(PREFIX + "/")

    # 토큰 → 사용자 정보
    try:
        req2 = urllib.request.Request("https://kapi.kakao.com/v2/user/me")
        req2.add_header("Authorization", f"Bearer {access_token}")
        resp2 = urllib.request.urlopen(req2, timeout=10)
        user_info = json.loads(resp2.read())
    except Exception as e:
        return f"사용자 정보 오류: {e}", 400

    kakao_id = str(user_info.get("id", ""))
    profile = user_info.get("kakao_account", {}).get("profile", {})
    nickname = profile.get("nickname", "사용자")
    profile_image = profile.get("profile_image_url", "")

    # DB 저장
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE kakao_id = ?", (kakao_id,)).fetchone()
    is_new = False
    if not user:
        conn.execute("INSERT INTO users (kakao_id, nickname, profile_image, registered) VALUES (?, ?, ?, 0)",
                     (kakao_id, nickname, profile_image))
        conn.commit()
        user = conn.execute("SELECT * FROM users WHERE kakao_id = ?", (kakao_id,)).fetchone()
        is_new = True
    else:
        conn.execute("UPDATE users SET nickname = ?, profile_image = ? WHERE kakao_id = ?",
                     (nickname, profile_image, kakao_id))
        conn.commit()
        is_new = not user["registered"]
    conn.close()

    session.permanent = True
    session["user_id"] = user["id"]
    session["nickname"] = nickname
    session["profile_image"] = profile_image

    if is_new:
        return redirect(PREFIX + "/signup")
    return redirect(PREFIX + "/")


# ── Pages ──

@bp.route("/")
def index():
    return render_template("index.html", prefix=PREFIX, kakao_js_key=KAKAO_JS_KEY, kakao_rest_key=KAKAO_REST_KEY)


@bp.route("/signup")
def signup_page():
    if "user_id" not in session:
        return redirect(PREFIX + "/")
    return render_template("signup.html", prefix=PREFIX)


@bp.route("/api/signup", methods=["POST"])
def api_signup():
    if "user_id" not in session:
        return jsonify({"error": "로그인 필요"}), 401
    data = request.get_json()
    birth_date = data.get("birth_date", "").strip()
    birth_time = data.get("birth_time", "").strip()
    gender = data.get("gender", "").strip()
    solar_lunar = data.get("solar_lunar", "solar").strip()

    conn = get_db()
    conn.execute("""
        UPDATE users SET birth_date = ?, birth_time = ?, gender = ?, solar_lunar = ?, registered = 1
        WHERE id = ?
    """, (birth_date or None, birth_time or None, gender or None, solar_lunar, session["user_id"]))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "message": "가입 완료!"})


@bp.route("/api/auth/me")
def api_auth_me():
    if "user_id" in session:
        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
        conn.close()
        return jsonify({"ok": True, "user": {
            "id": session["user_id"],
            "nickname": session.get("nickname", ""),
            "profile_image": session.get("profile_image", ""),
            "registered": user["registered"] if user else 0,
            "birth_date": user["birth_date"] if user else None,
            "birth_time": user["birth_time"] if user else None,
            "gender": user["gender"] if user else None,
            "solar_lunar": user["solar_lunar"] if user else "solar",
        }})
    return jsonify({"ok": False})


@bp.route("/api/daily-fortune")
def api_daily_fortune():
    if "user_id" not in session:
        return jsonify({"ok": False})
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (session["user_id"],)).fetchone()
    conn.close()
    if not user or not user["birth_date"]:
        return jsonify({"ok": False, "reason": "no_birth"})

    import hashlib
    fortune_type = request.args.get("type", "daily")  # daily, weekly, love

    if fortune_type == "weekly":
        # 이주의 운세: 주 단위로 변경
        week_num = date.today().isocalendar()[1]
        seed = hashlib.md5(f"{user['birth_date']}_week_{date.today().year}_{week_num}".encode()).hexdigest()
    elif fortune_type == "love":
        # 연애운: 매일 변경
        seed = hashlib.md5(f"{user['birth_date']}_love_{date.today().isoformat()}".encode()).hexdigest()
    else:
        seed = hashlib.md5(f"{user['birth_date']}_{date.today().isoformat()}".encode()).hexdigest()

    seed_num = int(seed[:8], 16)

    if fortune_type == "weekly":
        msgs = [
            "이번 주는 전반적으로 상승 기운! 적극적으로 움직이세요",
            "주 초반에 좋은 기회가 옵니다. 놓치지 마세요",
            "이번 주는 휴식이 필요한 시기입니다. 무리하지 마세요",
            "주 중반 이후 운세가 좋아집니다. 인내심을 가지세요",
            "이번 주 대인관계에서 좋은 일이 생깁니다",
            "새로운 시작에 좋은 한 주! 계획을 세워보세요",
            "이번 주는 재충전의 시간. 내면을 돌보세요",
            "주변의 도움을 받아 큰 성과를 이룰 수 있어요",
        ]
        work_msgs = [
            "업무에서 인정받을 수 있는 한 주 💼", "꼼꼼한 확인이 실수를 줄여줍니다 📋",
            "팀워크가 빛을 발하는 시기입니다 🤝", "창의적인 아이디어가 떠오르는 주 💡",
            "차분하게 루틴을 지키면 좋은 결과가 📊", "리더십을 발휘할 기회가 옵니다 👔",
        ]
        health_msgs = [
            "체력 관리에 신경 쓰면 좋겠어요 🏃", "충분한 수면이 중요한 한 주 😴",
            "가벼운 운동으로 스트레스를 풀어보세요 🧘", "식습관 점검이 필요한 시기 🥗",
            "야외 활동이 에너지를 충전해줍니다 🌳", "무리하지 않는 것이 최선입니다 💆",
        ]
        main = msgs[seed_num % len(msgs)]
        work = work_msgs[(seed_num >> 4) % len(work_msgs)]
        health = health_msgs[(seed_num >> 8) % len(health_msgs)]
        score = 60 + (seed_num % 41)
        weekly_summaries = [
            f"이번 주는 운세 지수 {score}점으로 {'에너지 넘치는' if score >= 80 else '안정적인' if score >= 70 else '차분한'} 한 주가 될 전망이에요. 업무적으로는 {work.split('💼')[0].split('📋')[0].split('🤝')[0].split('💡')[0].split('📊')[0].split('👔')[0].strip().lower()}, 건강 면에서는 무리하지 않는 게 좋겠습니다.",
            f"한 주의 흐름을 보면 {'긍정적인 변화가 기대되는' if score >= 80 else '꾸준히 나아가면 좋은' if score >= 70 else '쉬어가며 에너지를 모으면 좋은'} 시기예요. 직장에서의 성과와 건강 관리에 균형을 맞추면 좋은 한 주가 될 거예요.",
        ]
        summary = weekly_summaries[seed_num % len(weekly_summaries)]
        return jsonify({"ok": True, "fortune": {
            "main": main, "work": work, "health": health, "score": score, "type": "weekly", "summary": summary,
        }})

    elif fortune_type == "love":
        single_msgs = [
            "새로운 만남이 기대되는 날! 외출해보세요 💘",
            "매력이 빛나는 날입니다. 자신감을 가지세요 ✨",
            "친구를 통해 좋은 인연이 연결될 수 있어요 🔗",
            "SNS에서 의미 있는 대화가 시작될지도 📱",
            "오늘은 자기 관리에 집중! 매력 UP 💅",
            "우연한 만남에 행운이 숨어있어요 🎯",
            "적극적으로 다가가면 좋은 반응을 얻어요 💬",
            "마음을 열면 사랑이 찾아옵니다 💝",
        ]
        couple_msgs = [
            "연인과 깊은 대화를 나눠보세요 💑",
            "작은 서프라이즈가 큰 감동을 줍니다 🎁",
            "서로의 공간을 존중하는 것도 사랑이에요 🌿",
            "함께하는 식사가 행복을 가져다줘요 🍽️",
            "오해가 생길 수 있으니 솔직하게 표현하세요 💭",
            "추억을 만들기 좋은 날! 데이트 추천 📸",
            "감사의 마음을 전해보세요 🙏",
            "웃음이 넘치는 달콤한 하루가 될 거예요 😊",
        ]
        chemistry_msgs = [
            "불꽃 케미 🔥🔥🔥🔥🔥", "달콤한 설렘 💓💓💓💓",
            "따뜻한 온기 ☀️☀️☀️", "잔잔한 호수 🌊🌊",
            "심쿵 주의보 💘💘💘💘", "로맨틱 모드 ON 🌹🌹🌹",
        ]
        single = single_msgs[seed_num % len(single_msgs)]
        couple = couple_msgs[(seed_num >> 4) % len(couple_msgs)]
        chemistry = chemistry_msgs[(seed_num >> 8) % len(chemistry_msgs)]
        score = 60 + (seed_num % 41)
        love_summaries = [
            f"오늘 연애 운세는 {score}점! {'두근거리는 설렘이 가득한' if score >= 80 else '따뜻한 교감이 이어지는' if score >= 70 else '차분하게 마음을 정리하기 좋은'} 하루예요. 솔로라면 새로운 인연에 마음을 열어보고, 커플이라면 평소 못했던 이야기를 나눠보세요.",
            f"연애 지수 {score}점의 하루! {'적극적으로 표현하면 좋은 반응을 얻을 수 있어요.' if score >= 75 else '무리하지 말고 자연스럽게 흘러가는 대로 두면 좋겠어요.'} 사랑하는 사람에게 따뜻한 한마디를 건네보세요.",
        ]
        summary = love_summaries[seed_num % len(love_summaries)]
        return jsonify({"ok": True, "fortune": {
            "single": single, "couple": couple, "chemistry": chemistry, "score": score, "type": "love", "summary": summary,
        }})

    # 기본: 오늘의 운세
    luck_msgs = [
        "오늘은 대박 운이 따릅니다! 🎉", "좋은 기운이 가득한 날이에요 ✨",
        "무난하지만 안정적인 하루입니다 😊", "조심스럽게 행동하면 좋은 하루 🍀",
        "오늘은 새로운 도전이 길합니다 🚀", "주변 사람들에게 행운을 나눠주세요 💫",
        "예상치 못한 좋은 소식이 올 수 있어요 📬", "차분하게 하루를 보내면 좋겠어요 🌿",
        "오늘의 행운 숫자를 기억하세요 🔢", "웃음이 행운을 불러옵니다 😄",
    ]
    money_msgs = [
        "재물운 상승! 뜻밖의 수입 가능 💰", "지출을 아끼면 좋은 날 💳",
        "투자보다는 저축이 좋겠어요 🏦", "작은 행운이 지갑에 찾아옵니다 🤑",
        "오늘은 씀씀이를 줄여보세요 📉", "금전적으로 안정적인 하루 ⚖️",
    ]
    love_msgs = [
        "소중한 사람에게 연락해보세요 💕", "좋은 인연이 다가올 수 있어요 💘",
        "가까운 사람과 대화가 잘 통하는 날 🗣️", "따뜻한 말 한마디가 큰 힘이 됩니다 🤗",
        "사람들과의 관계가 좋아지는 날 🤝", "혼자만의 시간도 소중합니다 🧘",
    ]

    luck = luck_msgs[seed_num % len(luck_msgs)]
    money = money_msgs[(seed_num >> 4) % len(money_msgs)]
    love = love_msgs[(seed_num >> 8) % len(love_msgs)]
    lucky_num = (seed_num % 45) + 1
    lucky_color_list = ["빨강", "주황", "노랑", "초록", "파랑", "보라", "분홍", "하양", "금색", "은색"]
    lucky_color = lucky_color_list[(seed_num >> 12) % len(lucky_color_list)]
    score = 60 + (seed_num % 41)

    # 자연스러운 2~3줄 문장 생성
    summary_templates = [
        f"오늘 하루는 전반적으로 밝은 기운이 감돌아요. {money.split('!')[0].split('💰')[0].split('💳')[0].strip()} 재물 쪽 흐름도 나쁘지 않고, 가까운 사람과의 관계에서 따뜻한 에너지를 느낄 수 있는 하루입니다. 행운의 숫자 {lucky_num}을 기억하세요.",
        f"오늘은 {luck.replace('🎉','').replace('✨','').replace('😊','').replace('🍀','').replace('🚀','').replace('💫','').replace('📬','').replace('🌿','').replace('🔢','').replace('😄','').strip()} 금전적으로는 차분한 흐름이 예상되며, 주변 사람들과 소통하면 좋은 기운을 받을 수 있어요.",
        f"하루의 흐름을 읽어보면, 전체적인 운세는 {score}점으로 {'기분 좋은' if score >= 80 else '안정적인' if score >= 70 else '무난한'} 수준이에요. 재물운은 {money.split('!')[0].split('💰')[0].split('💳')[0].strip().lower()} 쪽이고, 대인관계에서는 따뜻한 교류가 기대됩니다.",
        f"{'활기찬' if score >= 80 else '평온한' if score >= 70 else '조용한'} 하루가 될 것 같아요. 금전 면에서는 큰 변동 없이 {'좋은 흐름' if score >= 75 else '안정적인 흐름'}이 이어지고, 사람들과의 관계에서 소소한 행복을 느낄 수 있습니다. 오늘의 행운 색은 {lucky_color}이에요.",
        f"오늘의 운세 지수는 {score}점! {'꽤 좋은 하루가 될 거예요.' if score >= 80 else '무난하지만 안정적인 하루입니다.' if score >= 70 else '차분하게 보내면 좋을 하루예요.'} 재물운도 나쁘지 않으니 평소처럼 지내면 됩니다. 행운의 숫자 {lucky_num}, 색상은 {lucky_color}을 참고하세요.",
    ]
    summary = summary_templates[seed_num % len(summary_templates)]

    return jsonify({
        "ok": True,
        "fortune": {
            "luck": luck, "money": money, "love": love,
            "lucky_number": lucky_num, "lucky_color": lucky_color,
            "score": score, "type": "daily", "summary": summary,
        }
    })


@bp.route("/api/profile", methods=["PUT"])
def api_update_profile():
    if "user_id" not in session:
        return jsonify({"error": "로그인 필요"}), 401
    data = request.get_json()
    conn = get_db()
    conn.execute("""
        UPDATE users SET birth_date = ?, birth_time = ?, gender = ?, solar_lunar = ?
        WHERE id = ?
    """, (
        data.get("birth_date") or None,
        data.get("birth_time") or None,
        data.get("gender") or None,
        data.get("solar_lunar", "solar"),
        session["user_id"]
    ))
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "message": "저장 완료!"})


# ── Admin ──

ADMIN_ID = "mandoo1027"
ADMIN_PASSWORD = "rkskekfk5%"

@bp.route("/admin")
def admin_page():
    if not session.get("is_admin"):
        return render_template("admin_login.html", prefix=PREFIX)
    return render_template("admin.html", prefix=PREFIX)


@bp.route("/api/admin/login", methods=["POST"])
def admin_login():
    data = request.get_json()
    if data.get("id") == ADMIN_ID and data.get("password") == ADMIN_PASSWORD:
        session["is_admin"] = True
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "아이디 또는 비밀번호가 틀렸습니다"}), 401


@bp.route("/api/admin/users")
def admin_users():
    if not session.get("is_admin"):
        return jsonify({"error": "권한 없음"}), 403
    conn = get_db()
    users = conn.execute("""
        SELECT u.id, u.kakao_id, u.nickname, u.profile_image, u.birth_date, u.birth_time,
               u.gender, u.solar_lunar, u.registered, u.created_at,
               (SELECT COUNT(*) FROM draws d WHERE d.user_id = u.id) as draw_count,
               (SELECT COUNT(*) FROM members m WHERE m.user_id = u.id AND m.active = 1) as member_count
        FROM users u ORDER BY u.created_at DESC
    """).fetchall()
    conn.close()
    return jsonify([dict(u) for u in users])


@bp.route("/api/admin/user/<int:user_id>/groups")
def admin_user_groups(user_id):
    if not session.get("is_admin"):
        return jsonify({"error": "권한 없음"}), 403
    conn = get_db()
    groups = conn.execute(
        "SELECT id, name, member_names, created_at FROM member_groups WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,)
    ).fetchall()
    conn.close()
    return jsonify([dict(g) for g in groups])


@bp.route("/api/admin/user/<int:user_id>/members")
def admin_user_members(user_id):
    if not session.get("is_admin"):
        return jsonify({"error": "권한 없음"}), 403
    conn = get_db()
    members = conn.execute(
        "SELECT id, name, active FROM members WHERE user_id = ? ORDER BY name",
        (user_id,)
    ).fetchall()
    conn.close()
    return jsonify([dict(m) for m in members])


@bp.route("/api/admin/groups")
def admin_groups():
    if not session.get("is_admin"):
        return jsonify({"error": "권한 없음"}), 403
    conn = get_db()
    groups = conn.execute("""
        SELECT g.id, g.name, g.member_names, g.created_at, g.user_id,
               u.nickname as user_nickname
        FROM member_groups g LEFT JOIN users u ON g.user_id = u.id
        ORDER BY g.created_at DESC
    """).fetchall()
    conn.close()
    return jsonify([dict(g) for g in groups])


@bp.route("/api/admin/stats")
def admin_stats():
    if not session.get("is_admin"):
        return jsonify({"error": "권한 없음"}), 403
    conn = get_db()
    total_users = conn.execute("SELECT COUNT(*) as c FROM users").fetchone()["c"]
    registered_users = conn.execute("SELECT COUNT(*) as c FROM users WHERE registered = 1").fetchone()["c"]
    total_draws = conn.execute("SELECT COUNT(*) as c FROM draws").fetchone()["c"]
    today_draws = conn.execute("SELECT COUNT(*) as c FROM draws WHERE drawn_at = ?", (date.today().isoformat(),)).fetchone()["c"]
    total_groups = conn.execute("SELECT COUNT(*) as c FROM member_groups").fetchone()["c"]
    conn.close()
    return jsonify({
        "total_users": total_users,
        "registered_users": registered_users,
        "total_draws": total_draws,
        "today_draws": today_draws,
        "total_groups": total_groups,
    })


@bp.route("/<path:path>")
def catch_all(path):
    if path.startswith("api/") or path.startswith("static/"):
        return "", 404
    return render_template("index.html", prefix=PREFIX, kakao_js_key=KAKAO_JS_KEY, kakao_rest_key=KAKAO_REST_KEY)


# ── API: Members ──

@bp.route("/api/members", methods=["GET"])
def api_members():
    user_id = session.get("user_id")
    conn = get_db()
    if user_id:
        rows = conn.execute(
            "SELECT id, name FROM members WHERE active = 1 AND user_id = ? ORDER BY name", (user_id,)
        ).fetchall()
    else:
        # 비회원은 기존 공유 멤버 (user_id IS NULL)
        rows = conn.execute(
            "SELECT id, name FROM members WHERE active = 1 AND user_id IS NULL ORDER BY name"
        ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/members", methods=["POST"])
def api_add_member():
    data = request.get_json()
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "이름을 입력하세요"}), 400

    user_id = session.get("user_id")
    conn = get_db()
    existing = conn.execute(
        "SELECT id, active FROM members WHERE name = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))",
        (name, user_id, user_id)
    ).fetchone()

    if existing:
        if existing["active"]:
            conn.close()
            return jsonify({"error": "이미 등록된 멤버입니다"}), 409
        conn.execute("UPDATE members SET active = 1 WHERE id = ?", (existing["id"],))
        conn.commit()
        conn.close()
        return jsonify({"message": f"'{name}' 다시 활성화됨", "id": existing["id"]})

    cur = conn.execute("INSERT INTO members (name, user_id) VALUES (?, ?)", (name, user_id))
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

    user_id = session.get("user_id")
    conn.execute(
        "INSERT INTO draws (member_id, bet_name, drawn_at, user_id) VALUES (?, ?, ?, ?)",
        (chosen["id"], bet_name, today, user_id)
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
    user_id = session.get("user_id")
    conn = get_db()
    if user_id:
        rows = conn.execute("""
            SELECT d.id, m.name, d.bet_name, d.drawn_at
            FROM draws d JOIN members m ON d.member_id = m.id
            WHERE d.drawn_at = ? AND d.user_id = ?
            ORDER BY d.id DESC
        """, (today, user_id)).fetchall()
    else:
        rows = conn.execute("""
            SELECT d.id, m.name, d.bet_name, d.drawn_at
            FROM draws d JOIN members m ON d.member_id = m.id
            WHERE d.drawn_at = ? AND d.user_id IS NULL
            ORDER BY d.id DESC
        """, (today,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


# ── API: History ──

@bp.route("/api/history", methods=["GET"])
def api_history():
    limit = request.args.get("limit", 30, type=int)
    user_id = session.get("user_id")
    conn = get_db()
    if user_id:
        rows = conn.execute("""
            SELECT d.id, d.drawn_at, m.name, d.bet_name
            FROM draws d JOIN members m ON d.member_id = m.id
            WHERE d.user_id = ?
            ORDER BY d.drawn_at DESC, d.id DESC
            LIMIT ?
        """, (user_id, limit)).fetchall()
    else:
        rows = conn.execute("""
            SELECT d.id, d.drawn_at, m.name, d.bet_name
            FROM draws d JOIN members m ON d.member_id = m.id
            WHERE d.user_id IS NULL
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
    user_id = session.get("user_id")

    conn = get_db()
    if user_id:
        rows = conn.execute("""
            SELECT m.name, d.bet_name, COUNT(*) as count
            FROM draws d JOIN members m ON d.member_id = m.id
            WHERE strftime('%Y-%m', d.drawn_at) = ? AND d.user_id = ?
            GROUP BY m.name, d.bet_name
            ORDER BY count DESC, m.name
        """, (month_str, user_id)).fetchall()
    else:
        rows = conn.execute("""
            SELECT m.name, d.bet_name, COUNT(*) as count
            FROM draws d JOIN members m ON d.member_id = m.id
            WHERE strftime('%Y-%m', d.drawn_at) = ? AND d.user_id IS NULL
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
    user_id = session.get("user_id")

    conn = get_db()
    if user_id:
        rows = conn.execute("""
            SELECT strftime('%m', d.drawn_at) as month,
                   m.name, d.bet_name, COUNT(*) as count
            FROM draws d JOIN members m ON d.member_id = m.id
            WHERE strftime('%Y', d.drawn_at) = ? AND d.user_id = ?
            GROUP BY month, m.name, d.bet_name
            ORDER BY month, count DESC
        """, (str(year), user_id)).fetchall()
    else:
        rows = conn.execute("""
            SELECT strftime('%m', d.drawn_at) as month,
                   m.name, d.bet_name, COUNT(*) as count
            FROM draws d JOIN members m ON d.member_id = m.id
            WHERE strftime('%Y', d.drawn_at) = ? AND d.user_id IS NULL
            GROUP BY month, m.name, d.bet_name
            ORDER BY month, count DESC
        """, (str(year),)).fetchall()
    conn.close()

    return jsonify({
        "year": year,
        "data": [dict(r) for r in rows]
    })


# ── API: Member Groups ──

@bp.route("/api/groups", methods=["GET"])
def api_groups():
    user_id = session.get("user_id")
    conn = get_db()
    if user_id:
        rows = conn.execute(
            "SELECT id, name, member_names FROM member_groups WHERE user_id = ? ORDER BY name", (user_id,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT id, name, member_names FROM member_groups WHERE user_id IS NULL ORDER BY name"
        ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@bp.route("/api/groups", methods=["POST"])
def api_add_group():
    data = request.get_json()
    name = data.get("name", "").strip()
    member_names = data.get("member_names", "")
    if not name:
        return jsonify({"error": "그룹 이름을 입력하세요"}), 400

    user_id = session.get("user_id")
    conn = get_db()
    # 같은 이름 그룹이 있으면 업데이트
    existing = conn.execute(
        "SELECT id FROM member_groups WHERE name = ? AND (user_id = ? OR (user_id IS NULL AND ? IS NULL))",
        (name, user_id, user_id)
    ).fetchone()
    if existing:
        conn.execute("UPDATE member_groups SET member_names = ? WHERE id = ?", (member_names, existing["id"]))
        conn.commit()
        conn.close()
        return jsonify({"message": f"'{name}' 그룹 업데이트 완료", "id": existing["id"]})

    cur = conn.execute(
        "INSERT INTO member_groups (name, user_id, member_names) VALUES (?, ?, ?)",
        (name, user_id, member_names)
    )
    conn.commit()
    group_id = cur.lastrowid
    conn.close()
    return jsonify({"message": f"'{name}' 그룹 저장 완료", "id": group_id}), 201


@bp.route("/api/groups/<int:group_id>", methods=["DELETE"])
def api_delete_group(group_id):
    conn = get_db()
    cur = conn.execute("DELETE FROM member_groups WHERE id = ?", (group_id,))
    conn.commit()
    conn.close()
    if cur.rowcount:
        return jsonify({"message": "삭제 완료"})
    return jsonify({"error": "그룹을 찾을 수 없습니다"}), 404


@bp.route("/api/groups/<int:group_id>/load", methods=["POST"])
def api_load_group(group_id):
    """그룹 멤버를 현재 멤버로 교체"""
    user_id = session.get("user_id")
    conn = get_db()
    group = conn.execute("SELECT * FROM member_groups WHERE id = ?", (group_id,)).fetchone()
    if not group:
        conn.close()
        return jsonify({"error": "그룹을 찾을 수 없습니다"}), 404

    names = [n.strip() for n in group["member_names"].split(",") if n.strip()]
    if not names:
        conn.close()
        return jsonify({"error": "그룹에 멤버가 없습니다"}), 400

    try:
        # 기존 멤버 비활성화
        if user_id:
            conn.execute("UPDATE members SET active = 0 WHERE user_id = ?", (user_id,))
        else:
            conn.execute("UPDATE members SET active = 0 WHERE user_id IS NULL")

        # 그룹 멤버 활성화/추가
        for name in names:
            if user_id:
                existing = conn.execute(
                    "SELECT id FROM members WHERE name = ? AND user_id = ?", (name, user_id)
                ).fetchone()
            else:
                existing = conn.execute(
                    "SELECT id FROM members WHERE name = ? AND user_id IS NULL", (name,)
                ).fetchone()

            if existing:
                conn.execute("UPDATE members SET active = 1 WHERE id = ?", (existing["id"],))
            else:
                conn.execute("INSERT INTO members (name, user_id) VALUES (?, ?)", (name, user_id))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({"error": str(e)}), 500

    conn.close()
    return jsonify({"message": f"'{group['name']}' 그룹 불러오기 완료", "count": len(names)})


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
