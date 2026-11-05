"""Seed materials (rounded teaching values). Only inserts if table is empty."""
MATERIALS = [
    ("timber", 11, 600, 0.13, 30000, "rounded teaching assumption"),
    ("steel", 200, 7850, 50, 470000, "rounded teaching assumption"),
    ("concrete", 25, 2400, 1.4, 20000, "rounded teaching assumption"),
]


def seed(con):
    if con.execute("SELECT COUNT(*) FROM materials").fetchone()[0] == 0:
        con.executemany(
            "INSERT INTO materials(name,e_gpa,density,conductivity,cost_per_m3,note) VALUES(?,?,?,?,?,?)",
            MATERIALS)
