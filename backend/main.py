import os
import random
from datetime import datetime
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="OrbitWatch API",
    description="Space Debris Collision Risk Intelligence Platform Backend",
    version="1.0.0"
)

# Enable CORS for all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_URL = os.getenv("DB_URL", "postgresql://postgres:postgres@localhost:5432/orbitwatch_db")

def get_db_connection():
    try:
        conn = psycopg2.connect(DB_URL, cursor_factory=RealDictCursor)
        return conn
    except Exception as e:
        print(f"Database connection error: {e}")
        raise HTTPException(status_code=500, detail="Database connection failed")

@app.get("/api/health")
def health_check():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT 1;")
        cur.fetchone()
        cur.close()
        conn.close()
        return {"status": "healthy", "database": "connected"}
    except Exception:
        return {"status": "unhealthy", "database": "disconnected"}

@app.get("/api/objects")
def get_space_objects():
    conn = get_db_connection()
    cur = conn.cursor()
    query = """
        SELECT 
            so.object_id,
            so.norad_id,
            so.name,
            so.object_type,
            so.launch_date,
            so.decay_date,
            so.status,
            so.mass_kg,
            so.radar_cross_section,
            ow.name AS owner_name,
            ow.country_code AS owner_country,
            os.name AS shell_name,
            os.risk_level AS shell_risk,
            op.apogee_km,
            op.perigee_km,
            op.inclination,
            op.raan
        FROM space_objects so
        LEFT JOIN owners ow ON so.owner_id = ow.owner_id
        LEFT JOIN orbital_shells os ON so.shell_id = os.shell_id
        LEFT JOIN orbital_parameters op ON so.object_id = op.object_id
        ORDER BY so.norad_id ASC
        LIMIT 500;
    """
    try:
        cur.execute(query)
        results = cur.fetchall()
        # Convert date to string for JSON serialization
        for r in results:
            if r['launch_date']:
                r['launch_date'] = r['launch_date'].isoformat()
            if r['decay_date']:
                r['decay_date'] = r['decay_date'].isoformat()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/leaderboard")
def get_leaderboard():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM polluter_leaderboard LIMIT 20;")
        results = cur.fetchall()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/shells")
def get_shells_report():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM shell_density_report;")
        results = cur.fetchall()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/alerts")
def get_alerts():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            SELECT * FROM alert_log 
            ORDER BY triggered_at DESC 
            LIMIT 50;
        """)
        results = cur.fetchall()
        for r in results:
            if r['triggered_at']:
                r['triggered_at'] = r['triggered_at'].isoformat()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/conjunctions")
def get_conjunctions():
    conn = get_db_connection()
    cur = conn.cursor()
    query = """
        SELECT 
            ce.event_id,
            ce.object1_id,
            ce.object2_id,
            ce.tca,
            ce.miss_distance_km,
            ce.collision_probability,
            ce.relative_velocity_kms,
            ce.detected_at,
            ce.risk_level,
            ce.status,
            so1.name AS object1_name,
            so1.norad_id AS object1_norad,
            so2.name AS object2_name,
            so2.norad_id AS object2_norad
        FROM conjunction_events ce
        JOIN space_objects so1 ON ce.object1_id = so1.object_id
        JOIN space_objects so2 ON ce.object2_id = so2.object_id
        ORDER BY ce.detected_at DESC
        LIMIT 100;
    """
    try:
        cur.execute(query)
        results = cur.fetchall()
        for r in results:
            if r['tca']:
                r['tca'] = r['tca'].isoformat()
            if r['detected_at']:
                r['detected_at'] = r['detected_at'].isoformat()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/objects/search")
def search_objects(q: str = Query(..., min_length=1)):
    conn = get_db_connection()
    cur = conn.cursor()
    query = """
        SELECT 
            so.object_id,
            so.norad_id,
            so.name,
            so.object_type,
            ow.name AS owner_name,
            os.name AS shell_name
        FROM space_objects so
        LEFT JOIN owners ow ON so.owner_id = ow.owner_id
        LEFT JOIN orbital_shells os ON so.shell_id = os.shell_id
        WHERE so.name ILIKE %s OR CAST(so.norad_id AS TEXT) ILIKE %s
        LIMIT 50;
    """
    try:
        search_pattern = f"%{q}%"
        cur.execute(query, (search_pattern, search_pattern))
        results = cur.fetchall()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.post("/api/cascade/{obj1_id}/{obj2_id}")
def run_cascade_simulation(obj1_id: int, obj2_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Verify objects exist
        cur.execute("SELECT object_id, name, shell_id FROM space_objects WHERE object_id IN (%s, %s)", (obj1_id, obj2_id))
        objects = cur.fetchall()
        if len(objects) < 2:
            raise HTTPException(status_code=404, detail="One or both space objects not found")
            
        # Get shell ID of colliding objects
        shell_id = objects[0]['shell_id'] or 'LEO_HIGH'
        
        # 1. Insert into cascade_simulations
        cur.execute("""
            INSERT INTO cascade_simulations (object1_id, object2_id, total_objects_affected, shells_affected, status)
            VALUES (%s, %s, 0, 1, 'RUNNING') RETURNING sim_id;
        """, (obj1_id, obj2_id))
        sim_id = cur.fetchone()['sim_id']
        
        # 2. Seed initial cascade_nodes (Depth 0)
        cur.execute("""
            INSERT INTO cascade_nodes (sim_id, parent_node_id, object_id, depth_level, collision_at, fragments_generated)
            VALUES (%s, NULL, %s, 0, NOW(), %s) RETURNING node_id;
        """, (sim_id, obj1_id, random.randint(150, 300)))
        node1_id = cur.fetchone()['node_id']
        
        cur.execute("""
            INSERT INTO cascade_nodes (sim_id, parent_node_id, object_id, depth_level, collision_at, fragments_generated)
            VALUES (%s, NULL, %s, 0, NOW(), %s) RETURNING node_id;
        """, (sim_id, obj2_id, random.randint(150, 300)))
        node2_id = cur.fetchone()['node_id']
        
        # 3. Simulate and seed secondary collision nodes (Kessler chain reaction)
        # Select some random active space objects in the same shell to collide with
        cur.execute("""
            SELECT object_id FROM space_objects 
            WHERE object_id NOT IN (%s, %s) AND shell_id = %s AND status = 'ACTIVE'
            LIMIT 4;
        """, (obj1_id, obj2_id, shell_id))
        candidate_targets = cur.fetchall()
        
        depth1_nodes = []
        # Insert depth 1 nodes (collisions caused by initial fragments)
        for i, target in enumerate(candidate_targets[:3]):
            parent_id = node1_id if i % 2 == 0 else node2_id
            cur.execute("""
                INSERT INTO cascade_nodes (sim_id, parent_node_id, object_id, depth_level, collision_at, fragments_generated)
                VALUES (%s, %s, %s, 1, NOW() + interval '5 minutes', %s) RETURNING node_id;
            """, (sim_id, parent_id, target['object_id'], random.randint(50, 120)))
            depth1_nodes.append(cur.fetchone()['node_id'])
            
        # Insert depth 2 node (collision caused by depth 1 fragments)
        if len(candidate_targets) > 3 and depth1_nodes:
            target = candidate_targets[3]
            cur.execute("""
                INSERT INTO cascade_nodes (sim_id, parent_node_id, object_id, depth_level, collision_at, fragments_generated)
                VALUES (%s, %s, %s, 2, NOW() + interval '15 minutes', %s);
            """, (sim_id, depth1_nodes[0], target['object_id'], random.randint(20, 60)))
            
        # Update simulation status to COMPLETE and calculate statistics
        cur.execute("""
            SELECT COUNT(DISTINCT object_id) AS total_affected, SUM(fragments_generated) AS total_frags
            FROM cascade_nodes WHERE sim_id = %s;
        """, (sim_id,))
        stats = cur.fetchone()
        
        cur.execute("""
            UPDATE cascade_simulations 
            SET status = 'COMPLETE', total_objects_affected = %s
            WHERE sim_id = %s;
        """, (stats['total_affected'], sim_id))
        
        conn.commit()
        
        # 4. Run the recursive CTE to fetch the full chain
        chain = fetch_cascade_chain(sim_id, cur)
        return {"sim_id": sim_id, "chain": chain, "summary": stats}
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/cascade/{sim_id}")
def get_cascade_simulation(sim_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Verify simulation exists
        cur.execute("SELECT * FROM cascade_simulations WHERE sim_id = %s", (sim_id,))
        sim = cur.fetchone()
        if not sim:
            raise HTTPException(status_code=404, detail="Cascade simulation not found")
            
        chain = fetch_cascade_chain(sim_id, cur)
        return {"simulation": sim, "chain": chain}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

def fetch_cascade_chain(sim_id: int, cur):
    query = """
        WITH RECURSIVE kessler_cascade AS (
            SELECT 
                node_id,
                sim_id,
                parent_node_id,
                object_id,
                depth_level,
                collision_at,
                fragments_generated
            FROM cascade_nodes
            WHERE sim_id = %s AND parent_node_id IS NULL
            UNION ALL
            SELECT 
                cn.node_id,
                cn.sim_id,
                cn.parent_node_id,
                cn.object_id,
                cn.depth_level,
                cn.collision_at,
                cn.fragments_generated
            FROM cascade_nodes cn
            INNER JOIN kessler_cascade cc ON cn.parent_node_id = cc.node_id
            WHERE cn.sim_id = %s
        )
        SELECT 
            kc.node_id,
            kc.parent_node_id,
            so.name AS node_name,
            so.norad_id,
            kc.depth_level,
            kc.collision_at,
            kc.fragments_generated
        FROM kessler_cascade kc
        JOIN space_objects so ON kc.object_id = so.object_id
        ORDER BY kc.depth_level, kc.collision_at;
    """
    cur.execute(query, (sim_id, sim_id))
    results = cur.fetchall()
    for r in results:
        if r['collision_at']:
            r['collision_at'] = r['collision_at'].isoformat()
    return results

@app.get("/api/stats")
def get_stats():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Total Objects
        cur.execute("SELECT COUNT(*) FROM space_objects;")
        total_objects = cur.fetchone()['count']
        
        # Total Debris
        cur.execute("SELECT COUNT(*) FROM space_objects WHERE object_type = 'DEBRIS';")
        total_debris = cur.fetchone()['count']
        
        # Active Satellites
        cur.execute("SELECT COUNT(*) FROM space_objects WHERE object_type = 'SATELLITE' AND status = 'ACTIVE';")
        active_satellites = cur.fetchone()['count']
        
        # Critical Events (conjunction events that are high/critical and active)
        cur.execute("SELECT COUNT(*) FROM conjunction_events WHERE risk_level = 'CRITICAL' AND status = 'ACTIVE';")
        critical_events = cur.fetchone()['count']
        
        # High Events
        cur.execute("SELECT COUNT(*) FROM conjunction_events WHERE risk_level = 'HIGH' AND status = 'ACTIVE';")
        high_events = cur.fetchone()['count']
        
        return {
            "total_objects": total_objects,
            "total_debris": total_debris,
            "active_satellites": active_satellites,
            "critical_events": critical_events,
            "high_events": high_events
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

class SpaceObjectCreate(BaseModel):
    norad_id: int
    name: str
    object_type: str
    owner_id: Optional[int] = None
    shell_id: Optional[str] = None
    launch_date: Optional[str] = None
    status: str = 'ACTIVE'
    mass_kg: Optional[float] = None
    radar_cross_section: Optional[float] = None

class SpaceObjectUpdate(BaseModel):
    status: str

class SpaceObjectFullUpdate(BaseModel):
    name: str
    object_type: str
    owner_id: Optional[int] = None
    shell_id: Optional[str] = None
    launch_date: Optional[str] = None
    status: str
    mass_kg: Optional[float] = None
    radar_cross_section: Optional[float] = None

class ConjunctionCreate(BaseModel):
    object1_id: int
    object2_id: int
    tca: str
    miss_distance_km: float
    collision_probability: float
    relative_velocity_kms: float
    risk_level: str

class OwnerCreate(BaseModel):
    name: str
    type: str
    country_code: Optional[str] = None
    founded_year: Optional[int] = None

@app.post("/api/objects")
def create_object(obj: SpaceObjectCreate):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO space_objects (norad_id, name, object_type, owner_id, shell_id, launch_date, status, mass_kg, radar_cross_section)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING *;
        """, (obj.norad_id, obj.name, obj.object_type, obj.owner_id, obj.shell_id, obj.launch_date if obj.launch_date else None, obj.status, obj.mass_kg, obj.radar_cross_section))
        created = cur.fetchone()
        conn.commit()
        if created and created.get('launch_date'):
            created['launch_date'] = created['launch_date'].isoformat()
        if created and created.get('decay_date'):
            created['decay_date'] = created['decay_date'].isoformat()
        return created
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.delete("/api/objects/{object_id}")
def delete_object(object_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        # Cascade delete is handled by the database for orbital_parameters and conjunction_events
        cur.execute("DELETE FROM space_objects WHERE object_id = %s RETURNING object_id;", (object_id,))
        deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(status_code=404, detail="Object not found")
        conn.commit()
        return {"deleted": True, "object_id": object_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.patch("/api/objects/{object_id}")
def update_object_status(object_id: int, update: SpaceObjectUpdate):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE space_objects SET status = %s WHERE object_id = %s RETURNING *;", (update.status, object_id))
        updated = cur.fetchone()
        if not updated:
            raise HTTPException(status_code=404, detail="Object not found")
        conn.commit()
        if updated.get('launch_date'):
            updated['launch_date'] = updated['launch_date'].isoformat()
        if updated.get('decay_date'):
            updated['decay_date'] = updated['decay_date'].isoformat()
        return updated
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.put("/api/objects/{object_id}")
def update_object_full(object_id: int, update: SpaceObjectFullUpdate):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            UPDATE space_objects 
            SET name = %s, object_type = %s, owner_id = %s, shell_id = %s, 
                launch_date = %s, status = %s, mass_kg = %s, radar_cross_section = %s
            WHERE object_id = %s RETURNING *;
        """, (update.name, update.object_type, update.owner_id, update.shell_id, 
              update.launch_date if update.launch_date else None, update.status, 
              update.mass_kg, update.radar_cross_section, object_id))
        updated = cur.fetchone()
        if not updated:
            raise HTTPException(status_code=404, detail="Object not found")
        conn.commit()
        if updated.get('launch_date'):
            updated['launch_date'] = updated['launch_date'].isoformat()
        if updated.get('decay_date'):
            updated['decay_date'] = updated['decay_date'].isoformat()
        return updated
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.post("/api/conjunctions")
def create_conjunction(conj: ConjunctionCreate):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO conjunction_events (object1_id, object2_id, tca, miss_distance_km, collision_probability, relative_velocity_kms, risk_level)
            VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *;
        """, (conj.object1_id, conj.object2_id, conj.tca, conj.miss_distance_km, conj.collision_probability, conj.relative_velocity_kms, conj.risk_level))
        created = cur.fetchone()
        conn.commit()
        
        # Check if alert was triggered
        cur.execute("SELECT * FROM alert_log WHERE event_id = %s;", (created['event_id'],))
        alerts = cur.fetchall()
        
        if created and created.get('tca'):
            created['tca'] = created['tca'].isoformat()
        if created and created.get('detected_at'):
            created['detected_at'] = created['detected_at'].isoformat()
            
        created['alert_fired'] = len(alerts) > 0
        return created
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.delete("/api/conjunctions/{event_id}")
def delete_conjunction(event_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM conjunction_events WHERE event_id = %s RETURNING event_id;", (event_id,))
        deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(status_code=404, detail="Conjunction not found")
        conn.commit()
        return {"deleted": True, "event_id": event_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.patch("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("UPDATE alert_log SET acknowledged = TRUE WHERE alert_id = %s RETURNING *;", (alert_id,))
        updated = cur.fetchone()
        if not updated:
            raise HTTPException(status_code=404, detail="Alert not found")
        conn.commit()
        if updated.get('triggered_at'):
            updated['triggered_at'] = updated['triggered_at'].isoformat()
        return updated
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.delete("/api/alerts/{alert_id}")
def delete_alert(alert_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM alert_log WHERE alert_id = %s RETURNING alert_id;", (alert_id,))
        deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(status_code=404, detail="Alert not found")
        conn.commit()
        return {"deleted": True, "alert_id": alert_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/api/owners")
def get_owners():
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("SELECT * FROM owners ORDER BY name ASC;")
        results = cur.fetchall()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.post("/api/owners")
def create_owner(owner: OwnerCreate):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("""
            INSERT INTO owners (name, type, country_code, founded_year)
            VALUES (%s, %s, %s, %s) RETURNING *;
        """, (owner.name, owner.type, owner.country_code, owner.founded_year))
        created = cur.fetchone()
        conn.commit()
        return created
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.delete("/api/owners/{owner_id}")
def delete_owner(owner_id: int):
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM owners WHERE owner_id = %s RETURNING owner_id;", (owner_id,))
        deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(status_code=404, detail="Owner not found")
        conn.commit()
        return {"deleted": True, "owner_id": owner_id}
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
