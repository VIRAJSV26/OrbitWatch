import os
import sys
import random
import requests
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

load_dotenv()

DB_URL = os.getenv("DB_URL", "postgresql://postgres:postgres@localhost:5432/orbitwatch_db")
SPACETRACK_EMAIL = os.getenv("SPACETRACK_EMAIL", "your_email_here")
SPACETRACK_PASSWORD = os.getenv("SPACETRACK_PASSWORD", "your_password_here")

def connect_db():
    try:
        conn = psycopg2.connect(DB_URL)
        return conn
    except Exception as e:
        print(f"Error connecting to database: {e}")
        sys.exit(1)

def run_space_track_ingestion():
    if "your_email_here" in SPACETRACK_EMAIL or "your_password_here" in SPACETRACK_PASSWORD:
        print("Space-Track credentials are using default placeholders. Switching to Mock Fallback Seeding Mode.")
        return False
        
    print(f"Connecting to space-track.org as {SPACETRACK_EMAIL}...")
    session = requests.Session()
    login_url = "https://www.space-track.org/ajaxauth/login"
    login_data = {
        "identity": SPACETRACK_EMAIL,
        "password": SPACETRACK_PASSWORD
    }
    
    try:
        r = session.post(login_url, data=login_data, timeout=15)
        if r.status_code != 200 or "Login Failed" in r.text:
            print("Login to space-track.org failed. Switching to Mock Fallback Seeding Mode.")
            return False
            
        print("Logged into Space-Track successfully. Fetching objects...")
        # 1000 Debris, 500 Satellites, 200 Rocket Bodies
        # We query the gp (General Perturbations) table which contains TLE and object data
        # Let's fetch them in batches
        objects_to_ingest = []
        
        # Helper to query space-track
        def fetch_batch(obj_type, limit):
            url = f"https://www.space-track.org/basicspacedata/query/class/gp/OBJECT_TYPE/{obj_type}/limit/{limit}/format/json"
            res = session.get(url, timeout=30)
            if res.status_code == 200:
                return res.json()
            return []

        print("Fetching 1000 DEBRIS...")
        debris = fetch_batch("DEBRIS", 1000)
        print(f"Fetched {len(debris)} debris objects.")
        
        print("Fetching 500 SATELLITES...")
        sats = fetch_batch("SATELLITE", 500)
        print(f"Fetched {len(sats)} satellite objects.")
        
        print("Fetching 200 ROCKET BODIES...")
        rbs = fetch_batch("ROCKET BODY", 200)
        print(f"Fetched {len(rbs)} rocket bodies.")
        
        raw_objects = debris + sats + rbs
        if not raw_objects:
            print("No objects fetched from Space-Track. Switching to Mock Fallback Seeding Mode.")
            return False
            
        # Perform DB insert from space-track data
        ingest_raw_space_track_data(raw_objects)
        return True
    except Exception as e:
        print(f"Error during Space-Track ingestion: {e}. Switching to Mock Fallback Seeding Mode.")
        return False

def ingest_raw_space_track_data(raw_objects):
    print(f"Ingesting {len(raw_objects)} raw objects from Space-Track...")
    conn = connect_db()
    cur = conn.cursor()
    
    # 1. Seed standard owners if they don't exist
    owners_data = [
        ("NASA", "AGENCY", "USA", 1958),
        ("ESA", "AGENCY", "EUR", 1975),
        ("ISRO", "AGENCY", "IND", 1969),
        ("ROSCOSMOS", "AGENCY", "RUS", 1992),
        ("CNSA", "AGENCY", "CHN", 1993),
        ("SpaceX", "COMPANY", "USA", 2002),
        ("OneWeb", "COMPANY", "GBR", 2012),
        ("Planet Labs", "COMPANY", "USA", 2010),
        ("UNKNOWN OWNER", "AGENCY", "UNK", 2000)
    ]
    
    owner_ids = {}
    for name, otype, ccode, founded in owners_data:
        cur.execute("""
            INSERT INTO owners (name, type, country_code, founded_year) 
            VALUES (%s, %s, %s, %s) 
            ON CONFLICT DO NOTHING RETURNING owner_id;
        """, (name, otype, ccode, founded))
        res = cur.fetchone()
        if res:
            owner_ids[name] = res[0]
        else:
            cur.execute("SELECT owner_id FROM owners WHERE name = %s", (name,))
            owner_ids[name] = cur.fetchone()[0]

    # Map country codes to owner_id
    ccode_to_owner = {
        "US": owner_ids["NASA"],
        "ESA": owner_ids["ESA"],
        "IND": owner_ids["ISRO"],
        "RU": owner_ids["ROSCOSMOS"],
        "PRC": owner_ids["CNSA"],
        "UK": owner_ids["OneWeb"]
    }
    
    # Pre-select shells
    cur.execute("SELECT shell_id, min_altitude_km, max_altitude_km FROM orbital_shells")
    shells = cur.fetchall()

    def get_shell(apogee):
        for shell in shells:
            if shell[1] <= apogee < shell[2]:
                return shell[0]
        return "LEO_HIGH"

    count = 0
    for obj in raw_objects:
        norad_id = int(obj.get("NORAD_CAT_ID", random.randint(100000, 999999)))
        name = obj.get("OBJECT_NAME", f"OBJ-{norad_id}")
        otype = obj.get("OBJECT_TYPE", "UNKNOWN").replace("ROCKET BODY", "ROCKET_BODY")
        if otype not in ["SATELLITE", "DEBRIS", "ROCKET_BODY", "UNKNOWN"]:
            otype = "UNKNOWN"
            
        ccode = obj.get("COUNTRY_CODE", "UNK")
        owner_id = ccode_to_owner.get(ccode, owner_ids["UNKNOWN OWNER"])
        
        # Calculate apogee and perigee
        ecc = float(obj.get("ECCENTRICITY", 0.0))
        motion = float(obj.get("MEAN_MOTION", 15.0))
        incl = float(obj.get("INCLINATION", 51.6))
        
        # Approximations
        semi_major = 1000.0 # fallback
        try:
            semi_major = 42241.0979 / (motion ** (2.0/3.0))
        except:
            pass
        
        perigee = semi_major * (1.0 - ecc) - 6371.0
        apogee = semi_major * (1.0 + ecc) - 6371.0
        
        shell_id = get_shell(apogee)
        
        # Date parsing
        launch_str = obj.get("LAUNCH_DATE")
        launch_date = None
        if launch_str:
            try:
                launch_date = datetime.strptime(launch_str, "%Y-%m-%d").date()
            except:
                pass
                
        status = "ACTIVE"
        if otype == "DEBRIS" or otype == "ROCKET_BODY":
            status = "DEAD"
            
        cur.execute("""
            INSERT INTO space_objects 
            (norad_id, name, object_type, owner_id, shell_id, launch_date, status, mass_kg, radar_cross_section)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (norad_id) DO NOTHING RETURNING object_id;
        """, (
            norad_id, name, otype, owner_id, shell_id, launch_date, status, 
            random.uniform(50.0, 1500.0) if otype == "SATELLITE" else random.uniform(1.0, 50.0),
            float(obj.get("RCS_SIZE", 0.1)) if obj.get("RCS_SIZE") else 0.1
        ))
        res = cur.fetchone()
        if res:
            obj_id = res[0]
            # Insert parameters
            cur.execute("""
                INSERT INTO orbital_parameters 
                (object_id, epoch, inclination, eccentricity, semi_major_axis_km, raan, apogee_km, perigee_km, tle_line1, tle_line2)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (object_id) DO NOTHING;
            """, (
                obj_id, datetime.now(), incl, ecc, semi_major, float(obj.get("RAAN", 0.0)), apogee, perigee,
                obj.get("TLE_LINE1", ""), obj.get("TLE_LINE2", "")
            ))
            count += 1
            
    conn.commit()
    print(f"Ingested {count} objects and orbital parameters successfully!")
    
    # Generate conjunction events
    generate_conjunction_events(conn)
    
    # Run scoring procedure
    cur = conn.cursor()
    cur.execute("CALL update_debris_scores();")
    conn.commit()
    conn.close()

def generate_conjunction_events(conn):
    print("Generating mock conjunction events to test warning triggers...")
    cur = conn.cursor()
    
    # Get all active satellites
    cur.execute("SELECT object_id FROM space_objects WHERE object_type = 'SATELLITE' AND status = 'ACTIVE' LIMIT 50")
    sats = [r[0] for r in cur.fetchall()]
    
    # Get some debris
    cur.execute("SELECT object_id FROM space_objects WHERE object_type = 'DEBRIS' LIMIT 100")
    debris = [r[0] for r in cur.fetchall()]
    
    if not sats or not debris:
        print("Not enough objects in database to generate conjunctions.")
        return
        
    conjunctions = []
    risks = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']
    statuses = ['ACTIVE', 'RESOLVED', 'PASSED']
    
    for i in range(100):
        obj1 = random.choice(sats)
        obj2 = random.choice(debris)
        if obj1 == obj2:
            continue
            
        tca = datetime.now() + timedelta(hours=random.uniform(1.0, 72.0))
        miss_dist = random.uniform(0.01, 15.0)
        
        # Align risk with miss distance
        if miss_dist < 0.1:
            risk = 'CRITICAL'
            prob = random.uniform(0.01, 0.09)
        elif miss_dist < 1.0:
            risk = 'HIGH'
            prob = random.uniform(0.001, 0.01)
        elif miss_dist < 5.0:
            risk = 'MEDIUM'
            prob = random.uniform(0.0001, 0.001)
        else:
            risk = 'LOW'
            prob = random.uniform(0.00001, 0.0001)
            
        vel = random.uniform(5.0, 16.0)
        c_status = random.choice(statuses) if risk in ['LOW', 'MEDIUM'] else 'ACTIVE'
        
        cur.execute("""
            INSERT INTO conjunction_events 
            (object1_id, object2_id, tca, miss_distance_km, collision_probability, relative_velocity_kms, risk_level, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT DO NOTHING;
        """, (obj1, obj2, tca, miss_dist, prob, vel, risk, c_status))
        
    conn.commit()
    print("Conjunction events created successfully!")

def run_mock_fallback_seeding():
    print("Initializing Database with 1700 highly realistic simulated space objects...")
    conn = connect_db()
    cur = conn.cursor()
    
    # 1. Clear existing space objects (except preseeded shells)
    cur.execute("TRUNCATE space_objects CASCADE;")
    cur.execute("TRUNCATE owners CASCADE;")
    
    # 2. Seed owners
    owners_data = [
        ("NASA", "AGENCY", "USA", 1958),
        ("ESA", "AGENCY", "EUR", 1975),
        ("ISRO", "AGENCY", "IND", 1969),
        ("ROSCOSMOS", "AGENCY", "RUS", 1992),
        ("CNSA", "AGENCY", "CHN", 1993),
        ("SpaceX", "COMPANY", "USA", 2002),
        ("OneWeb", "COMPANY", "GBR", 2012),
        ("Planet Labs", "COMPANY", "USA", 2010),
        ("JAXA", "AGENCY", "JPN", 2003),
        ("Inmarsat", "COMPANY", "GBR", 1979),
        ("UNKNOWN OWNER", "AGENCY", "UNK", 2000)
    ]
    
    owner_ids = {}
    for name, otype, ccode, founded in owners_data:
        cur.execute("""
            INSERT INTO owners (name, type, country_code, founded_year) 
            VALUES (%s, %s, %s, %s) RETURNING owner_id;
        """, (name, otype, ccode, founded))
        owner_ids[name] = cur.fetchone()[0]

    # Pre-select shells
    cur.execute("SELECT shell_id, min_altitude_km, max_altitude_km FROM orbital_shells")
    shells = {r[0]: (r[1], r[2]) for r in cur.fetchall()}
    
    # Lists for random mock names
    sat_prefixes = {
        "SpaceX": "STARLINK-",
        "OneWeb": "ONEWEB-",
        "Planet Labs": "FLOCK-",
        "NASA": "TERRA-",
        "ESA": "SENTINEL-",
        "ISRO": "CARTOSAT-",
        "ROSCOSMOS": "COSMOS-",
        "CNSA": "BEIDOU-",
        "JAXA": "ALOS-",
        "Inmarsat": "INMARSAT-"
    }
    
    debris_origins = ["FENGYUN 1C", "COSMOS 2251", "IRIDIUM 33", "DELTA 2", "FALCON 9", "CZ-4B", "SL-8", "TITAN 3C", "PEGASUS"]
    
    # Total targets: 500 Satellites, 1000 Debris, 200 Rocket Bodies
    norad_start = 10000
    
    def generate_tle(name, norad):
        line1 = f"1 {norad:05d}U 20050A   26140.23194444  .00000142  00000-0  57211-4 0  9997"
        line2 = f"2 {norad:05d}  51.6421 280.1234 0005123  98.1234 265.4321 15.49231422789123"
        return line1, line2

    print("Generating 500 mock Satellites...")
    for i in range(500):
        owner_name = random.choice(list(sat_prefixes.keys()))
        owner_id = owner_ids[owner_name]
        
        # Pick shell based on owner logic
        if owner_name == "SpaceX":
            shell_id = "LEO_LOW"
        elif owner_name == "OneWeb" or owner_name == "Planet Labs":
            shell_id = "LEO_HIGH"
        elif owner_name == "Inmarsat":
            shell_id = "GEO"
        else:
            shell_id = random.choice(["LEO_LOW", "LEO_HIGH", "MEO", "GEO", "HEO"])
            
        norad_id = norad_start + i
        name = f"{sat_prefixes[owner_name]}{random.randint(1000, 9999)}"
        status = random.choice(["ACTIVE", "ACTIVE", "ACTIVE", "DEAD"]) # Some satellites are dead
        
        # Altitude range
        min_alt, max_alt = shells[shell_id]
        perigee = random.uniform(min_alt, max_alt - 10)
        apogee = random.uniform(perigee + 2, max_alt)
        semi_major = 6371.0 + (apogee + perigee) / 2.0
        ecc = (apogee - perigee) / (2.0 * semi_major)
        incl = random.uniform(0.0, 98.0)
        tle1, tle2 = generate_tle(name, norad_id)
        
        cur.execute("""
            INSERT INTO space_objects 
            (norad_id, name, object_type, owner_id, shell_id, launch_date, status, mass_kg, radar_cross_section)
            VALUES (%s, %s, 'SATELLITE', %s, %s, %s, %s, %s, %s) RETURNING object_id;
        """, (
            norad_id, name, owner_id, shell_id, 
            datetime.now().date() - timedelta(days=random.randint(100, 5000)),
            status, random.uniform(150.0, 1200.0), random.uniform(1.5, 8.5)
        ))
        obj_id = cur.fetchone()[0]
        
        cur.execute("""
            INSERT INTO orbital_parameters 
            (object_id, epoch, inclination, eccentricity, semi_major_axis_km, raan, apogee_km, perigee_km, tle_line1, tle_line2)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            obj_id, datetime.now(), incl, ecc, semi_major, random.uniform(0.0, 360.0), apogee, perigee, tle1, tle2
        ))

    print("Generating 1000 mock Debris objects...")
    norad_start += 500
    for i in range(1000):
        origin = random.choice(debris_origins)
        name = f"{origin} DEBRIS [FRAG-{random.randint(100, 9999)}]"
        owner_name = random.choice(list(owner_ids.keys()))
        owner_id = owner_ids[owner_name]
        
        # Debris is concentrated in LEO_HIGH and LEO_LOW
        shell_id = random.choices(["LEO_LOW", "LEO_HIGH", "MEO", "GEO", "HEO"], weights=[30, 50, 10, 5, 5])[0]
        norad_id = norad_start + i
        
        min_alt, max_alt = shells[shell_id]
        perigee = random.uniform(min_alt, max_alt - 5)
        apogee = random.uniform(perigee + 1, max_alt)
        semi_major = 6371.0 + (apogee + perigee) / 2.0
        ecc = (apogee - perigee) / (2.0 * semi_major)
        incl = random.uniform(0.0, 98.0)
        tle1, tle2 = generate_tle(name, norad_id)
        
        cur.execute("""
            INSERT INTO space_objects 
            (norad_id, name, object_type, owner_id, shell_id, launch_date, status, mass_kg, radar_cross_section)
            VALUES (%s, %s, 'DEBRIS', %s, %s, %s, 'DEAD', %s, %s) RETURNING object_id;
        """, (
            norad_id, name, owner_id, shell_id, 
            datetime.now().date() - timedelta(days=random.randint(500, 10000)),
            random.uniform(0.1, 10.0), random.uniform(0.01, 0.5)
        ))
        obj_id = cur.fetchone()[0]
        
        cur.execute("""
            INSERT INTO orbital_parameters 
            (object_id, epoch, inclination, eccentricity, semi_major_axis_km, raan, apogee_km, perigee_km, tle_line1, tle_line2)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            obj_id, datetime.now(), incl, ecc, semi_major, random.uniform(0.0, 360.0), apogee, perigee, tle1, tle2
        ))

    print("Generating 200 mock Rocket Bodies...")
    norad_start += 1000
    rb_models = ["SL-16 R/B", "CZ-3B R/B", "FALCON 9 R/B", "DELTA IV R/B", "ATLAS V R/B", "H-IIA R/B", "ARIANE 5 R/B"]
    for i in range(200):
        model = random.choice(rb_models)
        name = f"{model} [DEB-{random.randint(100, 999)}]"
        owner_name = random.choice(list(owner_ids.keys()))
        owner_id = owner_ids[owner_name]
        
        shell_id = random.choices(["LEO_LOW", "LEO_HIGH", "MEO", "GEO", "HEO"], weights=[20, 50, 15, 10, 5])[0]
        norad_id = norad_start + i
        
        min_alt, max_alt = shells[shell_id]
        perigee = random.uniform(min_alt, max_alt - 10)
        apogee = random.uniform(perigee + 5, max_alt)
        semi_major = 6371.0 + (apogee + perigee) / 2.0
        ecc = (apogee - perigee) / (2.0 * semi_major)
        incl = random.uniform(0.0, 98.0)
        tle1, tle2 = generate_tle(name, norad_id)
        
        cur.execute("""
            INSERT INTO space_objects 
            (norad_id, name, object_type, owner_id, shell_id, launch_date, status, mass_kg, radar_cross_section)
            VALUES (%s, %s, 'ROCKET_BODY', %s, %s, %s, 'DEAD', %s, %s) RETURNING object_id;
        """, (
            norad_id, name, owner_id, shell_id, 
            datetime.now().date() - timedelta(days=random.randint(100, 8000)),
            random.uniform(1500.0, 4500.0), random.uniform(3.0, 15.0)
        ))
        obj_id = cur.fetchone()[0]
        
        cur.execute("""
            INSERT INTO orbital_parameters 
            (object_id, epoch, inclination, eccentricity, semi_major_axis_km, raan, apogee_km, perigee_km, tle_line1, tle_line2)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
        """, (
            obj_id, datetime.now(), incl, ecc, semi_major, random.uniform(0.0, 360.0), apogee, perigee, tle1, tle2
        ))

    conn.commit()
    print("Database seeded with 1700 mock objects successfully!")
    
    # Generate conjunction events
    generate_conjunction_events(conn)
    
    # Run debris scoring stored procedure
    cur = conn.cursor()
    print("Running update_debris_scores() stored procedure...")
    cur.execute("CALL update_debris_scores();")
    conn.commit()
    
    conn.close()
    print("Mock database initialization complete!")

def main():
    print("Starting OrbitWatch database ingestion pipeline...")
    success = run_space_track_ingestion()
    if not success:
        run_mock_fallback_seeding()
    print("Ingestion complete!")

if __name__ == "__main__":
    main()
