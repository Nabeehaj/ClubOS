"""Fictional demo data. Run `python -m app.seed` to reset the database.

People, emails, vendors and 25Live / SB Engaged / NXT records are fictional or simulated.
"""
from datetime import date, datetime, timedelta
from urllib.parse import quote

from sqlmodel import Session, SQLModel

from .auth import hash_password
from .db import engine, init_db
from .models import (
    Activity, Approval, BudgetCategory, Channel, Club, EmailDraft, Event, EventVendor, Expense, FinancialRequest,
    Membership, Message, Reservation, Task, User, Vendor, utcnow,
)

# key: (name, email, password, major, class_year)
DEMO_USERS = {
    "sarah": ("Sarah Chen", "sarah@sbu.clubos", "Sarah!Tech2026", "Computer Science", 2027),
    "adam": ("Adam Khan", "adam@sbu.clubos", "Adam#VicePres26", "Applied Math & Statistics", 2027),
    "emily": ("Emily Park", "emily@sbu.clubos", "Emily$Treasury26", "Business Management", 2026),
    "james": ("James Wilson", "james@sbu.clubos", "James&Minutes26", "Information Systems", 2028),
    "aisha": ("Aisha Rahman", "aisha@sbu.clubos", "Aisha*Events26", "Computer Engineering", 2027),
    "daniel": ("Daniel Lee", "daniel@sbu.clubos", "Daniel^Design26", "Digital Arts", 2026),
    "priya": ("Priya Patel", "priya@sbu.clubos", "Priya@Robots26", "Mechanical Engineering", 2026),
}

DEMO_CLUBS = {
    "tech": dict(name="Stony Brook Computing Society (SBCS)", slug="stony-brook-computing-society",
                 category="Academic / Professional",
                 description="A sample workspace for Stony Brook's computing community. All people, events, and finances shown here are fictional demo data.",
                 member_count=120, annual_budget=5000, email="sbcs-demo@sbu.clubos", accent_color="#6C5CE7"),
}

DEMO_BOARDS = {
    "tech": [
        ("sarah", "President", ["Runs board meetings", "SB Engaged registrations", "Club strategy"]),
        ("adam", "Vice President", ["Speaker & sponsor outreach", "Backs up the President"]),
        ("emily", "Treasurer", ["Budget & NXT requests", "Vendor quotes", "Reimbursements"]),
        ("james", "Secretary", ["Meeting minutes", "RSVPs & attendance", "Merch orders"]),
        ("aisha", "Events Chair", ["Room reservations (25Live)", "Event logistics", "Day-of coordination"]),
        ("daniel", "Marketing Chair", ["Flyers & social media", "Photography", "Branding"]),
        ("priya", "Outreach Chair", ["Partner clubs", "Equipment & tech setup"]),
    ],
}


def d(month: int, day: int, year: int = 2026) -> date:
    return date(year, month, day)


def ago(days: float = 0, hours: float = 0) -> datetime:
    return utcnow() - timedelta(days=days, hours=hours)


def reset_db() -> None:
    SQLModel.metadata.drop_all(engine)
    init_db()


def seed(session: Session) -> dict:
    users = {}
    for key, (name, email, password, major, year) in DEMO_USERS.items():
        u = User(name=name, email=email, password_hash=hash_password(password), major=major, class_year=year,
                 avatar_url=f"https://api.dicebear.com/9.x/notionists/svg?seed={quote(name)}")
        session.add(u)
        users[key] = u
    clubs = {key: Club(**data) for key, data in DEMO_CLUBS.items()}
    session.add_all(clubs.values())
    session.flush()
    for club_key, seats in DEMO_BOARDS.items():
        for user_key, position, resp in seats:
            session.add(Membership(user_id=users[user_key].id, club_id=clubs[club_key].id, position=position,
                                   responsibilities=resp))
    session.flush()

    seed_tech(session, clubs["tech"], users)
    session.commit()
    return {"users": len(users), "clubs": len(clubs)}


def _tasks(session: Session, club: Club, users: dict, rows: list[tuple]) -> list[Task]:
    """rows: (title, assignee_key, status, priority, due, event, description)"""
    out = []
    for title, who, status, priority, due, event, desc in rows:
        t = Task(club_id=club.id, title=title, assignee_id=users[who].id if who else None, status=status,
                 priority=priority, due_date=due, event_id=event.id if event else None, description=desc,
                 created_at=ago(days=14), completed_at=ago(days=3) if status == "Completed" else None)
        session.add(t)
        out.append(t)
    return out


def _messages(session: Session, channel: Channel, users: dict, rows: list[tuple]) -> None:
    """rows: (author_key or None for bot, text, hours_ago)"""
    for who, text, hours in rows:
        session.add(Message(channel_id=channel.id, author_id=users[who].id if who else None, body=text,
                            created_at=ago(hours=hours)))


def seed_tech(session: Session, club: Club, u: dict) -> None:
    nn = Event(club_id=club.id, name="Fall Tech Networking Night", date=d(11, 5), start_time="18:00",
               end_time="21:00", location="SAC Ballroom A", lead_id=u["aisha"].id, budget=1500,
               expected_attendance=150, status="Planning",
               description="Meet engineers and recruiters from Long Island and NYC tech companies. Lightning talks, "
                           "resume table, and food. Business casual.")
    ai = Event(club_id=club.id, name="AI Workshop", date=d(11, 12), start_time="17:00", end_time="19:00",
               location="Frey Hall 102", lead_id=u["adam"].id, budget=500, expected_attendance=60,
               status="Awaiting Approval",
               description="Hands-on intro to building with AI APIs. Bring a laptop; no experience needed.")
    hs = Event(club_id=club.id, name="Hackathon Social", date=d(11, 20), start_time="19:00", end_time="22:00",
               location="SAC Meeting Room 2", lead_id=u["aisha"].id, budget=800, expected_attendance=40,
               status="Confirmed", description="Find teammates for spring hackathons over pizza and games.")
    eos = Event(club_id=club.id, name="End-of-Semester Celebration", date=d(12, 4), start_time="18:30",
                end_time="21:30", location="SAC Auditorium", lead_id=u["sarah"].id, budget=1200,
                expected_attendance=100, status="Planning",
                description="Celebrate the semester with food, a DJ, awards, and a photo slideshow.")
    session.add_all([nn, ai, hs, eos])
    session.flush()

    tasks = _tasks(session, club, u, [
        # Fall Tech Networking Night: 8 tasks, 5 completed
        ("Reserve SAC Ballroom", "aisha", "Completed", "High", d(10, 10), nn, "Submit via 25Live, 150 capacity."),
        ("Submit SB Engaged form", "sarah", "In Progress", "High", d(10, 27), nn, "Speaker list still missing."),
        ("Contact catering vendor", "emily", "To Do", "High", d(10, 28), nn, "Get a quote from Campus Bites."),
        ("Design event flyer", "daniel", "Completed", "Medium", d(10, 15), nn, ""),
        ("Send speaker invitations", "adam", "In Progress", "High", d(10, 26), nn, "3 of 5 speakers confirmed."),
        ("Prepare event budget", "emily", "Completed", "Medium", d(10, 12), nn, ""),
        ("Post flyer on Instagram & Discord", "daniel", "Completed", "Low", d(10, 18), nn, ""),
        ("Create RSVP form", "james", "Completed", "Medium", d(10, 14), nn, ""),
        # AI Workshop
        ("Confirm workshop instructor", "adam", "In Progress", "High", d(10, 30), ai, ""),
        ("Check outlets & laptops in Frey Hall", "priya", "To Do", "Medium", d(11, 5), ai, ""),
        ("Write workshop description for SB Engaged", "sarah", "Completed", "Medium", d(10, 20), ai, ""),
        ("Prepare starter notebook", "adam", "To Do", "Medium", d(11, 9), ai, ""),
        # Hackathon Social
        ("Order pizza for Hackathon Social", "emily", "To Do", "Medium", d(11, 14), hs, ""),
        ("Order merchandise (stickers & lanyards)", "james", "To Do", "Medium", d(11, 6), hs, ""),
        ("Plan icebreaker games", "aisha", "Completed", "Low", d(10, 22), hs, ""),
        ("Finish 25Live request for meeting room", "aisha", "In Progress", "High", d(11, 2), hs, ""),
        # End-of-Semester Celebration
        ("Book a DJ", "aisha", "To Do", "Medium", d(11, 15), eos, ""),
        ("Collect photo highlights for slideshow", "daniel", "To Do", "Low", d(11, 28), eos, ""),
        # general
        ("Update club constitution", "james", "In Progress", "Low", d(11, 10), None, ""),
        ("Draft spring semester calendar", "sarah", "To Do", "Medium", d(11, 18), None, ""),
    ])
    session.flush()

    # ClubChat
    general = Channel(club_id=club.id, name="general", description="Announcements and hangout")
    board_ch = Channel(club_id=club.id, name="executive-board", description="Board only")
    planning = Channel(club_id=club.id, name="event-planning", description="Fall Tech Networking Night planning",
                       event_id=nn.id)
    finance = Channel(club_id=club.id, name="finance", description="Budget, receipts, NXT requests")
    session.add_all([general, board_ch, planning, finance])
    session.flush()
    _messages(session, general, u, [
        ("sarah", "Welcome back everyone! Fall Tech Networking Night is Nov 5, save the date.", 70),
        ("daniel", "Flyers are up on Instagram and the SAC boards!", 50),
        ("priya", "I can help demo the AI Workshop setup. Any objections?", 26),
        ("adam", "Love that, let's do it.", 25),
    ])
    _messages(session, board_ch, u, [
        ("sarah", "Board meeting Thursday 7pm in SAC 302. Please update your tasks before then.", 30),
        ("james", "I'll send minutes from last week tonight.", 29),
        ("emily", "Reminder: NXT requests need 2 weeks lead time.", 8),
    ])
    _messages(session, planning, u, [
        ("sarah", "Hey everyone! We need to finalize the networking night details.", 20),
        ("aisha", "I've completed the room reservation checklist. Ballroom A is confirmed in 25Live.", 19),
        ("emily", "I'll contact the catering vendor today.", 18),
        ("daniel", "The promotional flyer is ready for review!", 17),
        ("adam", "3 of 5 speakers confirmed, waiting on two replies.", 6),
        ("sarah", "Can someone order name tags and lanyards for networking night?", 2),
    ])
    _messages(session, finance, u, [
        ("emily", "Catering request for Networking Night is pending in NXT ($450).", 22),
        ("emily", "Decorations request got approved", 10),
        ("sarah", "Nice! How much is left in the events budget?", 9),
    ])

    # simulated 25Live
    session.add_all([
        Reservation(club_id=club.id, event_id=nn.id, space="SAC Ballroom A", requested_date=nn.date,
                    start_time="17:00", end_time="21:30", capacity=150, status="Approved",
                    confirmation_number="SIM-25L-482913", submit_deadline=d(10, 15), notes="Includes setup hour."),
        Reservation(club_id=club.id, event_id=ai.id, space="Frey Hall 102", requested_date=ai.date,
                    start_time="16:30", end_time="19:15", capacity=60, status="Pending",
                    submit_deadline=d(10, 29), notes="Needs projector + outlets."),
        Reservation(club_id=club.id, event_id=hs.id, space="SAC Meeting Room 2", requested_date=hs.date,
                    start_time="18:30", end_time="22:15", capacity=40, status="Draft", submit_deadline=d(11, 6)),
    ])

    # simulated SB Engaged
    def docs(*items):
        return [{"name": n, "done": done} for n, done in items]
    session.add_all([
        Approval(club_id=club.id, event_id=nn.id, status="Pending", submitted_on=d(10, 20), deadline=d(10, 29),
                 reference_number="SIM-SBE-771204",
                 required_documents=docs(("Event registration form", True), ("Risk management form", True),
                                         ("Food & catering form", True), ("Speaker / guest list", False)),
                 pending_actions=["Upload final speaker list", "Wait for SB Engaged reviewer"]),
        Approval(club_id=club.id, event_id=ai.id, status="Draft", deadline=d(10, 31),
                 required_documents=docs(("Event registration form", True), ("Room confirmation (25Live)", False),
                                         ("Guest instructor info", False)),
                 pending_actions=["Attach 25Live confirmation", "Add instructor details", "Submit for review"]),
        Approval(club_id=club.id, event_id=hs.id, status="Approved", submitted_on=d(10, 8), deadline=d(11, 6),
                 reference_number="SIM-SBE-559310",
                 required_documents=docs(("Event registration form", True), ("Food & catering form", True))),
        Approval(club_id=club.id, event_id=eos.id, status="Not Started", deadline=d(11, 20),
                 required_documents=docs(("Event registration form", False), ("Risk management form", False),
                                         ("Food & catering form", False), ("DJ / performer contract", False)),
                 pending_actions=["Start registration in SB Engaged"]),
    ])

    # budget
    cats = {name: BudgetCategory(club_id=club.id, name=name, planned=amt) for name, amt in [
        ("Events", 2000), ("Food & Catering", 1000), ("Merchandise", 750), ("Marketing", 250), ("Equipment", 500)]}
    session.add_all(cats.values())

    # sample vendors
    v = {
        "bites": Vendor(club_id=club.id, name="Campus Bites Catering", category="Food", contact_name="Maria Lopez",
                        email="orders@campusbites.example", phone="(631) 555-0142", website="campusbites.example",
                        services=["Hot buffet", "Sandwich platters", "Vegetarian & halal options"],
                        estimated_cost=450, notes="Needs 10 days notice. Delivers to SAC loading dock."),
        "print": Vendor(club_id=club.id, name="PrintWorks Studio", category="Merchandise", contact_name="Tom Reyes",
                        email="hello@printworks.example", phone="(631) 555-0177", website="printworks.example",
                        services=["T-shirts", "Stickers", "Lanyards", "Banners"],
                        estimated_cost=300, notes="Free design proof. 2-week turnaround."),
        "frame": Vendor(club_id=club.id, name="BrightFrame Media", category="Photography",
                        contact_name="Jasmine Wu", email="book@brightframe.example", phone="(631) 555-0119",
                        services=["Event photography", "Headshot booth"], estimated_cost=250,
                        notes="Headshot booth is popular at networking events."),
        "spark": Vendor(club_id=club.id, name="EventSpark Rentals", category="Equipment",
                        contact_name="Chris Bell", email="rentals@eventspark.example", phone="(631) 555-0190",
                        services=["Speakers & mics", "Uplighting", "Photo backdrop"], estimated_cost=200,
                        notes="Pickup and return same day."),
        "sweet": Vendor(club_id=club.id, name="Sweet Treats Co.", category="Desserts", contact_name="Nina Shah",
                        email="orders@sweettreats.example", phone="(631) 555-0156",
                        services=["Cookies", "Cupcakes", "Custom logo cookies"], estimated_cost=150,
                        notes="Logo cookies need 1 week notice."),
    }
    session.add_all(v.values())
    session.flush()
    session.add_all([
        EventVendor(event_id=nn.id, vendor_id=v["bites"].id, status="Quote Requested", quoted_amount=450),
        EventVendor(event_id=nn.id, vendor_id=v["frame"].id, status="Considering", quoted_amount=250),
        EventVendor(event_id=hs.id, vendor_id=v["sweet"].id, status="Considering"),
        EventVendor(event_id=eos.id, vendor_id=v["spark"].id, status="Considering", quoted_amount=200),
        EventVendor(event_id=hs.id, vendor_id=v["print"].id, status="Quote Requested", quoted_amount=300),
    ])

    # expenses
    for cat, desc, amt, when, ev, vend, who in [
        ("Food & Catering", "Welcome meeting pizza", 220, d(9, 10), None, None, "emily"),
        ("Marketing", "Networking Night flyer printing", 45, d(10, 16), nn, None, "emily"),
        ("Marketing", "Instagram promo boost", 30, d(10, 18), nn, None, "sarah"),
        ("Events", "Ballroom decorations", 150, d(10, 21), nn, None, "emily"),
        ("Equipment", "HDMI adapters for workshop", 60, d(10, 22), ai, None, "emily"),
        ("Merchandise", "Sticker sample pack", 35, d(10, 19), hs, v["print"], "emily"),
    ]:
        session.add(Expense(club_id=club.id, category_id=cats[cat].id, description=desc, amount=amt, spent_on=when,
                            event_id=ev.id if ev else None, vendor_id=vend.id if vend else None,
                            created_by_id=u[who].id))

    # simulated NXT
    session.add_all([
        FinancialRequest(club_id=club.id, event_id=nn.id, vendor_id=v["bites"].id,
                         title="Networking Night catering", amount=450, status="Pending", submitted_on=d(10, 21),
                         reference_number="SIM-NXT-300418"),
        FinancialRequest(club_id=club.id, event_id=nn.id, title="Networking Night decorations", amount=150,
                         status="Approved", submitted_on=d(10, 12), reference_number="SIM-NXT-300377"),
        FinancialRequest(club_id=club.id, event_id=ai.id, title="Workshop supplies", amount=120, status="Draft"),
        FinancialRequest(club_id=club.id, event_id=hs.id, title="Hackathon Social pizza", amount=300,
                         status="Submitted Externally", submitted_on=d(10, 23), reference_number="SIM-NXT-300452"),
        FinancialRequest(club_id=club.id, event_id=eos.id, vendor_id=v["print"].id,
                         title="Club T-shirts for celebration", amount=300, status="Draft"),
    ])

    # activity feed
    for who, text, kind, ev, hours in [
        ("aisha", "Aisha Rahman completed \"Reserve SAC Ballroom\"", "task", nn, 72),
        (None, "25Live (simulated): SAC Ballroom A for \"Fall Tech Networking Night\" is now Approved", "approval", nn, 71),
        ("daniel", "Daniel Lee completed \"Design event flyer\"", "task", nn, 50),
        ("sarah", "Sarah Chen submitted SB Engaged registration for \"Fall Tech Networking Night\"", "approval", nn, 40),
        ("emily", "Emily Park added a $150.00 expense: Ballroom decorations (Events)", "finance", nn, 30),
        ("emily", "NXT (simulated): \"Networking Night decorations\" is now Approved", "finance", nn, 10),
        ("adam", "Adam Khan moved to In Progress: \"Send speaker invitations\"", "task", nn, 6),
    ]:
        session.add(Activity(club_id=club.id, actor_id=u[who].id if who else None, text=text, kind=kind,
                             event_id=ev.id, created_at=ago(hours=hours)))
    session.flush()

    # email drafts
    from .routers.emails import GenerateIn, build_email
    for who, pos, req in [
        ("aisha", "Events Chair", GenerateIn(template="event_invitation", event_id=nn.id)),
        ("emily", "Treasurer", GenerateIn(template="catering_quote", event_id=nn.id, vendor_id=v["bites"].id)),
        ("sarah", "President", GenerateIn(template="meeting_reminder", meeting_date=d(10, 29))),
    ]:
        email = build_email(session, club, u[who], pos, req)
        session.add(EmailDraft(club_id=club.id, event_id=req.event_id, template=req.template,
                               created_by_id=u[who].id, **email))


def seed_robotics(session: Session, club: Club, u: dict) -> None:
    combat = Event(club_id=club.id, name="Robot Combat Night", date=d(11, 14), start_time="19:00", end_time="22:00",
                   location="Engineering Building Atrium", lead_id=u["adam"].id, budget=900, expected_attendance=80,
                   status="Planning", description="Beetleweight robots battle it out. Spectators welcome!")
    arduino = Event(club_id=club.id, name="Intro to Arduino Workshop", date=d(11, 19), start_time="18:00",
                    end_time="20:00", location="Light Engineering 152", lead_id=u["marcus"].id, budget=400,
                    expected_attendance=30, status="Confirmed",
                    description="Blink an LED, read a sensor, drive a motor. Kits provided.")
    session.add_all([combat, arduino])
    session.flush()
    _tasks(session, club, u, [
        ("Build arena safety enclosure", "marcus", "In Progress", "High", d(11, 8), combat, ""),
        ("Book Engineering atrium", "adam", "Completed", "High", d(10, 20), combat, ""),
        ("Order 30 Arduino kits", "kevin", "To Do", "High", d(10, 31), arduino, ""),
        ("Write workshop slides", "marcus", "To Do", "Medium", d(11, 15), arduino, ""),
        ("Register Combat Night in SB Engaged", "priya", "To Do", "Medium", d(11, 1), combat, ""),
    ])
    ch = Channel(club_id=club.id, name="general", description="Robotics chat")
    builds = Channel(club_id=club.id, name="build-team", description="Combat Night build", event_id=combat.id)
    session.add_all([ch, builds])
    session.flush()
    _messages(session, ch, u, [
        ("priya", "Combat Night is officially happening!", 30),
        ("kevin", "Parts budget is tight, please check with me before ordering.", 12),
    ])
    _messages(session, builds, u, [("marcus", "Polycarbonate sheets arrive Monday.", 5)])
    session.add(Reservation(club_id=club.id, event_id=combat.id, space="Engineering Building Atrium",
                            requested_date=combat.date, start_time="18:00", end_time="22:30", capacity=80,
                            status="Approved", confirmation_number="SIM-25L-610022", submit_deadline=d(10, 25)))
    session.add(Approval(club_id=club.id, event_id=combat.id, status="Not Started", deadline=d(11, 3),
                         required_documents=[{"name": "Event registration form", "done": False},
                                             {"name": "Risk management form", "done": False}],
                         pending_actions=["Start registration in SB Engaged"]))
    parts = BudgetCategory(club_id=club.id, name="Parts & Kits", planned=2000)
    session.add_all([parts, BudgetCategory(club_id=club.id, name="Events", planned=1000),
                     BudgetCategory(club_id=club.id, name="Food", planned=300)])
    session.flush()
    session.add(Expense(club_id=club.id, category_id=parts.id, description="Motor controllers", amount=180,
                        spent_on=d(10, 12), event_id=combat.id, created_by_id=u["kevin"].id))
    session.add(FinancialRequest(club_id=club.id, event_id=arduino.id, title="Arduino kits", amount=360,
                                 status="Pending", submitted_on=d(10, 22), reference_number="SIM-NXT-300466"))
    session.add(Activity(club_id=club.id, actor_id=u["adam"].id, text="Adam Khan completed \"Book Engineering atrium\"",
                         kind="task", event_id=combat.id, created_at=ago(hours=20)))


def seed_design(session: Session, club: Club, u: dict) -> None:
    review = Event(club_id=club.id, name="Portfolio Review Night", date=d(11, 10), start_time="18:00",
                   end_time="20:30", location="Staller Center Gallery", lead_id=u["sofia"].id, budget=500,
                   expected_attendance=45, status="Awaiting Approval",
                   description="Get 1-on-1 feedback on your portfolio from alumni designers.")
    walk = Event(club_id=club.id, name="Fall Photo Walk", date=d(11, 22), start_time="14:00", end_time="16:30",
                 location="Meet at Academic Mall", lead_id=u["aisha"].id, budget=100, expected_attendance=25,
                 status="Planning", description="Golden-hour photo walk around campus. Any camera (or phone) works.")
    session.add_all([review, walk])
    session.flush()
    _tasks(session, club, u, [
        ("Invite 6 alumni reviewers", "sofia", "In Progress", "High", d(11, 1), review, ""),
        ("Design Portfolio Night poster", "daniel", "Completed", "Medium", d(10, 20), review, ""),
        ("Post photo walk on Instagram", "james", "To Do", "Low", d(11, 15), walk, ""),
        ("Plan photo walk route", "aisha", "To Do", "Low", d(11, 18), walk, ""),
    ])
    ch = Channel(club_id=club.id, name="general", description="Design & Media chat")
    session.add(ch)
    session.flush()
    _messages(session, ch, u, [
        ("sofia", "4 alumni confirmed for Portfolio Night so far!", 15),
        ("daniel", "Poster is done, sending to print tomorrow.", 9),
    ])
    session.add(Approval(club_id=club.id, event_id=review.id, status="Pending", submitted_on=d(10, 19),
                         deadline=d(10, 31), reference_number="SIM-SBE-771390",
                         required_documents=[{"name": "Event registration form", "done": True},
                                             {"name": "Guest list", "done": False}],
                         pending_actions=["Upload alumni guest list"]))
    gear = BudgetCategory(club_id=club.id, name="Equipment", planned=1200)
    session.add_all([gear, BudgetCategory(club_id=club.id, name="Events", planned=600),
                     BudgetCategory(club_id=club.id, name="Printing", planned=200)])
    session.flush()
    session.add(Expense(club_id=club.id, category_id=gear.id, description="Softbox lighting kit", amount=140,
                        spent_on=d(10, 5), created_by_id=u["marcus"].id))


def reset_and_seed() -> dict:
    reset_db()
    with Session(engine) as session:
        return seed(session)


if __name__ == "__main__":
    print("Seeded:", reset_and_seed())
