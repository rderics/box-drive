**Assetto Corsa Telemetry & Driving Analytics
A real-time telemetry analysis system that captures driving data, detects dangerous driving events (harsh braking, acceleration, turning, weaving, and speeding), calculates driver safety scores, and synchronizes data directly with a Supabase database.

**Overview
The core engine (driving_events.py & live.py) processes telemetry streams on the fly. It monitors vehicle dynamics and flags risky behaviors to evaluate driver performance in real time.

**Frontend & Real-World Integration
The Widget Interface: The frontend acts as a live companion widget for the primary OCTA platform. While driving, it provides the user with instant driving tips and displays their most recent driving errors/violations in real time.

**Real-World Scope: In a real-world deployment, all these telemetry metrics, motion dynamics, and event tracking will be computed using a smartphone’s built-in gyroscope and accelerometer.

**Features
Real-Time Telemetry Processing: Hooks into game physics (Assetto Corsa) or custom telemetry sources.

**Event Detection: Automatically detects harsh braking, acceleration, cornering, loss of control, and speeding.

**Scoring System: Computes a normalized driver rating (0–100 scale with letter grades).

Supabase Integration: Automatically logs completed trips and detected violations directly to Supabase (--upload).

Quick Start
Install dependencies:

Bash
pip install -r requirements.txt
pip install supabase
Run live analysis with Assetto Corsa:

Bash
python live.py ac --zones "0-1500:60,1500-:90" --upload
