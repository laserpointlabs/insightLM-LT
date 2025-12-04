# ALT-X1 Aircraft Design Specifications

## Document Information

**Document ID:** DS-ALT-X1-v1.2
**Revision:** 1.2
**Date:** February 2025
**Status:** Preliminary Design Review (PDR)

## Aerodynamic Design

### Wing Configuration

- **Type:** High-aspect-ratio swept wing
- **Sweep Angle:** 25 degrees at quarter chord
- **Aspect Ratio:** 11.5
- **Wing Area:** 106.5 m²
- **Airfoil:** Supercritical airfoil (NASA SC(2)-0714 derived)
- **Wing Loading:** 704 kg/m²

### Fuselage Design

- **Cross-Section:** Circular with 4.2 meter diameter
- **Length-to-Diameter Ratio:** 9.05
- **Cabin Configuration:** Single-aisle, 2+2 seating
- **Cabin Width:** 3.5 meters
- **Overhead Bin Capacity:** 50 liters per passenger

### Empennage

- **Horizontal Stabilizer:** T-tail configuration
- **Vertical Stabilizer:** Single fin with rudder
- **Control Surfaces:** Fly-by-wire actuation

## Structural Design

### Material Selection

- **Primary Structure:** Carbon Fiber Reinforced Polymer (CFRP)
- **Secondary Structure:** Aluminum-lithium alloys
- **Weight Savings Target:** 20% reduction vs. aluminum baseline

### Load Factors

- **Ultimate Load Factor:** +3.5g / -1.5g
- **Limit Load Factor:** +2.5g / -1.0g
- **Fatigue Life:** 60,000 flight hours

### Structural Analysis

- **Finite Element Model:** 2.5 million elements
- **Critical Load Cases:**
  - Maximum takeoff weight
  - Maximum landing weight
  - Gust loads (FAR 25.341)
  - Emergency landing (FAR 25.561)

## Systems Integration

### Hydraulic System

- **Pressure:** 3,000 psi
- **Number of Systems:** 2 independent systems
- **Fluid:** Skydrol LD-4

### Electrical System

- **Voltage:** 115V AC, 28V DC
- **Power Generation:** 2× 90 kVA generators
- **Backup:** APU generator, battery backup

### Environmental Control System

- **Pressurization:** 8,000 ft cabin altitude at 41,000 ft cruise
- **Temperature Control:** 18-24°C cabin temperature range
- **Air Exchange:** 20 air changes per hour

## Performance Analysis

### Takeoff Performance

- **V1 (Decision Speed):** 145 knots
- **VR (Rotation Speed):** 150 knots
- **V2 (Takeoff Safety Speed):** 160 knots
- **Balanced Field Length:** 1,180 meters

### Landing Performance

- **VREF (Reference Speed):** 140 knots
- **Approach Speed:** 145 knots
- **Landing Distance:** 950 meters (dry runway)

### Cruise Performance

- **Optimal Cruise Altitude:** 38,000-41,000 feet
- **Cruise Mach Number:** 0.78
- **Fuel Flow:** 2,200 kg/hour (both engines)
- **Specific Range:** 0.18 nautical miles per kg fuel

## Design Validation

### Computational Fluid Dynamics (CFD)

- **Reynolds Number:** 15-20 million
- **Turbulence Model:** k-ω SST
- **Mesh Size:** 45 million cells
- **Drag Prediction:** CD = 0.025 at cruise

### Wind Tunnel Testing

- **Facility:** NASA Langley 14×22 Foot Subsonic Tunnel
- **Model Scale:** 1:10
- **Test Points:** 120 configurations
- **Reynolds Number Correction:** Applied

## Design Review Status

- **Conceptual Design:** ✅ Complete
- **Preliminary Design:** ✅ Complete (PDR passed)
- **Detailed Design:** 🔄 In Progress
- **Critical Design Review:** 📅 Scheduled Q3 2025

## Key Design Parameters

- **Design ID:** DS-ALT-X1-v1.2
- **Aerodynamic ID:** AERO-ALT-X1-WING-001
- **Structural ID:** STRUCT-ALT-X1-FUSELAGE-002
