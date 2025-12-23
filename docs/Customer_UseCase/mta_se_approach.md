# Systems Engineering Approach for Middle Tier of Acquisition (MTA) Programs

## 1. Purpose

This document establishes the conceptual systems engineering approach for aviation platform programs executing under the Middle Tier of Acquisition (MTA) pathway. It provides the framework for how systems engineering activities will be conducted when working with an existing materiel solution <span style="color:red">*(JKD: There are no solutins only trade-offs)*</span> where traditional specification-first methodologies are not appropriate.

### 1.1 Scope

This approach applies to MTA programs where:
- An existing materiel solution has been selected as the point of departure for trade analysis
- A complete system specification does not exist at program start
- The focus is on assessing existing capability and identifying value-added upgrades
- Rapid prototyping and fielding timelines (2-5 years) constrain traditional development approaches

### 1.2 Terminology: Existing Materiel Solutions

Throughout this document, "existing materiel solution" refers to any system or capability that already exists and can serve as a point of departure for rapid acquisition. This includes:

- **COTS (Commercial Off-The-Shelf)**: Commercially available products
- **GOTS (Government Off-The-Shelf)**: Existing government-owned systems or components
- **S&T Outputs**: Technology or prototypes from Science & Technology efforts ready for transition

The principles in this document apply regardless of the solution source. The key characteristic is that the system exists today and will be assessed and potentially modified, rather than developed from scratch to meet a specification.

### 1.3 Relationship to Traditional NAVAIR Processes

Traditional NAVAIR systems engineering processes, as outlined in NAVAIRINST 4355.19E, center on a specification-driven approach using "shall statements" to define requirements before system development begins. This approach assumes:
- Requirements can be fully defined upfront
- The system will be developed or significantly modified to meet those requirements
- A linear requirements-to-design-to-verification flow

The MTA pathway, by design, requires a different mindset. This document describes how systems engineering rigor is maintained while adapting to the realities of rapid acquisition programs leveraging existing materiel solutions.

---

## 2. The MTA Challenge

### 2.1 Why Traditional Approaches Don't Fit

When an existing materiel solution is selected as the point of departure, the traditional "specify then build" model inverts:

| Traditional Approach | MTA Approach |
|---------------------|-------------------|
| Define requirements first | Assess existing capability first |
| System designed to meet specs | Specs derived from system capability |
| Shall statements drive design | Desirements inform trade decisions |
| Gaps are design problems | Gaps are trade opportunities |
| Success = meets all requirements | Success = best value within constraints |

### 2.2 The Core Problem

Applying traditional shall-statement requirements to an existing solution creates several issues:

1. **Artificial Gaps**: Writing shall statements that the solution cannot meet creates "requirements gaps" that may not reflect actual operational need
2. **Wasted Effort**: Extensive specification development for a system that already exists
3. **False Precision**: Implying design flexibility that doesn't exist with an existing solution
4. **Misaligned Incentives**: Focusing on compliance rather than mission value

### 2.3 What MTA Enables

The MTA pathway was established to enable:
- **Rapid Prototyping**: Field a prototype to refine requirements through operational use
- **Rapid Fielding**: Quickly deliver existing capability that meets acceptable standards
- **Iterative Development**: Learn and adapt rather than predict and specify

This requires systems engineering that assesses, trades, and adapts rather than specifies, verifies, and delivers.

---

## 3. Capability-Based Systems Engineering Approach

### 3.1 Core Principles

1. **Start with What Exists**: The existing materiel solution is the starting point, not a blank sheet
2. **Desirements Over Requirements**: Express needs as prioritized desires, not absolute mandates
3. **Trade Space Over Compliance**: Every gap is a trade decision, not a deficiency
4. **Mission Value Focus**: Measure success by operational outcome, not specification compliance
5. **Collaborative Development**: Government and OEM work together to optimize, not adversarially verify

### 3.2 Understanding Desirements

A **desirement** is fundamentally different from a traditional requirement. Think of a desirement as an **aimpoint**—it represents what we think we want at the time, but we acknowledge we might be satisfied if we simply "hit the board." <span style="color:red">*(JKD: This sounds like uncertatnly quantification to me)*</span>

**Key characteristics of desirements:**
- They express intent and priority, not absolute thresholds
- The acceptable tolerance around the aimpoint is unknown until we assess all <span style="color:red">*(JKD: 'All' → this is a tall ask)*</span> trades in the operational context
- A desirement of "100 miles range" doesn't mean 99 miles is a failure—it means we need to evaluate what we actually get against what it costs to get more
- Desirements are inputs to trade decisions, not pass/fail criteria

<span style="color:red">*JKD: We need to establish what a system is [Mutual Specific Dependance (MSD), Fiat Boundaries, etc.] {Remeber the Airbus harness issues related to systems}</span>

This approach recognizes that in MTA programs, we cannot know the "right" answer upfront. The right answer emerges from understanding what the existing solution provides, what improvements are possible, what they cost, and how much operational value they deliver.

### 3.3 Minimal Capability Baseline

Rather than a comprehensive system specification, define a **Minimal Capability Baseline (MCB)** that captures:

- **Essential Capabilities**: What the system absolutely must do to be operationally useful <span style="color:red">*(JKD: How do we establish what is essential?)*</span>
- **Desirements**: Additional capabilities that add value, prioritized by operational importance (see 3.2) <span style="color:red">(JKD: Is this just capabilities?)</span>
- **Constraints**: Hard limits that cannot be violated (safety, security, interface compatibility) <span style="color:red">*(JKD: If we are using the concept of 'aimpoint' then constraitns cannot be 'hard' we need to return a margin relative the desirements and contraints, and then establish the trade relative to the range from the target.)*</span>
- **Measures**: How success will be judged <span style="color:red">*(JKD: A measure is just that a measure, we might consider useing some more progreasisve way to evaluate cpability than a measure, its like we are not sure how to measure a batter yet, we have yet to understand that a batting average might work, we walk up onto it under unsertanty)*</span>, including:
  - **Measures of Effectiveness (MOEs)**: Mission outcome metrics (solution agnostic)
  - **Measures of Performance (MOPs)**: System function/behavior metrics (solution driven)
  - **Measures of Suitability (MOSs)**: Reliability, maintainability, and sustainment metrics

This baseline is intentionally minimal to:
- Focus effort on what matters most
- Leave room for trade decisions
- Avoid over-specifying areas where existing capability is acceptable

For detailed guidance on developing the MCB using a structured Critical Operational Issues and Criteria (COIC) framework, refer to the *PROGRAM Quick Start Guide to Capability Definition*.

### 3.4 Assessment Against Capability Needs

With the Minimal Capability Baseline defined, assess the existing materiel solution: <span style="color:red">*(JKD: Why not just asses what we need as a point solution spanning the ranges of the analysis relative to the desirments, could be a humming bird, could be the death star, and then evaluate the gaps relative to the capability of the matieral solution, we know what the matieral solution can do... again I dont these we are understanding how to evaluate the capability space, one material solution might perform poorly, several combind into another 'materal' solution may perform better or worse, a new group of multiple meterial soltuions may perform better or worse... lets expand this though.)*</span>

**Assessment Categories:**
| Category | Description |
|----------|-------------|
| **Meets** | Existing capability satisfies the need as-is |
| **Partially Meets** | Solution provides some capability; gap may or may not need addressing |
| **Does Not Meet** | Solution lacks capability; requires upgrade or operational workaround |
| **Exceeds** | Solution provides more capability than required |

**Key Questions for Each Desirement:**
- Does the existing solution meet this need? To what degree?
- If not, what would it take to close the gap (cost, schedule, risk)?
- What is the mission/operational impact of the gap?
- Is the gap acceptable, or must it be addressed?

### 3.5 Trade Space Framework

Every gap between existing capability and desirements represents a trade decision. The trade space is evaluated across multiple dimensions:

**Trade Dimensions:**
1. **Cost**: What resources are required (development, integration, sustainment)?
2. **Schedule**: How long will it take? Does it fit MTA timelines?
3. **Performance**: How much capability improvement does it provide?
4. **Risk**: What technical, schedule, and programmatic risks are introduced?
5. **Mission Value**: What operational improvement results?

**Trade Decision Framework:**

```
For each capability gap:
├── Option A: Accept as-is (operational workaround)
│   └── Evaluate: Mission impact vs. zero cost/schedule/risk
├── Option B: Modify/Upgrade existing solution
│   └── Evaluate: Capability gain vs. cost/schedule/risk
├── Option C: Integrate external solution
│   └── Evaluate: Capability gain vs. integration complexity
└── Option D: Defer to future increment
    └── Evaluate: Current acceptability vs. future opportunity
```

### 3.6 Quantifying Mission/Operational Value

To make informed trades, capability improvements must be tied to mission outcomes:

**Value Assessment Approach:**
- **Operational Scenarios**: Define representative mission scenarios
- **Current Capability**: How well does the existing solution perform these scenarios?
- **Improved Capability**: How much better with proposed upgrade?
- **Value Quantification**: Express improvement in operational terms (time saved, missions enabled, risk reduced)

This allows comparison of unlike upgrades: "Upgrade A costs $X and enables Y additional mission types" vs. "Upgrade B costs $Z and reduces mission time by W%."

---

## 4. Decision Framework

### 4.1 Decision Authority

Trades and capability decisions require clear authority. The Chief Engineer serves as the primary technical authority for systems engineering decisions:

| Decision Type | Authority | Coordination |
|--------------|-----------|--------------|
| Accept solution as-is for essential capability | Chief Engineer | Class Desk, Operational Rep |
| Pursue upgrade within existing scope/budget | Chief Engineer | Product Owner, OEM |
| Pursue upgrade requiring scope/budget change | Chief Engineer | Product Owner |
| Accept operational workaround | Chief Engineer | Class Desk, Operational Rep |

The Chief Engineer may delegate decision authority as deemed appropriate based on decision significance and organizational needs.

### 4.2 Decision Documentation

All trade decisions are documented with:

1. **Capability Need**: What desirement is being addressed
2. **Options Considered**: What alternatives were evaluated
3. **Trade Analysis**: How options compare across trade dimensions
4. **Decision**: What was decided and why
5. **Residual Risk/Impact**: What remains after decision

This provides traceability without traditional requirements verification matrices.

### 4.3 Iterative Decision Making

Decisions are not final until they must be. The MTA approach allows:

- **Early Decisions**: Where data is sufficient and timeline requires
- **Deferred Decisions**: Where learning will improve the trade
- **Revised Decisions**: Where new information changes the calculus

Document decision points and the information needed to make them.

---

## 5. Configuration Management Considerations

### 5.1 The Agile-Traditional Balance Challenge

MTA programs face a fundamental tension between agile, iterative approaches and traditional configuration management practices. Traditional CM assumes:
- A defined baseline that changes through formal processes
- Configuration items established early and controlled rigorously
- Change control boards with deliberate review cycles

The MTA approach requires:
- Rapid iteration and learning
- Flexibility to incorporate trade outcomes quickly
- Reduced bureaucracy that impedes timeline

### 5.2 Balancing Approach

The solution is not to abandon CM discipline, but to apply it appropriately:

| Traditional CM | MTA-Adapted CM |
|---------------|----------------|
| Establish baseline before development | Establish baseline from existing solution |
| All changes through formal CCB | Tiered authority based on impact |
| Detailed tracking of all items | Focus on items affecting trades/production |
| Change aversion | Change embrace with impact awareness |

**Key Principles:**
1. **Baseline what matters**: Focus CM rigor on items that affect capability trades, safety, interfaces, and production
2. **Tier the process**: Not all changes need the same level of control—match process to impact
3. **Integrate with trades**: Configuration decisions are trade decisions—link them explicitly
4. **Leverage OEM processes**: Use existing OEM CM where it works; don't create parallel bureaucracy

### 5.3 Configuration Management Objectives

For MTA programs with existing materiel solutions:
- Establish the as-is configuration as the reference point
- Track changes that result from trade decisions
- Maintain interface control with external systems
- Ensure production configuration is clearly defined
- Support sustainment through clear configuration records

---

## 6. Design Management (Placeholder)

### 6.1 Purpose

*This section will describe how system design is managed once the Minimal Capability Baseline (MCB) is established. Content to be developed based on conceptual approach for design reviews.*

### 6.2 Topics to Address

- Design review approach adapted for MTA context
- How trade study outcomes inform design decisions
- Integration of OEM design processes with Government oversight
- Design documentation expectations
- Relationship between MCB evolution and design maturity

*[Content to be added]*

---

## 7. Relationship to OEM SEMP

### 7.1 Division of Responsibility

This document establishes **what** the Government intends to accomplish and the **approach** for doing so. The OEM's Systems Engineering Management Plan (SEMP) establishes **how** these objectives will be executed.

| This Document (Government) | OEM SEMP |
|---------------------------|----------|
| Capability objectives | Technical execution approach |
| Trade framework | Trade study procedures |
| Decision authorities | Engineering processes |
| Assessment criteria | Verification methods |
| What success looks like | How success is demonstrated |

### 7.2 Collaborative Development

The Government and OEM work together to:

1. **Align on Objectives**: Ensure shared understanding of capability goals
2. **Develop Trade Studies**: OEM proposes, Government evaluates and decides
3. **Assess Existing Capability**: Joint evaluation against desirements
4. **Document Decisions**: Maintain shared record of trades and rationale
5. **Manage Configuration**: Coordinate changes to solution

### 7.3 SEMP Expectations

The OEM SEMP should address:

- How the existing materiel solution will be documented and managed
- How trade studies will be conducted and presented
- How capability assessments will be performed
- How changes will be proposed, evaluated, and implemented
- How configuration will be controlled
- How production readiness will be established

The SEMP should reflect the capability-based approach described here, not default to traditional specification-driven processes.

---

## 8. Summary

This document establishes a systems engineering approach tailored to MTA programs leveraging existing materiel solutions. Key elements:

1. **Recognize the MTA context**: Programs based on existing solutions require assessment and adaptation, not specification and development
2. **Use desirements, not requirements**: Express capability needs as prioritized desires (aimpoints) that inform trades—acceptable tolerance emerges from trade analysis
3. **Focus on trade space**: Every gap is a trade decision evaluated across cost, schedule, performance, risk, and mission value
4. **Quantify mission value**: Tie capability improvements to operational outcomes to enable informed decisions
5. **Collaborate with OEM**: Government defines what, OEM proposes how, decisions made together
6. **Balance CM approaches**: Apply configuration management rigor appropriately—match process to impact while maintaining discipline
7. **Maintain rigor differently**: Traceability through decision documentation, not requirements verification matrices

This approach maintains systems engineering discipline while adapting to the realities of rapid acquisition with existing materiel solutions.

---

*This document provides the conceptual framework. Project-specific implementation is detailed in the Project Systems Engineering Plan, tailored to the context, constraints, assumptions, and resources of that project.*
