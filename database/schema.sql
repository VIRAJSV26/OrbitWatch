-- schema.sql
-- PostgreSQL Schema for OrbitWatch Space Debris Collision Risk Intelligence Platform

-- Drop tables if they exist for clean environment
DROP VIEW IF EXISTS polluter_leaderboard CASCADE;
DROP VIEW IF EXISTS shell_density_report CASCADE;
DROP TABLE IF EXISTS alert_log CASCADE;
DROP TABLE IF EXISTS conjunction_events CASCADE;
DROP TABLE IF EXISTS cascade_nodes CASCADE;
DROP TABLE IF EXISTS cascade_simulations CASCADE;
DROP TABLE IF EXISTS orbital_parameters CASCADE;
DROP TABLE IF EXISTS space_objects CASCADE;
DROP TABLE IF EXISTS orbital_shells CASCADE;
DROP TABLE IF EXISTS owners CASCADE;

-- 1. owners
CREATE TABLE owners (
    owner_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('COUNTRY', 'COMPANY', 'AGENCY')),
    country_code VARCHAR(10),
    founded_year INT,
    debris_score FLOAT DEFAULT 0.0
);

-- 2. orbital_shells
CREATE TABLE orbital_shells (
    shell_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    min_altitude_km FLOAT NOT NULL,
    max_altitude_km FLOAT NOT NULL,
    risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

-- Pre-seed orbital shells as requested
INSERT INTO orbital_shells (shell_id, name, min_altitude_km, max_altitude_km, risk_level) VALUES
('LEO_LOW', 'Low Earth Orbit (Low altitude)', 200.0, 600.0, 'HIGH'),
('LEO_HIGH', 'Low Earth Orbit (High altitude)', 600.0, 2000.0, 'CRITICAL'),
('MEO', 'Medium Earth Orbit', 2000.0, 35786.0, 'MEDIUM'),
('GEO', 'Geostationary Orbit', 35786.0, 35800.0, 'HIGH'),
('HEO', 'High Earth Orbit / Highly Elliptical', 35800.0, 99999.0, 'LOW');

-- 3. space_objects
CREATE TABLE space_objects (
    object_id SERIAL PRIMARY KEY,
    norad_id INT UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    object_type VARCHAR(50) NOT NULL CHECK (object_type IN ('SATELLITE', 'DEBRIS', 'ROCKET_BODY', 'UNKNOWN')),
    owner_id INT REFERENCES owners(owner_id) ON DELETE SET NULL,
    shell_id VARCHAR(50) REFERENCES orbital_shells(shell_id) ON DELETE SET NULL,
    launch_date DATE,
    decay_date DATE,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DEAD', 'DECAYED')),
    mass_kg FLOAT,
    radar_cross_section FLOAT
);

-- 4. orbital_parameters
CREATE TABLE orbital_parameters (
    param_id SERIAL PRIMARY KEY,
    object_id INT UNIQUE REFERENCES space_objects(object_id) ON DELETE CASCADE,
    epoch TIMESTAMP,
    inclination FLOAT,
    eccentricity FLOAT,
    semi_major_axis_km FLOAT,
    raan FLOAT,
    arg_of_perigee FLOAT,
    mean_anomaly FLOAT,
    mean_motion FLOAT,
    apogee_km FLOAT,
    perigee_km FLOAT,
    tle_line1 TEXT,
    tle_line2 TEXT,
    last_updated TIMESTAMP DEFAULT NOW()
);

-- 5. conjunction_events
CREATE TABLE conjunction_events (
    event_id SERIAL PRIMARY KEY,
    object1_id INT REFERENCES space_objects(object_id) ON DELETE CASCADE,
    object2_id INT REFERENCES space_objects(object_id) ON DELETE CASCADE,
    tca TIMESTAMP NOT NULL,
    miss_distance_km FLOAT NOT NULL,
    collision_probability FLOAT CHECK (collision_probability >= 0.0 AND collision_probability <= 1.0),
    relative_velocity_kms FLOAT,
    detected_at TIMESTAMP DEFAULT NOW(),
    risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'RESOLVED', 'PASSED')),
    CONSTRAINT no_self_conjunction CHECK (object1_id != object2_id)
);

-- 6. alert_log
CREATE TABLE alert_log (
    alert_id SERIAL PRIMARY KEY,
    event_id INT REFERENCES conjunction_events(event_id) ON DELETE CASCADE,
    triggered_at TIMESTAMP DEFAULT NOW(),
    alert_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    acknowledged BOOLEAN DEFAULT FALSE
);

-- 7. cascade_simulations
CREATE TABLE cascade_simulations (
    sim_id SERIAL PRIMARY KEY,
    object1_id INT REFERENCES space_objects(object_id) ON DELETE SET NULL,
    object2_id INT REFERENCES space_objects(object_id) ON DELETE SET NULL,
    initiated_at TIMESTAMP DEFAULT NOW(),
    total_objects_affected INT DEFAULT 0,
    shells_affected INT DEFAULT 0,
    status VARCHAR(50) DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETE'))
);

-- 8. cascade_nodes
CREATE TABLE cascade_nodes (
    node_id SERIAL PRIMARY KEY,
    sim_id INT REFERENCES cascade_simulations(sim_id) ON DELETE CASCADE,
    parent_node_id INT REFERENCES cascade_nodes(node_id) ON DELETE SET NULL,
    object_id INT REFERENCES space_objects(object_id) ON DELETE CASCADE,
    depth_level INT DEFAULT 0,
    collision_at TIMESTAMP,
    fragments_generated INT DEFAULT 0
);

-- Indexes as requested
CREATE INDEX idx_space_objects_object_type ON space_objects(object_type);
CREATE INDEX idx_space_objects_owner_id ON space_objects(owner_id);
CREATE INDEX idx_space_objects_shell_id ON space_objects(shell_id);

CREATE INDEX idx_conjunction_events_tca ON conjunction_events(tca);
CREATE INDEX idx_conjunction_events_risk_level ON conjunction_events(risk_level);
CREATE INDEX idx_conjunction_events_status ON conjunction_events(status);

CREATE INDEX idx_cascade_nodes_sim_id ON cascade_nodes(sim_id);
CREATE INDEX idx_cascade_nodes_depth_level ON cascade_nodes(depth_level);

-- Trigger: after INSERT on conjunction_events
-- If risk_level is HIGH or CRITICAL, auto-insert into alert_log with formatted message
CREATE OR REPLACE FUNCTION log_critical_conjunction_alert()
RETURNS TRIGGER AS $$
DECLARE
    obj1_name VARCHAR(255);
    obj2_name VARCHAR(255);
BEGIN
    SELECT name INTO obj1_name FROM space_objects WHERE object_id = NEW.object1_id;
    SELECT name INTO obj2_name FROM space_objects WHERE object_id = NEW.object2_id;

    IF NEW.risk_level IN ('HIGH', 'CRITICAL') THEN
        INSERT INTO alert_log (event_id, alert_type, message)
        VALUES (
            NEW.event_id,
            NEW.risk_level,
            NEW.risk_level || ' RISK COLLISION WARNING: Close approach detected between ' || 
            COALESCE(obj1_name, 'Object #' || NEW.object1_id) || ' (ID: ' || NEW.object1_id || ') and ' ||
            COALESCE(obj2_name, 'Object #' || NEW.object2_id) || ' (ID: ' || NEW.object2_id || '). ' ||
            'Miss Distance: ' || ROUND(NEW.miss_distance_km::numeric, 2) || ' km. ' ||
            'Collision Probability: ' || ROUND((NEW.collision_probability * 100)::numeric, 4) || '%.'
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_conjunction_alert
AFTER INSERT ON conjunction_events
FOR EACH ROW
EXECUTE FUNCTION log_critical_conjunction_alert();

-- Views as requested
-- shell_density_report
CREATE OR REPLACE VIEW shell_density_report AS
SELECT 
    os.shell_id,
    os.name AS shell_name,
    os.min_altitude_km,
    os.max_altitude_km,
    os.risk_level,
    COUNT(so.object_id) AS total_objects,
    COUNT(CASE WHEN so.object_type = 'DEBRIS' THEN 1 END) AS debris_count,
    COUNT(CASE WHEN so.object_type = 'SATELLITE' AND so.status = 'ACTIVE' THEN 1 END) AS active_satellites
FROM orbital_shells os
LEFT JOIN space_objects so ON os.shell_id = so.shell_id
GROUP BY os.shell_id, os.name, os.min_altitude_km, os.max_altitude_km, os.risk_level;

-- polluter_leaderboard
CREATE OR REPLACE VIEW polluter_leaderboard AS
SELECT 
    ow.owner_id,
    ow.name AS owner_name,
    ow.type,
    ow.country_code,
    COUNT(so.object_id) AS total_objects,
    COUNT(CASE WHEN so.object_type = 'DEBRIS' THEN 1 END) AS debris_count,
    COUNT(CASE WHEN so.object_type = 'SATELLITE' AND so.status = 'DEAD' THEN 1 END) AS dead_satellites,
    ROUND(
        (COUNT(CASE WHEN so.object_type = 'DEBRIS' THEN 1 END)::numeric / 
        NULLIF(COUNT(so.object_id), 0)::numeric * 100), 2
    ) AS debris_percentage
FROM owners ow
LEFT JOIN space_objects so ON ow.owner_id = so.owner_id
GROUP BY ow.owner_id, ow.name, ow.type, ow.country_code
ORDER BY debris_count DESC;

-- Stored Procedure: update_debris_scores()
CREATE OR REPLACE PROCEDURE update_debris_scores()
AS $$
BEGIN
    UPDATE owners ow
    SET debris_score = COALESCE(
        (
            (SELECT COUNT(*) FROM space_objects so WHERE so.owner_id = ow.owner_id AND so.object_type = 'DEBRIS') * 2.0 +
            (SELECT COUNT(*) FROM space_objects so WHERE so.owner_id = ow.owner_id AND so.object_type = 'SATELLITE' AND so.status = 'DEAD') * 1.5
        ) / NULLIF((SELECT COUNT(*) FROM space_objects so WHERE so.owner_id = ow.owner_id), 0)::float,
        0.0
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- RECURSIVE CTE: Kessler Cascade Chain Query
-- ============================================================================
-- This query fetches the full hierarchical collision cascade tree for a given simulation ID.
-- It traces the parent-child relationships between collided objects, depth levels, and generated fragments.
--
-- [Kessler Cascade Query]
-- WITH RECURSIVE kessler_cascade AS (
--     -- Anchor Member: Select the initial collided nodes (depth_level = 0, parent_node_id IS NULL)
--     SELECT 
--         node_id,
--         sim_id,
--         parent_node_id,
--         object_id,
--         depth_level,
--         collision_at,
--         fragments_generated,
--         ARRAY[node_id] AS path_trail
--     FROM cascade_nodes
--     WHERE sim_id = :sim_id AND parent_node_id IS NULL
--
--     UNION ALL
--
--     -- Recursive Member: Join cascade_nodes with active chain rows based on parent_node_id
--     SELECT 
--         cn.node_id,
--         cn.sim_id,
--         cn.parent_node_id,
--         cn.object_id,
--         cn.depth_level,
--         cn.collision_at,
--         cn.fragments_generated,
--         cc.path_trail || cn.node_id
--     FROM cascade_nodes cn
--     INNER JOIN kessler_cascade cc ON cn.parent_node_id = cc.node_id
--     WHERE cn.sim_id = :sim_id
-- )
-- SELECT 
--     kc.node_id,
--     kc.parent_node_id,
--     so.name AS object_name,
--     so.norad_id,
--     kc.depth_level,
--     kc.collision_at,
--     kc.fragments_generated,
--     kc.path_trail
-- FROM kessler_cascade kc
-- JOIN space_objects so ON kc.object_id = so.object_id
-- ORDER BY kc.depth_level, kc.collision_at;
