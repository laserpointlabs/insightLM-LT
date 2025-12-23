#!/usr/bin/env python3
"""
Create PDF documents for aircraft development project
"""
import sys
from pathlib import Path

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    print("ERROR: reportlab is required for creating PDF files")
    print("Install with: pip install reportlab")
    sys.exit(1)

def create_pdf_from_text(pdf_path: Path, text_content: str, title: str = ""):
    """Create a PDF file from text content"""
    c = canvas.Canvas(str(pdf_path), pagesize=letter)
    width, height = letter

    # Add title if provided
    y = height - 50
    if title:
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, y, title)
        y -= 30
        c.setFont("Helvetica", 12)

    # Add content
    lines = text_content.split('\n')
    for line in lines:
        if y < 50:
            c.showPage()
            y = height - 50
        # Wrap long lines
        if len(line) > 80:
            words = line.split()
            current_line = ""
            for word in words:
                if len(current_line + word) < 80:
                    current_line += word + " "
                else:
                    if current_line:
                        c.drawString(50, y, current_line.strip())
                        y -= 15
                    current_line = word + " "
            if current_line:
                c.drawString(50, y, current_line.strip())
                y -= 15
        else:
            c.drawString(50, y, line)
        y -= 15

    c.save()

# System Architecture PDF
system_arch_content = """ALT-X1 Aircraft System Architecture Document

Document ID: ARCH-ALT-X1-SYS-v1.0
Revision: 1.0
Date: February 2025

SYSTEM OVERVIEW

The ALT-X1 aircraft systems architecture is designed around a distributed,
modular approach with triple redundancy for all critical systems.

AVIONICS ARCHITECTURE

Flight Management System (FMS)
- Primary FMS: Honeywell Primus Epic
- Backup FMS: Collins Pro Line Fusion
- Navigation: Dual GPS/INS with WAAS capability
- Data Bus: ARINC 429 and AFDX (Avionics Full-Duplex Switched Ethernet)

Display System
- Primary Flight Display (PFD): 15-inch LCD
- Multi-Function Display (MFD): 15-inch LCD (2 units)
- Engine Indication and Crew Alerting System (EICAS): 12-inch LCD
- Control Display Unit (CDU): 10-inch touchscreen (2 units)

Autopilot System
- Type: Digital fly-by-wire with mechanical backup
- Capability: Category IIIB autoland
- Redundancy: Triple redundant flight control computers

PROPULSION SYSTEM

Engine Configuration
- Number of Engines: 2
- Engine Type: High-bypass turbofan
- Thrust Rating: 35,000 lbf (155 kN) per engine
- Bypass Ratio: 10:1
- Fuel System: Dual independent fuel systems per engine

ENGINE IDENTIFIER: PROP-ALT-X1-ENG-001

ENVIRONMENTAL CONTROL SYSTEM

Pressurization
- Maximum Cabin Altitude: 8,000 feet at 41,000 ft cruise altitude
- Pressurization Rate: 500 ft/min maximum
- Safety Valves: Dual redundant outflow valves

Air Conditioning
- Cooling Capacity: 40,000 BTU/hour
- Temperature Control: 18-24°C cabin temperature
- Air Exchange: 20 air changes per hour

HYDRAULIC SYSTEM

System Configuration
- Number of Systems: 2 independent systems
- Operating Pressure: 3,000 psi
- Fluid Type: Skydrol LD-4
- Pump Configuration: Engine-driven primary, electric backup

ELECTRICAL SYSTEM

Power Generation
- Primary Generators: 2× 90 kVA (engine-driven)
- APU Generator: 90 kVA
- Battery Backup: 2× 24V, 40 Ah lithium-ion batteries
- External Power: 115V AC, 400 Hz ground power connection

SAFETY SYSTEMS

Fire Detection and Suppression
- Engine Fire Detection: Dual redundant sensors per engine
- Cargo Compartment: Smoke detection and Halon suppression
- Lavatory: Automatic fire suppression

Emergency Systems
- Emergency Oxygen: Chemical oxygen generators (15-minute supply)
- Emergency Locator Transmitter (ELT): 406 MHz satellite beacon
- Emergency Evacuation: 8 emergency exits, slide rafts

SYSTEM ARCHITECTURE ID: ARCH-ALT-X1-SYS-v1.0-20250215
"""

# Compliance Document PDF
compliance_content = """ALT-X1 Aircraft Compliance and Certification Document

Document ID: CERT-ALT-X1-COMPLIANCE-v1.0
Revision: 1.0
Date: March 2025

CERTIFICATION BASIS

The ALT-X1 aircraft is being certified under:
- FAA Part 25: Airworthiness Standards - Transport Category Airplanes
- EASA CS-25: Certification Specifications for Large Aeroplanes

CERTIFICATION TIMELINE

Phase 1: Type Certificate Application
- Application Submitted: Q1 2025
- Application Accepted: Q2 2025 (target)

Phase 2: Compliance Demonstrations
- Ground Testing: Q2-Q3 2025
- Flight Testing: Q3 2025 - Q2 2026
- Systems Validation: Q4 2025 - Q1 2026

Phase 3: Certification Approval
- Type Certificate Issued: Q3 2026 (target)
- Production Certificate: Q4 2026 (target)
- First Delivery: Q1 2027 (target)

AIRWORTHINESS REQUIREMENTS

Structural Requirements (FAR 25.301-25.561)
- Ultimate Load Factors: +3.5g / -1.5g
- Fatigue Life: 60,000 flight hours
- Damage Tolerance: Demonstrated for all primary structure
- Emergency Landing: 14g forward, 16g vertical, 9g sideward

Performance Requirements (FAR 25.101-25.125)
- Takeoff Distance: < 1,200 meters (demonstrated)
- Landing Distance: < 1,000 meters (demonstrated)
- Climb Gradient: > 2.4% (one engine inoperative)
- Stall Speed: < 130 knots (landing configuration)

Systems Requirements
- Redundancy: Triple redundancy for all critical systems
- Failure Analysis: Failure modes and effects analysis (FMEA) completed
- Reliability: Mean time between failures (MTBF) targets met

ENVIRONMENTAL COMPLIANCE

Noise Certification (ICAO Chapter 14)
- Approach Noise: < 85.0 EPNdB (target)
- Lateral Noise: < 90.0 EPNdB (target)
- Flyover Noise: < 95.0 EPNdB (target)

Emissions Certification
- CO2 Emissions: 30% reduction vs. baseline (demonstrated)
- NOx Emissions: Meet CAEP/8 standards
- Particulate Matter: Meet current standards

SAFETY REQUIREMENTS

Crashworthiness (FAR 25.561-25.785)
- Emergency Landing: 14g forward, 16g vertical
- Seat Strength: 16g forward, 14g upward
- Overhead Bin Strength: 9g forward

Evacuation (FAR 25.803)
- Evacuation Time: < 90 seconds (demonstrated with 50% exits)
- Emergency Exits: 8 exits (4 per side)
- Exit Operation: Single-hand operation, < 10 seconds

Fire Protection (FAR 25.851-25.863)
- Fire Detection: Dual redundant sensors
- Fire Suppression: Halon 1301 systems
- Material Flammability: All materials meet FAR 25.853

OPERATIONAL REQUIREMENTS

Extended Operations (ETOPS)
- ETOPS Rating: 180 minutes (target)
- Single Engine Cruise: Demonstrated capability
- Systems Reliability: Meets ETOPS requirements

Maintenance Requirements
- Maintenance Program: MSG-3 analysis completed
- Inspection Intervals: Established per MSG-3
- Reliability Monitoring: Continuous monitoring program

CERTIFICATION IDENTIFIER: CERT-ALT-X1-2025-001
COMPLIANCE DOCUMENT ID: COMP-ALT-X1-FAA-EASA-v1.0
"""

if __name__ == "__main__":
    data_dir = Path(__file__).parent

    print("Creating aircraft development PDF documents...")

    # Create System Architecture PDF
    pdf_path = data_dir / "system_architecture.pdf"
    create_pdf_from_text(pdf_path, system_arch_content, "ALT-X1 System Architecture")
    print(f"✓ Created: {pdf_path.name}")

    # Create Compliance Document PDF
    pdf_path = data_dir / "compliance_certification.pdf"
    create_pdf_from_text(pdf_path, compliance_content, "ALT-X1 Compliance and Certification")
    print(f"✓ Created: {pdf_path.name}")

    print("\nAll PDF documents created successfully!")
