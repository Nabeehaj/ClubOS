"""Draws the wireframe PNGs. Gray monospace labels show which endpoint or field fills each area.

Usage: python docs/wireframes/generate.py  (requires pillow)
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent
W, H = 1440, 960
BLACK, MID, LIGHT, FAINT, WHITE = (20, 20, 20), (120, 120, 120), (200, 200, 200), (240, 240, 240), (255, 255, 255)


def font(size, bold=False, mono=False):
    names = ["consola.ttf"] if mono else (["arialbd.ttf"] if bold else ["arial.ttf"])
    names += ["DejaVuSansMono.ttf" if mono else "DejaVuSans.ttf"]
    for n in names:
        for base in ("C:/Windows/Fonts/", "/usr/share/fonts/truetype/dejavu/", ""):
            try:
                return ImageFont.truetype(base + n, size)
            except OSError:
                continue
    return ImageFont.load_default()


F = {"h1": font(26, True), "h2": font(17, True), "b": font(14, True), "t": font(14), "s": font(12),
     "api": font(12, mono=True)}


class Screen:
    def __init__(self, name, title, active=None, shell=True):
        self.name, self.title = name, title
        self.img = Image.new("RGB", (W, H), WHITE)
        self.d = ImageDraw.Draw(self.img)
        if shell:
            self.shell(active)

    # primitives
    def box(self, x, y, w, h, title=None, api=None, fill=WHITE, dashed=False):
        if dashed:
            for i in range(x, x + w, 10):
                self.d.line([(i, y), (min(i + 5, x + w), y)], fill=BLACK)
                self.d.line([(i, y + h), (min(i + 5, x + w), y + h)], fill=BLACK)
            for j in range(y, y + h, 10):
                self.d.line([(x, j), (x, min(j + 5, y + h))], fill=BLACK)
                self.d.line([(x + w, j), (x + w, min(j + 5, y + h))], fill=BLACK)
        else:
            self.d.rounded_rectangle([x, y, x + w, y + h], radius=8, outline=BLACK, width=2, fill=fill)
        cy = y + 12
        if title:
            self.d.text((x + 14, cy), title, font=F["h2"], fill=BLACK)
            cy += 24
        if api:
            self.api(x + 14, cy, api)
            cy += 18
        return cy + 6

    def text(self, x, y, s, f="t", color=BLACK):
        self.d.text((x, y), s, font=F[f], fill=color)

    def api(self, x, y, s):
        self.d.text((x, y), "<- " + s, font=F["api"], fill=MID)

    def fillbox(self, x, y, w, h, label="", f="s"):
        self.d.rounded_rectangle([x, y, x + w, y + h], radius=6, fill=FAINT, outline=LIGHT)
        if label:
            self.text(x + 10, y + (h - 14) // 2, label, f)

    def button(self, x, y, label, primary=False, w=None):
        w = w or int(self.d.textlength(label, font=F["b"])) + 28
        self.d.rounded_rectangle([x, y, x + w, y + 32], radius=6, outline=BLACK, width=2,
                                 fill=BLACK if primary else WHITE)
        self.d.text((x + 14, y + 8), label, font=F["b"], fill=WHITE if primary else BLACK)
        return x + w + 10

    def pill(self, x, y, label):
        w = int(self.d.textlength(label, font=F["s"])) + 18
        self.d.rounded_rectangle([x, y, x + w, y + 20], radius=10, outline=BLACK, fill=WHITE)
        self.text(x + 9, y + 3, label, "s")
        return x + w + 6

    def bar(self, x, y, w, ratio, h=10):
        self.d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=FAINT, outline=LIGHT)
        if ratio > 0:
            self.d.rounded_rectangle([x, y, x + max(h, int(w * ratio)), y + h], radius=h // 2, fill=MID)

    def avatar(self, x, y, r=14, initials=""):
        self.d.ellipse([x, y, x + 2 * r, y + 2 * r], outline=BLACK, width=2, fill=FAINT)
        if initials:
            tw = self.d.textlength(initials, font=F["s"])
            self.text(x + r - tw / 2, y + r - 7, initials, "s")

    def ring(self, x, y, r, pct, label):
        self.d.ellipse([x, y, x + 2 * r, y + 2 * r], outline=LIGHT, width=10)
        self.d.arc([x, y, x + 2 * r, y + 2 * r], -90, -90 + 360 * pct / 100, fill=BLACK, width=10)
        tw = self.d.textlength(f"{pct}%", font=F["h1"])
        self.d.text((x + r - tw / 2, y + r - 18), f"{pct}%", font=F["h1"], fill=BLACK)
        tw = self.d.textlength(label, font=F["s"])
        self.text(x + r - tw / 2, y + r + 12, label, "s", MID)

    def note(self, x, y, s):
        w = int(self.d.textlength(s, font=F["s"])) + 20
        self.d.rectangle([x, y, x + w, y + 22], fill=WHITE, outline=BLACK)
        self.text(x + 10, y + 4, s, "s")

    # app shell
    def shell(self, active):
        d = self.d
        d.rectangle([0, 0, 220, H], fill=FAINT, outline=BLACK)
        self.text(24, 22, "ClubOS", "h1")
        self.fillbox(16, 70, 188, 44)
        self.avatar(24, 78, 14, "TS")
        self.text(60, 80, "SBU Tech Society  v", "b")
        self.text(60, 96, "President", "s", MID)
        self.api(16, 118, "GET /api/clubs")
        nav = ["Dashboard", "Events", "Tasks", "ClubChat", "Approvals", "Finance", "Vendors", "Emails", "Members"]
        for i, n in enumerate(nav):
            y = 150 + i * 42
            if n == active:
                d.rounded_rectangle([12, y - 6, 208, y + 28], radius=6, fill=BLACK)
                self.text(28, y + 2, n, "b", WHITE)
            else:
                self.text(28, y + 2, n, "t")
        self.fillbox(16, H - 70, 188, 50, "  Log out")
        d.line([(220, 64), (W, 64)], fill=BLACK, width=2)
        self.text(244, 20, self.title, "h1")
        self.fillbox(820, 14, 300, 36, "Search events, tasks, people...")
        self.button(1136, 16, "AI Assistant", primary=True)
        self.avatar(1290, 16, 16, "SC")
        self.text(1328, 18, "Sarah Chen", "b")
        self.text(1328, 36, "GET /auth/me", "api", MID)

    def save(self):
        self.img.save(OUT / f"{self.name}.png")
        return self


# screens

def login():
    s = Screen("00-login", "Login", shell=False)
    s.text(620, 150, "ClubOS", "h1")
    s.text(560, 190, "Run your club from one place.", "t", MID)
    y = s.box(470, 240, 500, 420, "Sign in", "POST /api/auth/login {email, password}")
    s.text(500, y + 10, "Email", "b")
    s.fillbox(500, y + 32, 440, 40, "sarah@sbu.clubos")
    s.text(500, y + 90, "Password", "b")
    s.fillbox(500, y + 112, 440, 40, "**************")
    s.button(500, y + 180, "Log in", primary=True, w=440)
    s.text(500, y + 240, "Response: access_token, user, clubs[], default_club_id", "api", MID)
    s.text(500, y + 262, "On success -> open Dashboard of default_club_id", "s", MID)
    s.text(500, y + 284, "On 401 -> show 'Wrong email or password'", "s", MID)
    s.note(470, 700, "Store access_token; send it as  Authorization: Bearer <token>  on every request")
    return s.save()


def dashboard():
    s = Screen("01-dashboard", "Dashboard", "Dashboard")
    s.api(244, 72, "GET /api/clubs/{club_id}/dashboard")
    stats = [("Members", "120"), ("Upcoming events", "4"), ("Open tasks", "13"), ("Budget left", "$4,460"),
             ("Needs approval", "9")]
    for i, (k, v) in enumerate(stats):
        x = 244 + i * 236
        s.box(x, 96, 220, 96)
        s.text(x + 16, 110, k, "t", MID)
        s.text(x + 16, 134, v, "h1")
        s.text(x + 16, 168, "stats." + ["members", "upcoming_events", "open_tasks", "budget_remaining",
                                         "pending_approvals"][i], "api", MID)
    y = s.box(244, 210, 700, 330, "Upcoming events", "upcoming_events[]  (name, date, location, readiness.score)")
    for i, (n, dt, pct) in enumerate([("Fall Tech Networking Night", "Nov 5 - SAC Ballroom A", 75),
                                      ("AI Workshop", "Nov 12 - Frey Hall 102", 35),
                                      ("Hackathon Social", "Nov 20 - SAC Meeting Room 2", 50),
                                      ("End-of-Semester Celebration", "Dec 4 - SAC Auditorium", 5)]):
        yy = y + i * 66
        s.fillbox(258, yy, 672, 58)
        s.text(272, yy + 8, n, "b")
        s.text(272, yy + 30, dt, "s", MID)
        s.text(640, yy + 10, f"Readiness {pct}%", "s")
        s.bar(640, yy + 32, 180, pct / 100)
        s.pill(840, yy + 18, "Open >")
    y = s.box(960, 210, 460, 330, "Approvals needing action", "approvals_needing_action[]")
    for i, (lbl, st) in enumerate([("SB Engaged - Networking Night", "Pending"), ("25Live - Frey Hall 102", "Pending"),
                                   ("NXT - Networking Night catering", "Pending"),
                                   ("SB Engaged - AI Workshop", "Draft"), ("25Live - SAC Meeting Room 2", "Draft")]):
        yy = y + i * 54
        s.text(976, yy + 6, lbl, "t")
        s.pill(976, yy + 26, st)
        s.text(1300, yy + 28, "due Oct 29", "s", MID)
    y = s.box(244, 556, 460, 380, "My tasks / Pending tasks", "my_tasks[], pending_tasks[]")
    for i, t in enumerate(["Submit SB Engaged form", "Draft spring semester calendar", "Contact catering vendor",
                           "Send speaker invitations", "Confirm workshop instructor"]):
        yy = y + i * 56
        s.d.rectangle([260, yy + 6, 276, yy + 22], outline=BLACK, width=2)
        s.text(290, yy + 4, t, "t")
        s.text(290, yy + 24, "Assignee - due Oct 27 - High", "s", MID)
    y = s.box(720, 556, 330, 380, "Budget by category", "budget_by_category[] (planned, spent)")
    for i, c in enumerate(["Events", "Food & Catering", "Merchandise", "Marketing", "Equipment"]):
        yy = y + i * 56
        s.text(736, yy, c, "t")
        s.text(940, yy, "$150 / $2,000", "s", MID)
        s.bar(736, yy + 22, 296, [0.08, 0.22, 0.05, 0.3, 0.12][i])
    y = s.box(1066, 556, 354, 380, "Recent activity", "recent_activity[] (actor, text, created_at)")
    for i in range(6):
        yy = y + i * 52
        s.avatar(1080, yy, 13)
        s.text(1116, yy, ["Emily added $150 expense", "Aisha completed a task", "25Live: Ballroom approved",
                          "Sarah turned a message into a task", "Adam moved task to In Progress",
                          "Task created with ClubOS AI"][i], "s")
        s.text(1116, yy + 18, "2h ago", "s", MID)
    return s.save()


def event_workspace():
    s = Screen("02-event-workspace", "Fall Tech Networking Night", "Events")
    s.api(244, 72, "GET /api/clubs/{club_id}/events/{event_id}/workspace")
    s.box(244, 96, 1176, 120)
    s.text(264, 110, "Nov 5, 6:00 PM - 9:00 PM  |  SAC Ballroom A  |  150 expected", "b")
    s.text(264, 136, "Lead: Aisha Rahman  |  Budget $1,500", "t")
    x = s.pill(264, 164, "Planning")
    s.text(x + 6, 166, "event.* (status editable: PATCH /events/{id})", "api", MID)
    s.ring(1250, 104, 52, 75, "readiness")
    s.text(1110, 190, "readiness.parts[]", "api", MID)
    y = s.box(244, 232, 560, 440, "Tasks  5/8 done", "tasks[]  |  + New: POST /tasks  |  assign: PATCH /tasks/{id}")
    for i, (t, who, st) in enumerate([("Reserve SAC Ballroom", "AR", "Completed"),
                                      ("Submit SB Engaged form", "SC", "In Progress"),
                                      ("Contact catering vendor", "EP", "To Do"),
                                      ("Design event flyer", "DL", "Completed"),
                                      ("Send speaker invitations", "AK", "In Progress"),
                                      ("Prepare event budget", "EP", "Completed")]):
        yy = y + i * 54
        s.fillbox(258, yy, 532, 46)
        s.text(272, yy + 14, t, "t")
        s.avatar(600, yy + 9, 14, who)
        s.pill(640, yy + 13, st)
    s.button(258, y + 330, "+ Add task")
    s.note(380, y + 334, "Assignee picker = GET /members")
    y = s.box(820, 232, 600, 210, "University approvals (SIMULATED)",
              "reservation_25live, sb_engaged, financial_requests[]")
    for i, (k, st) in enumerate([("25Live", "Approved"), ("SB Engaged", "Pending"), ("NXT", "Pending")]):
        x = 836 + i * 192
        s.fillbox(x, y, 180, 120)
        s.text(x + 12, y + 10, k, "b")
        s.pill(x + 12, y + 36, st)
        s.text(x + 12, y + 66, "SIM-25L-482913" if i == 0 else "3/4 docs" if i == 1 else "$450 catering", "s", MID)
        s.text(x + 12, y + 90, "[Simulate next]", "s")
    y = s.box(820, 456, 290, 216, "Event budget", "budget{planned, spent, expenses[]}")
    s.text(836, y, "$375 spent of $1,500", "b")
    s.bar(836, y + 26, 258, 0.25, 14)
    for i, e in enumerate(["Ballroom decorations  $150", "Flyer printing  $45", "Instagram promo  $30"]):
        s.text(836, y + 54 + i * 22, e, "s")
    y = s.box(1126, 456, 294, 216, "Vendors", "vendors[] (link_status)")
    for i, (v, st) in enumerate([("Campus Bites Catering", "Quote Requested"), ("BrightFrame Media", "Considering")]):
        s.text(1142, y + i * 56, v, "b")
        s.pill(1142, y + i * 56 + 22, st)
    y = s.box(244, 688, 760, 248, "#event-planning chat", "channel, recent_messages[]  (open full chat ->)")
    for i, (w, m) in enumerate([("Sarah", "Hey everyone! We need to finalize the networking night details."),
                                ("Aisha", "I've completed the room reservation checklist."),
                                ("Emily", "I'll contact the catering vendor today."),
                                ("Daniel", "The promotional flyer is ready for review!")]):
        s.text(260, y + i * 34, f"{w}:", "b")
        s.text(330, y + i * 34, m, "t")
    y = s.box(1020, 688, 400, 248, "Email drafts", "email_drafts[]")
    for i, e in enumerate(["You're invited: Fall Tech Networking Night", "Catering quote request"]):
        s.fillbox(1036, y + i * 54, 368, 44, e)
    s.button(1036, y + 116, "Generate email for this event")
    return s.save()


def tasks():
    s = Screen("03-tasks", "Tasks", "Tasks")
    s.api(244, 72, "GET /api/clubs/{club_id}/tasks?event_id=&assignee_id=&status=&mine=true")
    x = 244
    for f in ["All events v", "All members v", "Mine only [ ]"]:
        s.fillbox(x, 96, 180, 34, f)
        x += 196
    s.button(1290, 98, "+ New task", primary=True)
    cols = [("To Do", 6), ("In Progress", 5), ("Completed", 4)]
    for i, (c, n) in enumerate(cols):
        x = 244 + i * 300
        y = s.box(x, 148, 284, 790, f"{c}  ({n})")
        for j in range(min(n, 6)):
            yy = y + j * 112
            s.fillbox(x + 12, yy, 260, 100)
            s.text(x + 24, yy + 10, ["Contact catering vendor", "Order merchandise", "Book a DJ",
                                     "Prepare starter notebook", "Check outlets", "Draft spring calendar"][j], "b")
            s.text(x + 24, yy + 32, "Fall Tech Networking Night", "s", MID)
            s.avatar(x + 24, yy + 56, 13, "EP")
            s.text(x + 60, yy + 62, "due Oct 28", "s")
            s.pill(x + 170, yy + 60, "High")
    s.note(300, 900, "Drag card between columns -> PATCH /tasks/{id} {status}")
    y = s.box(1160, 148, 260, 790, "New / edit task", "POST /tasks  |  PATCH /tasks/{id}")
    for k in ["Title", "Description", "Event (GET /events)", "Assignee (GET /members)", "Priority Low/Med/High",
              "Due date", "Status"]:
        s.text(1176, y, k, "s", MID)
        s.fillbox(1176, y + 18, 228, 34)
        y += 66
    s.button(1176, y + 6, "Save", primary=True, w=228)
    s.button(1176, y + 50, "Delete (DELETE /tasks/{id})", w=228)
    return s.save()


def chat():
    s = Screen("04-clubchat", "ClubChat", "ClubChat")
    y = s.box(244, 84, 260, 852, "Channels", "GET /channels")
    for i, c in enumerate(["# general", "# executive-board", "# event-planning", "# finance"]):
        if i == 2:
            s.d.rounded_rectangle([256, y + i * 50 - 4, 492, y + i * 50 + 34], radius=6, fill=BLACK)
            s.text(270, y + i * 50 + 6, c, "b", WHITE)
        else:
            s.text(270, y + i * 50 + 6, c, "t")
        s.text(270, y + i * 50 + 24, "last_message, message_count" if i == 0 else "", "api", MID)
    y = s.box(520, 84, 560, 852, "# event-planning", "GET /channels/{id}/messages?after_id=<last>  (poll every 3s)")
    msgs = [("SC", "Sarah Chen", "Hey everyone! We need to finalize the networking night details."),
            ("AR", "Aisha Rahman", "I've completed the room reservation checklist."),
            ("EP", "Emily Park", "I'll contact the catering vendor today."),
            ("DL", "Daniel Lee", "The promotional flyer is ready for review!"),
            ("SC", "Sarah Chen", "Can someone order name tags and lanyards for networking night?")]
    for i, (ini, n, m) in enumerate(msgs):
        yy = y + i * 92
        if i == 4:
            s.d.rounded_rectangle([530, yy - 8, 1070, yy + 84], radius=6, outline=BLACK, width=2)
            s.button(584, yy + 46, "-> Make task")
        s.avatar(540, yy, 16, ini)
        s.text(584, yy, n, "b")
        s.text(584, yy + 22, m, "t")
    yy = y + 5 * 92 + 6
    s.fillbox(540, yy, 520, 40, "ClubOS bot: Sarah turned a message into a task ... (is_bot = true)")
    s.fillbox(536, 870, 430, 48, "Type a message...")
    s.button(978, 878, "Send", primary=True)
    s.text(536, 846, "POST /channels/{id}/messages {body}", "api", MID)
    y = s.box(1096, 84, 324, 520, "Make task from message", "POST /messages/{id}/to-task")
    for k, v in [("Title", "Order name tags and lanyards"), ("Assignee", "James Wilson v"),
                 ("Event", "Fall Tech Networking Night"), ("Due date", "Nov 1"), ("Priority", "High v")]:
        s.text(1112, y, k, "s", MID)
        s.fillbox(1112, y + 18, 292, 34, v)
        y += 66
    s.button(1112, y + 10, "Create task", primary=True, w=292)
    s.text(1112, y + 56, "All fields optional; defaults =", "s", MID)
    s.text(1112, y + 74, "message text + message author", "s", MID)
    return s.save()


def approvals():
    s = Screen("05-approvals", "Approvals", "Approvals")
    s.d.rectangle([244, 80, 1420, 112], fill=FAINT, outline=BLACK)
    s.text(258, 88, "SIMULATED for demo - not connected to 25Live, SB Engaged, or NXT. Numbers start with SIM-.", "b")
    y = s.box(244, 126, 1176, 420, "Approvals center", "GET /api/clubs/{club_id}/approvals")
    heads = ["Event", "25Live", "SB Engaged", "NXT", "Readiness"]
    xs = [262, 560, 760, 960, 1160]
    for h, x in zip(heads, xs):
        s.text(x, y, h, "b")
    rows = [("Fall Tech Networking Night", "Approved", "Pending", "Pending", 75),
            ("AI Workshop", "Pending", "Draft", "Draft", 35),
            ("Hackathon Social", "Draft", "Approved", "Submitted", 50),
            ("End-of-Semester Celebration", "-", "Not Started", "Draft", 5)]
    for i, r in enumerate(rows):
        yy = y + 36 + i * 76
        s.d.line([(258, yy - 10), (1406, yy - 10)], fill=LIGHT)
        s.text(262, yy + 10, r[0], "t")
        for j in range(3):
            s.pill(xs[j + 1], yy + 8, r[j + 1])
        s.bar(1160, yy + 14, 160, r[4] / 100, 12)
        s.text(1330, yy + 10, f"{r[4]}%", "b")
    y = s.box(244, 562, 580, 374, "SB Engaged - Networking Night", "PATCH /sb-engaged/{id}  |  .../simulate-next")
    s.pill(260, y, "Pending")
    s.text(340, y + 2, "Ref SIM-SBE-771204  -  deadline Oct 29", "s", MID)
    for i, (doc, done) in enumerate([("Event registration form", 1), ("Risk management form", 1),
                                     ("Food & catering form", 1), ("Speaker / guest list", 0)]):
        yy = y + 40 + i * 34
        s.d.rectangle([260, yy, 278, yy + 18], outline=BLACK, width=2, fill=MID if done else WHITE)
        s.text(292, yy, doc, "t")
    s.text(260, y + 184, "POST /sb-engaged/{id}/documents/{index}/toggle", "api", MID)
    s.text(260, y + 212, "Pending actions: Upload final speaker list", "s")
    s.button(260, y + 250, "Simulate next step")
    y = s.box(840, 562, 580, 374, "25Live - Frey Hall 102", "PATCH /reservations/{id}  |  .../simulate-next")
    for i, (k, v) in enumerate([("Requested date", "Nov 12, 4:30-7:15 PM"), ("Capacity", "60"),
                                ("Submit by", "Oct 29"), ("Confirmation #", "(after approval)")]):
        s.text(856, y + i * 40, k, "s", MID)
        s.text(1040, y + i * 40, v, "b")
    s.pill(856, y + 170, "Pending")
    s.button(856, y + 250, "Simulate next step")
    return s.save()


def finance():
    s = Screen("06-finance", "Finance", "Finance")
    s.api(244, 72, "GET /api/clubs/{club_id}/finance/summary")
    for i, (k, v) in enumerate([("Annual budget", "$5,000"), ("Spent", "$540"), ("Remaining", "$4,460"),
                                ("Unallocated", "$500")]):
        x = 244 + i * 296
        s.box(x, 96, 280, 90)
        s.text(x + 16, 110, k, "t", MID)
        s.text(x + 16, 134, v, "h1")
    y = s.box(244, 202, 580, 330, "Budget by category", "categories[] (planned, spent, remaining, percent_used)")
    for i, (c, p) in enumerate([("Events", 2000), ("Food & Catering", 1000), ("Merchandise", 750),
                                ("Marketing", 250), ("Equipment", 500)]):
        yy = y + i * 50
        s.text(260, yy, c, "t")
        s.text(640, yy, f"$-- / ${p:,}", "s", MID)
        s.bar(260, yy + 22, 540, [0.08, 0.22, 0.05, 0.3, 0.12][i], 12)
    s.text(260, y + 254, "Edit planned: PATCH /finance/categories/{id} (Pres/Treasurer)", "api", MID)
    y = s.box(840, 202, 580, 330, "Add expense", "POST /finance/expenses -> returns updated budget")
    for i, k in enumerate(["Description", "Amount", "Category v", "Event (optional) v", "Vendor (optional) v"]):
        s.fillbox(856 + (i % 2) * 276, y + (i // 2) * 56, 264, 40, k)
    s.button(856, y + 180, "Add expense", primary=True)
    s.note(1010, y + 184, "Hide/disable if can_manage_finance = false")
    y = s.box(244, 548, 580, 388, "Recent expenses", "recent_expenses[]  |  DELETE /finance/expenses/{id}")
    for i, e in enumerate(["Ballroom decorations - Events - $150", "HDMI adapters - Equipment - $60",
                           "Flyer printing - Marketing - $45", "Instagram promo - Marketing - $30",
                           "Sticker sample - Merchandise - $35", "Welcome pizza - Food - $220"]):
        s.text(260, y + i * 46, e, "t")
        s.text(260, y + i * 46 + 20, "by Emily Park - Oct 21", "s", MID)
    y = s.box(840, 548, 580, 388, "NXT financial requests (SIMULATED)",
              "financial_requests[]  |  POST /finance/requests  |  .../simulate-next")
    for i, (t, a, st) in enumerate([("Networking Night catering", 450, "Pending"),
                                    ("Networking Night decorations", 150, "Approved"),
                                    ("Workshop supplies", 120, "Draft"), ("Hackathon Social pizza", 300, "Submitted"),
                                    ("Club T-shirts", 300, "Draft")]):
        yy = y + i * 56
        s.text(856, yy, t, "t")
        s.text(856, yy + 20, f"${a}", "s", MID)
        s.pill(1200, yy + 6, st)
    return s.save()


def vendors():
    s = Screen("07-vendors", "Vendors", "Vendors")
    s.api(244, 72, "GET /api/clubs/{club_id}/vendors?category=")
    s.d.rectangle([244, 92, 1420, 120], fill=FAINT, outline=BLACK)
    s.text(258, 98, "Sample vendors - not verified SBU-approved businesses  (is_sample = true)", "b")
    vs = [("Campus Bites Catering", "Food", 450), ("PrintWorks Studio", "Merchandise", 300),
          ("BrightFrame Media", "Photography", 250), ("EventSpark Rentals", "Equipment", 200),
          ("Sweet Treats Co.", "Desserts", 150)]
    for i, (n, c, cost) in enumerate(vs):
        x = 244 + (i % 3) * 300
        y = 136 + (i // 3) * 300
        yy = s.box(x, y, 284, 284, n)
        s.pill(x + 14, yy, c)
        s.text(x + 14, yy + 34, f"Est. ${cost}", "b")
        s.text(x + 14, yy + 60, "contact_name, email, phone", "api", MID)
        s.text(x + 14, yy + 80, "services[]", "api", MID)
        s.text(x + 14, yy + 100, "events[] (linked + status)", "api", MID)
        s.button(x + 14, yy + 170, "Request quote")
    s.note(560, 760, "'Request quote' -> Emails screen with template = catering_quote, vendor_id")
    y = s.box(1160, 136, 260, 800, "Vendor detail", "GET /vendors/{id}")
    for k in ["Name", "Category", "Contact", "Email", "Phone", "Services", "Estimated cost", "Notes"]:
        s.text(1176, y, k, "s", MID)
        s.fillbox(1176, y + 18, 228, 32)
        y += 62
    s.text(1176, y, "Attach to event:", "b")
    s.text(1176, y + 22, "POST /events/{id}/vendors", "api", MID)
    s.text(1176, y + 40, "{vendor_id, status}", "api", MID)
    return s.save()


def emails():
    s = Screen("08-email-generator", "Email generator", "Emails")
    y = s.box(244, 84, 380, 852, "1. Pick template + event", "GET /emails/templates")
    for i, t in enumerate(["Event invitation to members", "Catering quote request", "Board meeting reminder"]):
        yy = y + i * 54
        s.d.ellipse([262, yy + 10, 280, yy + 28], outline=BLACK, width=2, fill=BLACK if i == 0 else WHITE)
        s.text(294, yy + 10, t, "t")
    yy = y + 180
    s.text(262, yy, "Event", "s", MID)
    s.fillbox(262, yy + 18, 344, 36, "Fall Tech Networking Night v")
    s.text(262, yy + 66, "Vendor (catering only)", "s", MID)
    s.fillbox(262, yy + 84, 344, 36, "Campus Bites Catering v")
    s.text(262, yy + 132, "Extra note (optional)", "s", MID)
    s.fillbox(262, yy + 150, 344, 80)
    s.button(262, yy + 250, "Generate", primary=True, w=344)
    s.text(262, yy + 294, "POST /emails/generate", "api", MID)
    s.text(262, yy + 312, "{template, event_id, vendor_id, extra_note}", "api", MID)
    y = s.box(640, 84, 780, 600, "2. Review & edit", "response: to, subject, body, mailto")
    s.text(660, y, "To", "s", MID)
    s.fillbox(660, y + 18, 740, 36, "techsociety@sbu.clubos")
    s.text(660, y + 64, "Subject", "s", MID)
    s.fillbox(660, y + 82, 740, 36, "You're invited: Fall Tech Networking Night - Thursday, November 5")
    s.text(660, y + 128, "Body", "s", MID)
    s.fillbox(660, y + 146, 740, 300)
    for i, line in enumerate(["Hi SBU Tech Society members!", "", "You're invited to Fall Tech Networking Night.",
                              "When: Thursday, November 5, 6:00 PM - 9:00 PM", "Where: SAC Ballroom A", "",
                              "Meet engineers and recruiters ...", "", "Best,", "Sarah Chen"]):
        s.text(676, y + 158 + i * 26, line, "t")
    y = s.box(640, 700, 780, 236, "3. Finish")
    x = s.button(660, y, "AI Polish (tone v)")
    x = s.button(x, y, "Open in mail app", primary=True)
    x = s.button(x, y, "Save draft")
    s.text(660, y + 46, "AI Polish: POST /emails/polish {subject, body, tone}  (503 = AI unavailable -> disable button)",
           "api", MID)
    s.text(660, y + 66, "Open in mail app: window.location = mailto  (rebuild after edits: POST /emails/mailto)",
           "api", MID)
    s.text(660, y + 86, "Save draft: POST /emails/drafts   |   list: GET /emails/drafts?event_id=", "api", MID)
    return s.save()


def members():
    s = Screen("09-members", "Executive board", "Members")
    s.api(244, 72, "GET /api/clubs/{club_id}/members  |  detail: GET /members/{user_id} (+ their tasks)")
    people = [("Sarah Chen", "President", "SC"), ("Adam Khan", "Vice President", "AK"),
              ("Emily Park", "Treasurer", "EP"), ("James Wilson", "Secretary", "JW"),
              ("Aisha Rahman", "Events Chair", "AR"), ("Daniel Lee", "Marketing Chair", "DL"),
              ("Priya Patel", "Outreach Chair", "PP")]
    for i, (n, p, ini) in enumerate(people):
        x = 244 + (i % 4) * 296
        y = 100 + (i // 4) * 330
        s.box(x, y, 280, 310)
        s.avatar(x + 100, y + 20, 40, ini)
        tw = s.d.textlength(n, font=F["h2"])
        s.d.text((x + 140 - tw / 2, y + 112), n, font=F["h2"], fill=BLACK)
        tw = s.d.textlength(p, font=F["t"])
        s.text(x + 140 - tw / 2, y + 138, p, "t", MID)
        s.text(x + 20, y + 176, "Tasks: 4   Open: 2   Done: 2", "b")
        s.bar(x + 20, y + 202, 240, 0.5)
        s.text(x + 20, y + 226, "responsibilities[]", "api", MID)
        s.text(x + 20, y + 246, "major, class_year, email", "api", MID)
        s.button(x + 20, y + 268, "View tasks")
    s.note(1136, 760, "avatar_url is provided (or use initials)")
    return s.save()


def ai_panel():
    s = Screen("10-ai-assistant", "Dashboard  (AI Assistant open)", "Dashboard")
    s.d.rectangle([220, 66, W, H], fill=FAINT)
    s.text(260, 100, "(page underneath, dimmed)", "t", MID)
    x0 = 900
    s.d.rectangle([x0, 66, W, H], fill=WHITE, outline=BLACK, width=2)
    s.text(x0 + 20, 82, "ClubOS AI Assistant", "h2")
    s.text(x0 + 20, 108, "GET /agent/status -> {available} (hide or disable if false)", "api", MID)
    s.d.rounded_rectangle([x0 + 200, 140, W - 20, 196], radius=10, fill=FAINT, outline=LIGHT)
    s.text(x0 + 214, 150, "Who should book a photographer for", "t")
    s.text(x0 + 214, 170, "networking night? Assign it.", "t")
    s.d.rounded_rectangle([x0 + 20, 212, W - 120, 290], radius=10, outline=BLACK, width=2)
    s.text(x0 + 34, 224, "Daniel has the fewest open tasks and runs", "t")
    s.text(x0 + 34, 244, "photography. I proposed a task, confirm it below.", "t")
    s.text(x0 + 34, 266, "reply", "api", MID)
    y = s.box(x0 + 20, 306, 500, 150, "Proposed change", "proposals[] (id, summary, kind, payload)")
    s.text(x0 + 36, y, "Create task \"Book a photographer\" -> Daniel Lee,", "t")
    s.text(x0 + 36, y + 20, "due Nov 1, High priority", "t")
    s.button(x0 + 36, y + 50, "Confirm", primary=True)
    s.button(x0 + 150, y + 50, "Reject")
    s.text(x0 + 36, 470, "POST /agent/actions/{id}/confirm | /reject", "api", MID)
    y = s.box(x0 + 20, 500, 500, 160, "Email draft", "emails[] (to, subject, body, mailto)")
    s.text(x0 + 36, y, "You're invited: Fall Tech Networking Night", "t")
    s.button(x0 + 36, y + 40, "Open in mail app")
    s.button(x0 + 210, y + 40, "Edit in Email generator")
    s.text(x0 + 20, 690, "Try asking:", "b")
    for i, q in enumerate(["What's left for Networking Night?", "Who has the most tasks?",
                           "Summarize #event-planning into tasks", "Draft the invite for AI Workshop"]):
        s.pill(x0 + 20, 716 + i * 30, q)
    s.fillbox(x0 + 20, 870, 420, 48, "Ask ClubOS AI...")
    s.button(x0 + 450, 878, "Send", primary=True)
    s.text(x0 + 20, 846, "POST /agent/chat {message, history[]}", "api", MID)
    return s.save()


def club_switcher():
    s = Screen("11-club-switcher", "Dashboard  (club switcher open)", "Dashboard")
    s.d.rectangle([16, 116, 420, 380], fill=WHITE, outline=BLACK, width=2)
    s.text(30, 128, "Your clubs", "b")
    s.text(130, 130, "GET /api/clubs", "api", MID)
    for i, (n, p, ini) in enumerate([("SBU Tech Society", "President", "TS"),
                                     ("SBU Robotics Club", "(Priya's view) President", "RC"),
                                     ("SBU Design & Media Collective", "(Aisha's view) Events Chair", "DM")]):
        y = 160 + i * 66
        if i == 0:
            s.d.rectangle([24, y - 6, 412, y + 52], fill=FAINT)
        s.avatar(34, y, 18, ini)
        s.text(80, y + 2, n, "b")
        s.text(80, y + 22, p, "s", MID)
    s.text(30, 352, "On select: reload every screen with the new club_id", "s")
    s.note(460, 140, "Each club has its own board, events, tasks, chat, budget. URL: /api/clubs/{club_id}/...")
    s.note(460, 176, "position + can_manage_finance come with each club -> show/hide finance buttons")
    return s.save()


if __name__ == "__main__":
    screens = [login(), dashboard(), event_workspace(), tasks(), chat(), approvals(), finance(), vendors(), emails(),
               members(), ai_panel(), club_switcher()]
    # overview sheet
    cols, tw, th = 3, 480, 320
    sheet = Image.new("RGB", (cols * (tw + 20) + 20, ((len(screens) + cols - 1) // cols) * (th + 50) + 20), WHITE)
    dd = ImageDraw.Draw(sheet)
    for i, s in enumerate(screens):
        x, y = 20 + (i % cols) * (tw + 20), 20 + (i // cols) * (th + 50)
        sheet.paste(s.img.resize((tw, th)), (x, y + 26))
        dd.rectangle([x, y + 26, x + tw, y + 26 + th], outline=BLACK)
        dd.text((x, y + 4), f"{s.name}  -  {s.title}", font=F["b"], fill=BLACK)
    sheet.save(OUT / "all-screens.png")
    print(f"wrote {len(screens)} screens + all-screens.png to {OUT}")
