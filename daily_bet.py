#!/usr/bin/env python3
"""일별 내기 프로그램 - 매일 누가 쏘는지 뽑고 월별 통계를 보여줍니다."""

import sqlite3
import random
import sys
from datetime import datetime, date
from pathlib import Path

DB_PATH = Path(__file__).parent / "daily_bet.db"


def get_db():
    conn = sqlite3.connect(DB_PATH)
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
    conn.commit()
    return conn


def add_member(conn, name):
    try:
        conn.execute("INSERT INTO members (name) VALUES (?)", (name,))
        conn.commit()
        print(f"✓ '{name}' 추가 완료")
    except sqlite3.IntegrityError:
        # 이미 있지만 비활성화된 경우 다시 활성화
        conn.execute("UPDATE members SET active = 1 WHERE name = ?", (name,))
        conn.commit()
        print(f"✓ '{name}' 다시 활성화됨")


def remove_member(conn, name):
    cur = conn.execute("UPDATE members SET active = 0 WHERE name = ? AND active = 1", (name,))
    conn.commit()
    if cur.rowcount:
        print(f"✓ '{name}' 제거 완료")
    else:
        print(f"✗ '{name}'을(를) 찾을 수 없습니다")


def list_members(conn):
    rows = conn.execute("SELECT name FROM members WHERE active = 1 ORDER BY name").fetchall()
    if not rows:
        print("등록된 멤버가 없습니다. 먼저 멤버를 추가하세요.")
        return
    print(f"\n참가자 목록 ({len(rows)}명):")
    for i, (name,) in enumerate(rows, 1):
        print(f"  {i}. {name}")


def draw(conn, bet_name="커피"):
    today = date.today().isoformat()

    # 오늘 이미 뽑았는지 확인
    existing = conn.execute(
        "SELECT m.name FROM draws d JOIN members m ON d.member_id = m.id "
        "WHERE d.drawn_at = ? AND d.bet_name = ?",
        (today, bet_name)
    ).fetchone()
    if existing:
        print(f"\n오늘({today}) '{bet_name}' 이미 뽑았습니다: {existing[0]}")
        answer = input("다시 뽑으시겠습니까? (y/N): ").strip().lower()
        if answer != 'y':
            return

    members = conn.execute(
        "SELECT id, name FROM members WHERE active = 1"
    ).fetchall()
    if not members:
        print("참가자가 없습니다. 먼저 멤버를 추가하세요.")
        return
    if len(members) < 2:
        print("최소 2명 이상의 참가자가 필요합니다.")
        return

    # 랜덤 뽑기
    chosen_id, chosen_name = random.choice(members)

    conn.execute(
        "INSERT INTO draws (member_id, bet_name, drawn_at) VALUES (?, ?, ?)",
        (chosen_id, bet_name, today)
    )
    conn.commit()

    print(f"\n{'='*40}")
    print(f"  오늘의 {bet_name} 당첨자!")
    print(f"  >>> {chosen_name} <<<")
    print(f"  ({today})")
    print(f"{'='*40}")


def monthly_stats(conn, year=None, month=None):
    now = datetime.now()
    if year is None:
        year = now.year
    if month is None:
        month = now.month

    month_str = f"{year}-{month:02d}"

    rows = conn.execute("""
        SELECT m.name, d.bet_name, COUNT(*) as cnt
        FROM draws d
        JOIN members m ON d.member_id = m.id
        WHERE strftime('%Y-%m', d.drawn_at) = ?
        GROUP BY m.name, d.bet_name
        ORDER BY cnt DESC, m.name
    """, (month_str,)).fetchall()

    if not rows:
        print(f"\n{month_str} 기록이 없습니다.")
        return

    print(f"\n{'='*45}")
    print(f"  {month_str} 월별 통계")
    print(f"{'='*45}")

    # 내기 종류별로 그룹핑
    from collections import defaultdict
    by_bet = defaultdict(list)
    for name, bet_name, cnt in rows:
        by_bet[bet_name].append((name, cnt))

    for bet_name, entries in by_bet.items():
        total = sum(cnt for _, cnt in entries)
        print(f"\n  [{bet_name}] (총 {total}회)")
        print(f"  {'이름':<10} {'횟수':>5}  {'비율':>6}")
        print(f"  {'-'*25}")
        for name, cnt in entries:
            pct = cnt / total * 100
            bar = '█' * cnt
            print(f"  {name:<10} {cnt:>5}회  {pct:>5.1f}%  {bar}")


def yearly_stats(conn, year=None):
    if year is None:
        year = datetime.now().year

    rows = conn.execute("""
        SELECT strftime('%m', d.drawn_at) as month,
               m.name, d.bet_name, COUNT(*) as cnt
        FROM draws d
        JOIN members m ON d.member_id = m.id
        WHERE strftime('%Y', d.drawn_at) = ?
        GROUP BY month, m.name, d.bet_name
        ORDER BY month, cnt DESC
    """, (str(year),)).fetchall()

    if not rows:
        print(f"\n{year}년 기록이 없습니다.")
        return

    print(f"\n{'='*50}")
    print(f"  {year}년 연간 통계")
    print(f"{'='*50}")

    from collections import defaultdict
    by_month = defaultdict(list)
    for month, name, bet_name, cnt in rows:
        by_month[month].append((name, bet_name, cnt))

    for month in sorted(by_month.keys()):
        entries = by_month[month]
        print(f"\n  --- {year}-{month} ---")
        for name, bet_name, cnt in entries:
            print(f"    {name:<10} {bet_name:<8} {cnt}회")


def history(conn, limit=20):
    rows = conn.execute("""
        SELECT d.drawn_at, m.name, d.bet_name
        FROM draws d
        JOIN members m ON d.member_id = m.id
        ORDER BY d.drawn_at DESC, d.id DESC
        LIMIT ?
    """, (limit,)).fetchall()

    if not rows:
        print("\n기록이 없습니다.")
        return

    print(f"\n최근 {limit}건 기록:")
    print(f"  {'날짜':<12} {'당첨자':<10} {'내기'}")
    print(f"  {'-'*35}")
    for drawn_at, name, bet_name in rows:
        print(f"  {drawn_at:<12} {name:<10} {bet_name}")


def print_help():
    print("""
일별 내기 프로그램
==================

사용법:
  python daily_bet.py <명령> [옵션]

명령어:
  add <이름>              멤버 추가
  remove <이름>           멤버 제거
  list                    멤버 목록 보기
  draw [내기이름]         오늘 뽑기 (기본: 커피)
  stats [YYYY] [MM]      월별 통계 (기본: 이번 달)
  year [YYYY]            연간 통계 (기본: 올해)
  history [건수]          최근 기록 보기 (기본: 20건)
  help                    도움말

예시:
  python daily_bet.py add 홍길동
  python daily_bet.py add 김철수
  python daily_bet.py draw              # 오늘 커피 뽑기
  python daily_bet.py draw 점심         # 오늘 점심 뽑기
  python daily_bet.py stats             # 이번 달 통계
  python daily_bet.py stats 2026 3      # 2026년 3월 통계
  python daily_bet.py year              # 올해 연간 통계
  python daily_bet.py history 10        # 최근 10건
""")


def main():
    if len(sys.argv) < 2:
        print_help()
        return

    conn = get_db()
    cmd = sys.argv[1]

    if cmd == "add" and len(sys.argv) >= 3:
        add_member(conn, sys.argv[2])
    elif cmd == "remove" and len(sys.argv) >= 3:
        remove_member(conn, sys.argv[2])
    elif cmd == "list":
        list_members(conn)
    elif cmd == "draw":
        bet_name = sys.argv[2] if len(sys.argv) >= 3 else "커피"
        draw(conn, bet_name)
    elif cmd == "stats":
        year = int(sys.argv[2]) if len(sys.argv) >= 3 else None
        month = int(sys.argv[3]) if len(sys.argv) >= 4 else None
        monthly_stats(conn, year, month)
    elif cmd == "year":
        year = int(sys.argv[2]) if len(sys.argv) >= 3 else None
        yearly_stats(conn, year)
    elif cmd == "history":
        limit = int(sys.argv[2]) if len(sys.argv) >= 3 else 20
        history(conn, limit)
    else:
        print_help()

    conn.close()


if __name__ == "__main__":
    main()
