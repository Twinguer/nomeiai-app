# Arquitetura do Sistema de Logging

## Diagrama de Componentes

```mermaid
graph TB
    subgraph "Frontend (React)"
        CL[ClientLogger]
        UI[UI Components]
        API[API Calls]
        ERR[Error Handler]
    end
    
    subgraph "Backend (Node.js/Express)"
        SL[ServerLogger]
        MW[LoggingMiddleware]
        CFG[LoggingConfig]
        DB[(Database)]
    end
    
    subgraph "File System"
        LS[logs/server/]
        LC[logs/client/]
        LE[logs/errors/]
        LA[logs/access/]
        LD[logs/debug/]
    end
    
    subgraph "External Tools"
        ELK[ELK Stack]
        SPLUNK[Splunk]
        DATADOG[Datadog]
        NEWRELIC[New Relic]
    end
    
    UI --> CL
    API --> CL
    ERR --> CL
    CL --> LC
    CL --> LE
    
    MW --> SL
    SL --> LS
    SL --> LE
    SL --> LA
    SL --> LD
    
    CFG --> SL
    CFG --> CL
    
    LS --> ELK
    LC --> ELK
    LE --> SPLUNK
    LA --> DATADOG
    LD --> NEWRELIC
```

## Fluxo de Dados

```mermaid
sequenceDiagram
    participant U as User
    participant UI as UI Component
    participant CL as ClientLogger
    participant API as API Call
    participant MW as LoggingMiddleware
    participant SL as ServerLogger
    participant FS as File System
    
    U->>UI: User Action
    UI->>CL: Log User Action
    CL->>FS: Write to logs/client/
    
    UI->>API: Make API Call
    API->>MW: HTTP Request
    MW->>SL: Log Request
    SL->>FS: Write to logs/access/
    
    API->>MW: HTTP Response
    MW->>SL: Log Response
    SL->>FS: Write to logs/server/
    
    Note over CL,FS: Client logs stored in memory
    Note over SL,FS: Server logs written to disk
```

## Estrutura de Logs

```mermaid
graph LR
    subgraph "Log Categories"
        A[Server Logs]
        B[Client Logs]
        C[Error Logs]
        D[Access Logs]
        E[Debug Logs]
    end
    
    subgraph "Log Levels"
        F[DEBUG]
        G[INFO]
        H[WARN]
        I[ERROR]
    end
    
    subgraph "File Rotation"
        J[Current File]
        K[File.1]
        L[File.2]
        M[File.3]
        N[File.4]
        O[File.5]
    end
    
    A --> F
    A --> G
    A --> H
    A --> I
    
    B --> F
    B --> G
    B --> H
    B --> I
    
    C --> H
    C --> I
    
    D --> G
    
    E --> F
    E --> G
    
    J --> K
    K --> L
    L --> M
    M --> N
    N --> O
```

## Configuração e Controle

```mermaid
graph TD
    subgraph "Environment Variables"
        EV1[ENABLE_LOGGING]
        EV2[LOG_LEVEL]
        EV3[CLIENT_LOG_LEVEL]
        EV4[ENABLE_CLIENT_LOGGING]
    end
    
    subgraph "Configuration"
        CFG[LoggingConfig]
        SEC[Security Settings]
        ROT[Rotation Settings]
    end
    
    subgraph "Logging Control"
        SL[ServerLogger]
        CL[ClientLogger]
        MW[Middleware]
    end
    
    EV1 --> CFG
    EV2 --> CFG
    EV3 --> CFG
    EV4 --> CFG
    
    CFG --> SEC
    CFG --> ROT
    
    SEC --> SL
    SEC --> CL
    ROT --> SL
    
    CFG --> MW
    MW --> SL
```

## Monitoramento e Alertas

```mermaid
graph TB
    subgraph "Log Sources"
        LS[Server Logs]
        LC[Client Logs]
        LE[Error Logs]
        LA[Access Logs]
    end
    
    subgraph "Metrics"
        M1[Error Rate]
        M2[Response Time]
        M3[User Activity]
        M4[Security Events]
    end
    
    subgraph "Alerts"
        A1[High Error Rate]
        A2[Slow Response]
        A3[Security Violations]
        A4[Disk Usage]
    end
    
    subgraph "Actions"
        ACT1[Send Notification]
        ACT2[Scale Resources]
        ACT3[Block IP]
        ACT4[Clean Logs]
    end
    
    LS --> M1
    LC --> M1
    LE --> M1
    
    LA --> M2
    LS --> M3
    LC --> M3
    
    LE --> M4
    
    M1 --> A1
    M2 --> A2
    M4 --> A3
    M1 --> A4
    
    A1 --> ACT1
    A2 --> ACT2
    A3 --> ACT3
    A4 --> ACT4
```

## Integração com Ferramentas Externas

```mermaid
graph LR
    subgraph "Log Files"
        LF1[logs/server/*.log]
        LF2[logs/client/*.log]
        LF3[logs/errors/*.log]
        LF4[logs/access/*.log]
    end
    
    subgraph "Log Forwarders"
        LF[Logstash]
        SF[Splunk Forwarder]
        DF[Datadog Agent]
        NF[New Relic Agent]
    end
    
    subgraph "Analysis Tools"
        ELK[ELK Stack]
        SPLUNK[Splunk]
        DATADOG[Datadog]
        NEWRELIC[New Relic]
    end
    
    LF1 --> LF
    LF2 --> LF
    LF3 --> SF
    LF4 --> DF
    
    LF --> ELK
    SF --> SPLUNK
    DF --> DATADOG
    NF --> NEWRELIC
```

## Segurança e Conformidade

```mermaid
graph TD
    subgraph "Data Protection"
        DP1[Sensitive Data Redaction]
        DP2[Access Control]
        DP3[Encryption]
        DP4[Audit Trail]
    end
    
    subgraph "Compliance"
        LGPD[LGPD/GDPR]
        SOX[SOX]
        HIPAA[HIPAA]
        PCI[PCI DSS]
    end
    
    subgraph "Security Features"
        SF1[Immutable Logs]
        SF2[Integrity Checks]
        SF3[Retention Policy]
        SF4[Access Logging]
    end
    
    DP1 --> LGPD
    DP2 --> SOX
    DP3 --> HIPAA
    DP4 --> PCI
    
    SF1 --> DP1
    SF2 --> DP2
    SF3 --> DP3
    SF4 --> DP4
```
