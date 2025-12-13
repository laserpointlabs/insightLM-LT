# Extension Licensing Architecture

## Overview

This document outlines the architecture for a commercial extension licensing system that allows the base product to include core extensions while enabling premium extensions to be sold separately. This enables a freemium model where users can purchase individual extensions as needed.

## Extension Categories

### Base Extensions (Included with Base Product)

These extensions are always enabled and require no license:

- **Dashboards Extension** - Core dashboard functionality
- **Workbooks Extension** - Core workbook management
- **Chat Extension** - Core chat/LLM functionality

### Premium Extensions (Paid Add-ons)

These extensions require a valid license to enable:

- **JupyterLab Extension** - Python notebook execution
- **Ontology Extension** - Ontology management and visualization
- **BPMN Extension** - Business Process Model and Notation tools
- **AI Learning & Context Optimization Extension** - Reinforcement learning for intelligent context selection and personalized responses
- *Additional premium extensions as they are developed*

### Extension Architecture Diagram

```mermaid
graph TB
    subgraph "Base Product"
        Core[Core Application]
        BaseExt1[Dashboards Extension<br/>Always Enabled]
        BaseExt2[Workbooks Extension<br/>Always Enabled]
        BaseExt3[Chat Extension<br/>Always Enabled]
    end

    subgraph "Premium Extensions"
        PremiumExt1[JupyterLab Extension<br/>Requires License]
        PremiumExt2[Ontology Extension<br/>Requires License]
        PremiumExt3[BPMN Extension<br/>Requires License]
        PremiumExt4[AI Learning Extension<br/>Requires License]
        PremiumExt5[Future Extensions...]
    end

    subgraph "License System"
        License[License Key/Account]
        Registry[Extension Registry]
    end

    Core --> BaseExt1
    Core --> BaseExt2
    Core --> BaseExt3

    License --> Registry
    Registry --> PremiumExt1
    Registry --> PremiumExt2
    Registry --> PremiumExt3
    Registry --> PremiumExt4

    style BaseExt1 fill:#90EE90
    style BaseExt2 fill:#90EE90
    style BaseExt3 fill:#90EE90
    style PremiumExt1 fill:#FFD700
    style PremiumExt2 fill:#FFD700
    style PremiumExt3 fill:#FFD700
    style PremiumExt4 fill:#FFD700
    style License fill:#87CEEB
    style Registry fill:#87CEEB
```

## Licensing System Components

### 1. License Key System

Each user receives a license key (purchased or trial) that contains:

- **User ID / Account ID** - Unique identifier for the license holder
- **Enabled Extension IDs** - List of extension IDs that are activated
- **Expiration Date** - Optional expiration for time-limited licenses
- **Feature Flags** - Additional feature-level permissions
- **License Signature** - Cryptographic signature to prevent tampering

### 2. License Storage

**Local Storage:**
- Encrypted license file stored locally (e.g., `license.json` or `.license`)
- Stored in app data directory with appropriate permissions
- Allows offline operation

**Optional Online Validation:**
- Periodic validation against license server
- Account-based activation for multi-device support
- Real-time license status updates

### 3. Extension Activation Flow

```mermaid
flowchart TD
    Start[App Startup] --> LoadLicense[Load License from Storage]
    LoadLicense --> Validate{Validate License<br/>Signature}
    Validate -->|Invalid| Error[Show License Error]
    Validate -->|Valid| Parse[Parse License<br/>Extract Extension IDs]
    Parse --> Discover[Discover Extensions<br/>Scan extensions/ directory]
    Discover --> Check{Extension Type?}
    Check -->|Base Extension| LoadBase[Always Load Base Extensions]
    Check -->|Premium Extension| CheckLicense{In License?}
    CheckLicense -->|Yes| LoadPremium[Load Premium Extension]
    CheckLicense -->|No| RegisterLocked[Register as Locked<br/>Don't Activate]
    LoadBase --> UpdateUI[Update UI]
    LoadPremium --> UpdateUI
    RegisterLocked --> UpdateUI
    UpdateUI --> ShowEnabled[Show Enabled Extensions]
    UpdateUI --> ShowLocked[Show Locked Extensions<br/>with Upgrade Prompts]

    style Start fill:#87CEEB
    style Validate fill:#FFD700
    style Check fill:#FFD700
    style CheckLicense fill:#FFD700
    style LoadBase fill:#90EE90
    style LoadPremium fill:#90EE90
    style RegisterLocked fill:#FFB6C1
    style Error fill:#FF6B6B
```

### 4. Purchase Flow

```mermaid
sequenceDiagram
    participant User
    participant App
    participant PurchasePage
    participant LicenseServer
    participant ExtensionRegistry

    User->>App: Clicks "Upgrade" or "Buy Extension"
    App->>PurchasePage: Redirect to Purchase Page
    User->>PurchasePage: Select Extension & Complete Purchase
    PurchasePage->>LicenseServer: Generate License Key
    LicenseServer->>LicenseServer: Create License with Extension IDs
    LicenseServer->>LicenseServer: Sign License Cryptographically
    LicenseServer->>User: Deliver License (Email/Download)
    User->>App: Import License Key
    App->>App: Validate License Signature
    App->>ExtensionRegistry: Register Enabled Extensions
    ExtensionRegistry->>App: Activate Extensions
    App->>User: Extension Available Immediately
```

## Implementation Options

### Implementation Options Comparison

```mermaid
graph TB
    subgraph "Option 1: License Key File"
        L1[User Purchases Extension]
        L2[Download .license File]
        L3[Import into App]
        L4[Validate Locally]
        L5[Activate Extension]
        L1 --> L2 --> L3 --> L4 --> L5
        L1 -.Offline Capable.-> L5
    end

    subgraph "Option 2: Account-Based"
        A1[User Purchases Extension]
        A2[Login to Account in App]
        A3[App Checks Account API]
        A4[Auto-Activate Extension]
        A1 --> A2 --> A3 --> A4
        A2 -.Requires Internet.-> A4
    end

    subgraph "Option 3: Hybrid Recommended"
        H1[User Purchases Extension]
        H2{Import Method?}
        H3[License Key File]
        H4[Account Login]
        H5[Validate & Sync]
        H6[Activate Extension]
        H1 --> H2
        H2 -->|Offline| H3
        H2 -->|Online| H4
        H3 --> H5
        H4 --> H5
        H5 --> H6
        H3 -.Works Offline.-> H6
        H4 -.Multi-Device Sync.-> H6
    end

    style L5 fill:#90EE90
    style A4 fill:#90EE90
    style H6 fill:#90EE90
    style H2 fill:#FFD700
```

### Option 1: License Key File

**Pros:**
- Works completely offline
- Simple implementation
- User controls license file

**Cons:**
- Manual license import required
- License file can be lost
- No automatic multi-device sync

**Implementation:**
- User downloads `.license` file after purchase
- App provides "Import License" functionality
- License validated locally with cryptographic signature

### Option 2: Account-Based Activation

**Pros:**
- Automatic activation after purchase
- Multi-device support
- Centralized license management
- Can revoke licenses if needed

**Cons:**
- Requires internet connection
- More complex infrastructure needed
- Server costs for validation

**Implementation:**
- User logs into account within application
- App checks account's purchased extensions via API
- Extensions auto-enable based on account status
- Periodic online validation for security

### Option 3: Hybrid Approach (Recommended)

**Pros:**
- Best of both worlds
- Offline capability with license key
- Online sync for convenience
- Flexible for different user needs

**Cons:**
- More complex to implement
- Requires both systems

**Implementation:**
- Primary: License key for offline use
- Optional: Account sync for multi-device
- Online validation for enhanced security
- Grace period for offline operation

## Extension Registry Architecture

```mermaid
graph TB
    subgraph "Extension Registry"
        Registry[Extension Registry Manager]

        subgraph "Base Extensions"
            Base1[Dashboards<br/>Status: Always Enabled<br/>License: Not Required]
            Base2[Workbooks<br/>Status: Always Enabled<br/>License: Not Required]
            Base3[Chat<br/>Status: Always Enabled<br/>License: Not Required]
        end

        subgraph "Premium Extensions"
            Premium1[JupyterLab<br/>Status: License-Gated<br/>License: Required]
            Premium2[Ontology<br/>Status: License-Gated<br/>License: Required]
            Premium3[BPMN<br/>Status: License-Gated<br/>License: Required]
        end

        subgraph "Extension Metadata"
            Meta[Metadata Schema<br/>- ID<br/>- Name<br/>- Description<br/>- License Required<br/>- Enabled Status<br/>- Trial Available]
        end
    end

    Registry --> Base1
    Registry --> Base2
    Registry --> Base3
    Registry --> Premium1
    Registry --> Premium2
    Registry --> Premium3
    Registry --> Meta

    License[License System] --> Registry

    style Base1 fill:#90EE90
    style Base2 fill:#90EE90
    style Base3 fill:#90EE90
    style Premium1 fill:#FFD700
    style Premium2 fill:#FFD700
    style Premium3 fill:#FFD700
    style Registry fill:#87CEEB
    style License fill:#87CEEB
    style Meta fill:#DDA0DD
```

### License Check Flow

```mermaid
flowchart LR
    subgraph "Step 1: App Startup"
        A1[App Starts] --> A2[Load License File]
        A2 --> A3[Validate Signature]
        A3 --> A4[Parse Extension IDs]
    end

    subgraph "Step 2: Extension Discovery"
        B1[Scan extensions/] --> B2[Load Manifests]
        B2 --> B3[Check License Requirement]
    end

    subgraph "Step 3: Extension Loading"
        C1{Extension Type?}
        C1 -->|Base| C2[Always Load]
        C1 -->|Premium| C3{In License?}
        C3 -->|Yes| C4[Load & Activate]
        C3 -->|No| C5[Register as Locked]
    end

    subgraph "Step 4: UI Updates"
        D1[Update Extension Manager]
        D2[Show Enabled Extensions]
        D3[Show Locked with Upgrade]
        D4[Display License Status]
    end

    A4 --> B1
    B3 --> C1
    C2 --> D1
    C4 --> D1
    C5 --> D1
    D1 --> D2
    D1 --> D3
    D1 --> D4

    style A1 fill:#87CEEB
    style C1 fill:#FFD700
    style C3 fill:#FFD700
    style C2 fill:#90EE90
    style C4 fill:#90EE90
    style C5 fill:#FFB6C1
```

## User Interface Considerations

### Extension Manager

A dedicated UI component showing:

- **Extension List**
  - Extension name and description
  - Status: Enabled / Locked / Trial
  - Version information

- **Locked Extensions**
  - Grayed out appearance
  - "Upgrade" or "Purchase" button
  - Brief feature description

- **Trial Extensions**
  - Limited-time use (e.g., 14 days)
  - Trial countdown timer
  - "Purchase" button to convert

### License Status Display

Settings panel showing:

- License validity status
- Enabled extensions list
- License expiration date (if applicable)
- "Import License" button
- "Check for Updates" button (for online validation)

### Upgrade Prompts

When user attempts to use locked extension:

- Modal or inline prompt
- Extension features overview
- Pricing information
- Direct link to purchase

## Security Considerations

### License Validation Flow

```mermaid
flowchart TD
    Start[License Validation Request] --> Load[Load License File]
    Load --> Extract[Extract Signature]
    Extract --> GetPublicKey[Get Public Key<br/>from App]
    GetPublicKey --> Verify{Verify Signature<br/>with Public Key}

    Verify -->|Invalid| Reject[Reject License<br/>Show Error]
    Verify -->|Valid| Parse[Parse License Data]

    Parse --> CheckExpiry{Expiration Date?}
    CheckExpiry -->|Expired| Reject
    CheckExpiry -->|Valid/None| CheckExtensions[Check Extension IDs]

    CheckExtensions --> OnlineCheck{Online Validation<br/>Required?}
    OnlineCheck -->|Yes| ConnectServer[Connect to License Server]
    ConnectServer --> ServerValidate{Server Validates}
    ServerValidate -->|Revoked| Reject
    ServerValidate -->|Valid| Accept[Accept License<br/>Activate Extensions]

    OnlineCheck -->|No/Offline| CheckGrace{Grace Period<br/>Valid?}
    CheckGrace -->|Yes| Accept
    CheckGrace -->|No| Warn[Warn User<br/>Require Online Check]
    Warn --> ConnectServer

    style Verify fill:#FFD700
    style CheckExpiry fill:#FFD700
    style ServerValidate fill:#FFD700
    style CheckGrace fill:#FFD700
    style Reject fill:#FF6B6B
    style Accept fill:#90EE90
```

### License Validation

- **Cryptographic Signatures**
  - License signed with private key
  - App validates with public key
  - Prevents license tampering

- **Extension Code Protection**
  - Core functionality can validate license
  - Obfuscation for sensitive code
  - Runtime license checks in critical paths

### Online Validation

- **Periodic Checks**
  - Validate license against server (e.g., daily)
  - Check for revoked licenses
  - Update extension availability

- **Offline Grace Period**
  - Allow X days of offline operation
  - Warn user when grace period expires
  - Require online validation after grace period

### Anti-Piracy Measures

- License tied to machine/user ID
- Online validation requirements
- License revocation capability
- Usage analytics (optional, privacy-conscious)

## Extension Decoupling Strategy

### Moving Features to Extensions

```mermaid
graph LR
    subgraph "Current State - Tightly Coupled"
        Core1[Core Application]
        Workbooks1[WorkbooksView Component]
        Icon1[Notebook Icon<br/>Hard-coded in Core]
        Core1 --> Workbooks1
        Workbooks1 --> Icon1
        style Icon1 fill:#FFB6C1
    end

    subgraph "Target State - Decoupled"
        Core2[Core Application]
        Registry[Extension Registry]
        JupyterExt[JupyterLab Extension]
        Icon2[Notebook Icon<br/>Contributed by Extension]
        Workbooks2[WorkbooksView Component<br/>Extension-Agnostic]

        Core2 --> Registry
        Registry --> JupyterExt
        JupyterExt --> Icon2
        Core2 --> Workbooks2
        Registry -.Renders.-> Icon2
        style Icon2 fill:#90EE90
        style Registry fill:#87CEEB
    end

    Current[Current] -.Migration.-> Target[Target]

    style Core1 fill:#FFB6C1
    style Core2 fill:#90EE90
```

**Current State:**
- Notebook creation icon in core WorkbooksView component
- Tightly coupled to core application

**Target State:**
- Notebook creation icon provided by JupyterLab extension
- Core app doesn't know about notebooks
- Extension contributes UI elements via extension registry

### Extension Contributions

```mermaid
graph TB
    subgraph "Core Application"
        Core[Core App<br/>Extension-Agnostic]
        Registry[Extension Registry]
    end

    subgraph "JupyterLab Extension"
        Jupyter[Jupyter Extension]
        JupyterFile[File Handler: .ipynb]
        JupyterButton[Toolbar Button:<br/>Create Notebook]
        JupyterMenu[Menu Item:<br/>New Notebook]
        Jupyter --> JupyterFile
        Jupyter --> JupyterButton
        Jupyter --> JupyterMenu
    end

    subgraph "BPMN Extension"
        BPMN[BPMN Extension]
        BPMNFile[File Handler: .bpmn]
        BPMNButton[Toolbar Button:<br/>New Process]
        BPMN --> BPMNFile
        BPMN --> BPMNButton
    end

    subgraph "Ontology Extension"
        Ontology[Ontology Extension]
        OntologyFile[File Handler: .owl]
        OntologyWidget[Sidebar Widget:<br/>Ontology Browser]
        Ontology --> OntologyFile
        Ontology --> OntologyWidget
    end

    Registry --> Jupyter
    Registry --> BPMN
    Registry --> Ontology

    Registry -.Renders.-> Core
    JupyterFile -.Handles.-> Core
    JupyterButton -.Appears in.-> Core
    BPMNFile -.Handles.-> Core
    BPMNButton -.Appears in.-> Core
    OntologyFile -.Handles.-> Core
    OntologyWidget -.Appears in.-> Core

    style Core fill:#87CEEB
    style Registry fill:#87CEEB
    style Jupyter fill:#FFD700
    style BPMN fill:#FFD700
    style Ontology fill:#FFD700
```

Extensions can contribute:

- **File Handlers** - Register file type handlers (`.ipynb`, `.bpmn`, etc.)
- **Toolbar Buttons** - Add buttons to toolbars
- **Menu Items** - Add items to context menus
- **Sidebar Widgets** - Add panels to sidebar
- **Command Palette** - Register commands

### Benefits of Decoupling

- **Modularity** - Each extension is self-contained
- **Flexibility** - Enable/disable features without code changes
- **Maintainability** - Easier to update individual extensions
- **Commercialization** - Clear boundaries for paid features

## Implementation Phases

```mermaid
gantt
    title Extension Licensing Implementation Timeline
    dateFormat YYYY-MM-DD
    section Phase 1: Foundation
    Extension Registry        :a1, 2025-02-01, 2w
    License Storage           :a2, after a1, 1w
    License Validation       :a3, after a2, 2w
    License Key Import        :a4, after a3, 1w

    section Phase 2: UI Integration
    Extension Manager UI      :b1, after a4, 2w
    License Status Display    :b2, after b1, 1w
    Upgrade Prompts          :b3, after b2, 1w

    section Phase 3: Commercial
    Purchase Flow            :c1, after b3, 2w
    Account Activation       :c2, after c1, 2w
    Trial Support            :c3, after c2, 1w

    section Phase 4: Migration
    Notebook Icon Migration  :d1, after c3, 1w
    Feature Decoupling       :d2, after d1, 2w
    Contribution System      :d3, after d2, 2w
```

### Phase 1: Foundation
- Extension registry with enable/disable capability
- License storage and validation system
- Basic license key import

### Phase 2: UI Integration
- Extension manager UI
- License status display
- Upgrade prompts for locked extensions

### Phase 3: Commercial Features
- Purchase flow integration
- Account-based activation (optional)
- Trial extension support

### Phase 4: Migration
- Move notebook icon to JupyterLab extension
- Decouple other features to extensions
- Full extension contribution system

## License File Format (Example)

```json
{
  "version": "1.0",
  "user_id": "user_12345",
  "account_id": "acc_67890",
  "issued_date": "2025-01-15",
  "expiration_date": null,
  "extensions": [
    "jupyter-lab",
    "ontology"
  ],
  "signature": "cryptographic_signature_here"
}
```

## Questions for Discussion

1. **License Delivery Method**
   - Prefer license key file, account-based, or hybrid?
   - How should licenses be delivered after purchase?

2. **Offline Capability**
   - How important is offline operation?
   - What grace period for offline validation?

3. **Trial Extensions**
   - Should we offer trial periods for premium extensions?
   - How long should trials last?

4. **Pricing Model**
   - Per-extension pricing or bundles?
   - One-time purchase or subscription?

5. **Multi-Device Support**
   - Should licenses work across multiple devices?
   - How many devices per license?

6. **Extension Decoupling Priority**
   - Which features should be moved to extensions first?
   - Timeline for decoupling existing features?

## Next Steps

1. Review and discuss this architecture with team
2. Decide on licensing approach (key file vs. account-based vs. hybrid)
3. Design license file format and validation system
4. Plan extension registry enhancements
5. Design Extension Manager UI
6. Create implementation timeline

---

*Document Version: 1.0*
*Last Updated: 2025-01-15*

