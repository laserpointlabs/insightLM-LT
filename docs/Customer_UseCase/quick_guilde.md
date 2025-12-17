# 1. Overview

## 1.1 Purpose

The purpose of this guide is to define a process and framework that identifies and documents the key capabilities and attributes a system must demonstrate to close Warfighter mission gaps. These focus areas help the team prioritize efforts when time is limited for acquisition activities. The approach outlined enables the team to rapidly decompose those capabilities into measurable criteria that define the system's desired end state and serve as the foundation for Verification & Validation (V&V) planning and overall trade space decisions. These criteria are not intended to function as traditional requirements, but rather as acceptable operational outcomes against which technical maturity and feasibility can be assessed. This allows any limitations to be understood in context, enabling identification of mission and operational risks. Ultimately, this framework ensures decision makers can balance performance, cost, and schedule with clear insight into mission impact. Additionally, this approach is scalable and agile so that it can adapt to changes in the mission, threat definition, or prioritization.

## 1.2 Definitions

### 1.2.1 Critical Operational Issue

Critical Operational Issue (COI) refers to a key "yes/no" question of operational effectiveness or suitability that must be answered during Verification and Validation (V&V) activities to determine whether a system can successfully perform its intended mission. Within this framework, COIs are the starting point that capture what matters most to the Warfighter and frame the mission outcomes the system must achieve. 

(JKD: We need to help them understand what matters most through analysis not verbaliztion or "Here is what i think")

### 1.2.2 Critical Operational Issues and Criteria

Critical Operational Issues and Criteria (COICs) expand each COI by adding measurable or threshold criteria that define the conditions for mission success. In practice, COICs form the foundation for all Test & Evaluation (T&E) and Modeling & Simulation (M&S) planning. They establish the link between operational needs and technical verification by translating questions into testable criteria, which are typically categorized into Measures of Effectiveness, Performance, and Suitability (MOEs / MOPs / MOSs). (Im not a fan of this.. its leasve we shuold be scanning to provie a target... not a point)

### 1.2.3 Measures of Effectiveness

Measures of Effectiveness (MOEs) are quantitative indicators that assess how well a system accomplishes its intended mission outcomes under realistic operational conditions. In the framework, MOEs express mission success in measurable terms and become the top-level outcome based metrics used to validate that the system achieves operational effectiveness. MOEs tend to be solution agnostic.

### 1.2.4 Measures of Performance

Measures of Performance (MOPs) are metrics that evaluate specific system functions or behaviors to confirm that the system performs as designed. They provide the technical link between design and mission outcomes, showing whether the performance attributes that drive MOEs are achieved during testing or analysis. MOPs tend to be solution driven.

### 1.2.5 Measures of Suitability

Measures of Suitability (MOSs) assess how well a system can be supported, maintained, and sustained in its intended operational environment. Within this framework, MOSs ensure that test and verification planning accounts for reliability, maintainability, and availability to support the determination of whether a system remains effective over time.

### 1.2.6 Verification Cross-Reference Matrix

The Verification Cross-Reference Matrix (VCRM) is a structured table that maps each requirement to its corresponding verification method and to its associated evidence or test case. It provides the engineering-to-test hand-off by showing what must be verified, how it will be assessed, and how results trace back to COIC criteria. Verification methods include analysis, test, inspection, or demonstration.

### 1.2.7 Trade Space Management

Trade Space Management is the process of analyzing and balancing performance, cost, schedule, and risk when determining design or acquisition decisions. In this framework, COICs and their associated measures serve as the decision baseline for managing that trade space—allowing leadership to understand the mission impact of potential limitations and make informed decisions.

# 2. Capability Definition Process and Framework

## 2.1 Overview

The process defined in this guide describes the sequence of activities used to identify, decompose, and verify Warfighter capability needs when time or definition is limited. It outlines how to capture a capability gap through developing measurable criteria and conducting verification.

The framework represents how the results of that process are organized, captured, and communicated. It provides structured artifacts (e.g. COIC tables, VCRM) that document the outputs of each step in a consistent, traceable manner.

Together, the process and framework ensure that operational needs are rapidly converted into testable, verifiable system attributes. The process drives analysis and decision-making, while the framework preserves traceability and supports formal T&E activities.

## 2.2 Process Overview

The process depicted Figure 1 follows a sequence of seven steps that guides capability definition from gap identification through verification methods.

**Figure 1 - Capability Definition Process**

Table 1 provides a summary of the focus and output from each step of the process, while Section 3 Detailed Process Steps and Outputs provides detailed explanations of each step.

| Step | Focus | Output |
|------|-------|--------|
| 1. Capability Gap Definition | Identify the Warfighter mission gap, operational environment, and intended mission outcomes. | Mission Threads<br>Mission Gap Statement |
| 2. COI Development | Define key operational questions that capture what must be true for mission success. | COI List |
| 3. COIC Development | Add measurable or threshold criteria to each COI, establishing conditions for success. | COIC Table<br>Verification Objectives |
| 4. Measures Definition | Quantify operational and technical attributes that support each COIC. | Measures Table (i.e. MOEs, MOPs, MOSs) |
| 5. System Requirements Derivation | Translate measures into verifiable system requirements. | System Requirements Table |
| 6. Verification Planning | Define verification methods, test objectives, and data-collection strategies. | VCRM, TEMP Inputs |

**Table 1 - Capability Definition Process Steps**

## 2.3 Framework Overview

The framework is composed of six levels that align with the process, each building upon the previous to establish end-to-end traceability from capability gaps to verified performance evidence. Table 2 details each level of the framework that captures the resulting artifacts of the process.

| Item | Description |
|------|-------------|
| Mission Thread | A unique representation of a mission scenario that includes operational activities, actors, environments, and system interactions defining how the mission is executed. Captures mission flow sequences, operational conditions, and key performance drivers. |
| COI | A critical operational "yes/no" question that defines what must be achieved for mission success. Each includes an identifier, a concise question statement, and traceability to the associated mission thread or capability gap. |
| COIC | The pairing of a COI with its measurable or threshold criterion, expressed in terms of operational effectiveness, suitability, or survivability. Includes parameters, thresholds, and rationale supporting the criterion. |
| Measure | A single quantitative metric defined as a MOE, MOP, or MOS that characterizes system behavior or mission outcome. Includes the parameter name, unit of measure, calculation or data source, and the related COIC or requirement. |
| Systems Requirement | A verifiable system statement derived from one or more measures. Includes the requirement identifier, statement, rationale, and trace references to associated COICs and measures. |
| Verification Method | The defined method and approach used to confirm compliance with a criterion, measure, or requirement. Specifies the verification technique (analysis, test, inspection, or demonstration) and the type of data or evidence to be collected. |

**Table 2 - Capability Definition Framework**

# 3. Detailed Process Steps and Outputs

## 3.1 Step 1 – Capability Gap Definition

This step defines the operational problem(s) to be solved. The team identifies what the Warfighter cannot accomplish today (JKD: shuoldn't we also include want the enemy can do today?), the conditions under which that gap exists, and the outcomes needed to close it. Inputs may include the Mission Needs Statement (MNS), Concept of Operations (CONOPS), Concept of Employment (CONEMP), and any existing operational analysis. The team documents the mission context including operational environment, stakeholders, threat conditions, and key performance drivers, and then confirms alignment with higher-level mission objectives. (JKD: We need to think about this like a baseball game... keep it simple but similar)

Outputs are captured in short, structured artifacts such as a Mission Gap Statement, Mission Threads, and Operational Context Summaries. These establish the baseline for subsequent COI development and provide traceable references for later test and verification planning.

## 3.2 Step 2 – COI Development

The team conducts workshops with requirements officers, operators, system engineers, testers, and subject matter experts (SMEs) to identify the essential operational questions that define mission success. Each COI is phrased as a question addressing effectiveness or suitability, beginning with "Can the system…" or "Will the system…". The list is generally three to fifteen issues and refined for clarity, independence, and mission relevance.

COIs are documented in a COI List that includes the issue statement, associated mission thread, and stakeholder origin. Each COI is assigned an identifier to maintain traceability through subsequent decomposition and verification steps.

## 3.3 Step 3 – COIC Development

Each COI is expanded into a COIC by adding measurable or threshold criteria (in the form of Verification Objectives) that define acceptable performance or suitability. The team collaborates with T&E and SMEs to ensure that each criterion is realistic, testable, and relevant to mission success. Consensus approval is obtained before inclusion in the Test & Evaluation Master Plan (TEMP).

Results are captured in a COIC Table, pairing each operational issue with its measurable criteria and rationale. The table also includes references to data sources or test objectives that will demonstrate compliance.

## 3.4 Step 4 – Measures Definition

The team decomposes each COIC into quantitative measures used to plan and evaluate performance.

- **MOEs** validate that mission outcomes are achieved.
- **MOPs** verify that system functions achieve required technical performance.
- **MOSs** assess reliability, maintainability, and supportability.

These measures are derived concurrently with modeling and simulation, analysis, and preliminary test design activities.

Measures are organized in a Measures Table that links each measure to its parent COIC, associated test objective, and intended data collection method. This artifact becomes the quantitative basis of requirements derivation and V&V planning.

## 3.5 Step 5 – System Requirements Derivation

From the established measures, system engineers derive system requirements following standard requirements elicitation practices. Each requirement must map back to one or more COICs and associated measures. Requirements are reviewed with design and test stakeholders to ensure they are verifiable and consistent with system architecture and acquisition constraints.

Outputs are recorded in a System Requirements Table that establishes bidirectional traceability between COICs, measures, and requirements.

## 3.6 Step 6 – Verification Planning

The final step in this process defines how each derived requirement will be verified during subsequent Test & Evaluation (T&E) activities. The team identifies appropriate verification methods and establishes how each COIC criterion and associated measure will be confirmed. Test objectives, conditions, and data collection needs are coordinated with the responsible developmental and operational test organizations. This step ensures that all verification activities are fully traceable to operational needs before test execution begins.

Verification planning outputs are captured in the VCRM. This links each requirement to its verification method, success criteria, responsible organization, and planned test case. The approved VCRM serves as the formal handoff from Systems Engineering to T&E and informs the roadmap for test execution.

# 4. Link to Test & Evaluation

The COI and COIC framework provide the bridge between system definition and T&E execution. By framing mission-critical questions and translating them into measurable criteria, COICs define what must be proven through V&V activities to assess mission effectiveness and suitability. Each COIC maps directly to test objectives and corresponding MOEs, MOPs, and MOSs, which collectively guide test design, data collection, and analysis. The resulting VCRM serves as the formal hand-off from systems engineering to T&E, defining what must be verified, how it will be measured, and what constitutes success in operational terms. This structured traceability ensures that T&E activities remain focused on operational relevance, support early identification of capability gaps and risks, and provide objective evidence for V&V and fielding decisions.

# Appendix A: Acronyms

| Acronym | Definition |
|---------|------------|
| COI | Critical Operational Issue |
| COIC | Critical Operational Issues and Criteria |
| CONEMP | Concept of Employment |
| CONOPS | Concept of Operations |
| DAG | Defense Acquisition Guidebook |
| MNS | Mission Needs Statement |
| MOE | Measure of Effectiveness |
| MOP | Measure of Performance |
| MOS | Measure of Suitability |
| SME | Subject Matter Expert |
| T&E | Test & Evaluation |
| TEMP | Test & Evaluation Master Plan |
| V&V | Verification & Validation |
| VCRM | Verification Cross Reference Matrix |
