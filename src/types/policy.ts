// Policy Template Types for MSP Policy Deployment

export type BaselineType = 'cis' | 'nist' | 'hipaa' | 'iso27001' | 'iso27018' | 'soc2' | 'iso9001' | 'irap' | 'zero_trust' | 'microsoft_security' | 'custom';
export type DeploymentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'rolled_back';
export type TargetType = 'all' | 'customer' | 'group' | 'selected';

export interface PolicyTemplate {
  id: string;
  userId: string;
  name: string;
  description?: string;
  category: string;
  baselineType: BaselineType;
  policyData: Record<string, unknown>;
  resourceTypes: string[];
  isDefault: boolean;
  isActive: boolean;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyDeployment {
  id: string;
  userId: string;
  policyTemplateId: string;
  name: string;
  description?: string;
  targetType: TargetType;
  targetCustomerId?: string;
  targetGroupId?: string;
  targetTenantIds: string[];
  dryRun: boolean;
  status: DeploymentStatus;
  totalTenants: number;
  completedTenants: number;
  failedTenants: number;
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  // Joined data
  template?: PolicyTemplate;
}

export interface DeploymentResult {
  id: string;
  deploymentId: string;
  tenantConnectionId: string;
  status: DeploymentStatus;
  dryRunResult?: Record<string, unknown>;
  appliedChanges?: Record<string, unknown>;
  errorMessage?: string;
  rollbackData?: Record<string, unknown>;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  // Joined data
  tenantName?: string;
  tenantId?: string;
}

// Built-in baseline templates
export const BASELINE_TEMPLATES: Omit<PolicyTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'CIS Microsoft 365 Foundations Benchmark',
    description: 'Center for Internet Security benchmark for M365 security hardening',
    category: 'security',
    baselineType: 'cis',
    policyData: {
      conditionalAccess: {
        requireMFA: true,
        blockLegacyAuth: true,
        requireCompliantDevice: true,
        sessionTimeout: { enabled: true, hours: 12 },
      },
      intune: {
        requireEncryption: true,
        requireFirewall: true,
        requireAntivirus: true,
        minimumOsVersion: { windows: '10.0.19041', ios: '15.0', android: '12' },
        jailbreakDetection: true,
        screenLockRequired: true,
        passwordComplexity: { minLength: 12, requireUppercase: true, requireNumbers: true, requireSymbols: true },
      },
      exchange: {
        mailboxAuditEnabled: true,
        blockExternalForwarding: true,
        modernAuthRequired: true,
        spamFilteringEnabled: true,
      },
      sharepoint: {
        externalSharingRestricted: 'ExternalUserSharingOnly',
        anonymousLinkExpiration: 30,
        versioningEnabled: true,
      },
      defender: {
        realtimeProtection: true,
        cloudProtection: true,
        puaProtection: true,
        tamperProtection: true,
        asrRules: true,
      },
    },
    resourceTypes: ['conditional-access', 'intune', 'entra-id', 'exchange', 'sharepoint', 'defender'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'NIST Cybersecurity Framework',
    description: 'NIST CSF controls for Microsoft 365 environments',
    category: 'compliance',
    baselineType: 'nist',
    policyData: {
      identify: {
        assetInventory: true,
        riskAssessment: true,
        businessEnvironment: true,
      },
      protect: {
        accessControl: { mfaRequired: true, leastPrivilege: true, roleBasedAccess: true },
        dataProtection: { encryption: true, dlp: true, sensitivityLabels: true },
        informationProtection: { classification: true, retention: true },
        securityTraining: true,
      },
      detect: {
        anomalyDetection: true,
        continuousMonitoring: true,
        securityEventLogging: true,
      },
      respond: {
        incidentResponse: true,
        communicationPlan: true,
        analysisCapabilities: true,
        mitigationActivities: true,
      },
      recover: {
        recoveryPlanning: true,
        improvements: true,
        communications: true,
      },
    },
    resourceTypes: ['conditional-access', 'defender', 'entra-id', 'purview', 'exchange'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'HIPAA Security Rule',
    description: 'HIPAA-compliant security configurations for healthcare organizations',
    category: 'compliance',
    baselineType: 'hipaa',
    policyData: {
      accessControls: {
        uniqueUserIds: true,
        emergencyAccessProcedure: true,
        automaticLogoff: { enabled: true, timeoutMinutes: 15 },
        encryptionDecryption: true,
      },
      auditControls: {
        activityLogging: true,
        logReview: true,
        logRetention: { days: 365 },
        accessReporting: true,
      },
      integrityControls: {
        electronicDataIntegrity: true,
        versionControl: true,
        changeDetection: true,
      },
      transmissionSecurity: {
        encryptionInTransit: true,
        integrityControls: true,
      },
      deviceSecurity: {
        deviceEncryption: true,
        mobileDeviceManagement: true,
        remoteWipe: true,
      },
      conditionalAccess: {
        mfaRequired: true,
        compliantDeviceRequired: true,
        locationRestrictions: true,
        sessionTimeout: { enabled: true, hours: 8 },
      },
    },
    resourceTypes: ['conditional-access', 'purview', 'entra-id', 'intune', 'exchange'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'ISO 27001 Information Security',
    description: 'ISO 27001 ISMS controls for comprehensive information security management',
    category: 'compliance',
    baselineType: 'iso27001',
    policyData: {
      // A.5 Information Security Policies
      securityPolicies: {
        documented: true,
        reviewed: true,
        approved: true,
      },
      // A.6 Organization of Information Security
      organizationSecurity: {
        rolesResponsibilities: true,
        segregationOfDuties: true,
        contactWithAuthorities: true,
      },
      // A.9 Access Control
      accessControl: {
        accessControlPolicy: true,
        userRegistration: true,
        privilegedAccessManagement: true,
        secretAuthentication: { mfaRequired: true, passwordPolicy: { minLength: 14, complexity: true, expiry: 90 } },
        accessReview: { enabled: true, intervalDays: 90 },
      },
      // A.10 Cryptography
      cryptography: {
        encryptionPolicy: true,
        keyManagement: true,
        dataAtRestEncryption: true,
        dataInTransitEncryption: true,
      },
      // A.12 Operations Security
      operationsSecurity: {
        documentedProcedures: true,
        changeManagement: true,
        capacityManagement: true,
        malwareProtection: { enabled: true, realtimeScanning: true, cloudProtection: true },
        backup: { enabled: true, automated: true, encrypted: true },
        logging: { enabled: true, retention: 365, monitoring: true },
      },
      // A.13 Communications Security
      communicationsSecurity: {
        networkControls: true,
        networkSegmentation: true,
        informationTransfer: true,
      },
      // A.14 System Acquisition/Development
      systemDevelopment: {
        securityRequirements: true,
        secureDevEnvironments: true,
        securityTesting: true,
      },
      // A.15 Supplier Relationships
      supplierRelationships: {
        supplierSecurityPolicy: true,
        supplyChainSecurity: true,
        supplierMonitoring: true,
      },
      // A.16 Incident Management
      incidentManagement: {
        incidentResponse: true,
        incidentReporting: true,
        incidentLearning: true,
      },
      // A.17 Business Continuity
      businessContinuity: {
        continuityPlanning: true,
        redundancy: true,
      },
      // A.18 Compliance
      compliance: {
        legalRequirements: true,
        securityReviews: true,
        technicalCompliance: true,
      },
      conditionalAccess: {
        requireMFA: true,
        blockLegacyAuth: true,
        requireCompliantDevice: true,
        riskBasedAccess: true,
        locationRestrictions: true,
        sessionControls: { signInFrequency: 12, persistentBrowser: false },
      },
      intune: {
        deviceEncryption: true,
        firewallEnabled: true,
        antivirusEnabled: true,
        minimumOsVersion: true,
      },
    },
    resourceTypes: ['conditional-access', 'intune', 'entra-id', 'defender', 'exchange', 'sharepoint', 'purview'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'ISO 27018 Cloud Privacy',
    description: 'ISO 27018 PII protection controls for cloud services',
    category: 'compliance',
    baselineType: 'iso27018',
    policyData: {
      // 5.1 Consent and Choice
      consentAndChoice: {
        dataSubjectConsent: true,
        purposeLimitation: true,
        consentManagement: true,
      },
      // 5.2 Purpose Legitimacy
      purposeLegitimacy: {
        lawfulProcessing: true,
        purposeSpecification: true,
      },
      // 5.3 Collection Limitation
      collectionLimitation: {
        dataMinimization: true,
        relevantData: true,
      },
      // 5.4 Data Minimization
      dataMinimization: {
        limitedRetention: { enabled: true, reviewPeriod: 30 },
        necessaryProcessing: true,
      },
      // A.1 Secure Deletion
      secureDeletion: {
        temporaryFilesDeletion: true,
        secureErasure: true,
        deletionVerification: true,
      },
      // A.2 PII Transfer
      piiTransfer: {
        encryptionInTransit: true,
        transferLogging: true,
        thirdPartyAgreements: true,
      },
      // A.10 Data Location
      dataLocation: {
        geographicRestrictions: true,
        dataResidencyCompliance: true,
        subProcessorLocations: true,
      },
      // A.11 Subprocessor Management
      subprocessorManagement: {
        subprocessorList: true,
        contractualObligations: true,
        changeNotification: true,
      },
      conditionalAccess: {
        requireMFA: true,
        requireCompliantDevice: true,
        sessionTimeout: { enabled: true, hours: 8 },
      },
      dataProtection: {
        sensitivityLabels: true,
        dlpPolicies: true,
        encryptionEnforced: true,
        retentionPolicies: true,
      },
      auditLogging: {
        piiAccessLogging: true,
        dataExportLogging: true,
        adminActivityLogging: true,
        logRetention: { days: 365 },
      },
    },
    resourceTypes: ['conditional-access', 'purview', 'entra-id', 'sharepoint', 'exchange'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'SOC 2 Type II Trust Services',
    description: 'SOC 2 Trust Services Criteria for security, availability, processing integrity, confidentiality, and privacy',
    category: 'compliance',
    baselineType: 'soc2',
    policyData: {
      // CC1 - Control Environment
      controlEnvironment: {
        boardOversight: true,
        organizationalStructure: true,
        competenceCommitment: true,
        accountability: true,
      },
      // CC2 - Communication and Information
      communicationInformation: {
        internalCommunication: true,
        externalCommunication: true,
        securityAwareness: true,
      },
      // CC3 - Risk Assessment
      riskAssessment: {
        objectivesSetting: true,
        riskIdentification: true,
        fraudRiskAssessment: true,
        changeAnalysis: true,
      },
      // CC5 - Control Activities
      controlActivities: {
        policySelection: true,
        technologyControls: true,
        deploymentPolicies: true,
      },
      // CC6 - Logical and Physical Access
      logicalAccess: {
        accessSecurity: { mfaRequired: true, ssoEnabled: true },
        userProvisioning: { automatedProvisioning: true, accessReview: true },
        privilegedAccess: { justInTime: true, approval: true },
        authenticationMechanisms: { mfa: true, passwordless: false, certificateBased: false },
        accessRemoval: { automatedDeprovisioning: true, timely: true },
        accessRestriction: { roleBasedAccess: true, leastPrivilege: true },
      },
      // CC7 - System Operations
      systemOperations: {
        infrastructureMonitoring: true,
        securityEventDetection: { siem: true, alerting: true },
        incidentResponse: { plan: true, testing: true },
        recoveryProcedures: true,
      },
      // CC8 - Change Management
      changeManagement: {
        changeControl: true,
        changeApproval: true,
        changeTesting: true,
        emergencyChanges: true,
      },
      // CC9 - Risk Mitigation
      riskMitigation: {
        vendorManagement: true,
        businessDisruption: true,
      },
      // A1 - Availability
      availability: {
        capacityPlanning: true,
        environmentalProtection: true,
        dataBackup: { enabled: true, encrypted: true, tested: true },
        disasterRecovery: true,
      },
      // C1 - Confidentiality
      confidentiality: {
        dataClassification: true,
        encryptionControls: { atRest: true, inTransit: true },
        keyManagement: true,
        dataDisposal: true,
      },
      // PI1 - Processing Integrity
      processingIntegrity: {
        inputValidation: true,
        processingAccuracy: true,
        outputReview: true,
      },
      // P1 - Privacy
      privacy: {
        privacyNotice: true,
        consentManagement: true,
        dataSubjectRights: true,
        privacyByDesign: true,
      },
      conditionalAccess: {
        requireMFA: true,
        blockLegacyAuth: true,
        requireCompliantDevice: true,
        riskBasedAccess: true,
        sessionTimeout: { enabled: true, hours: 8 },
      },
      defender: {
        edrEnabled: true,
        automatedInvestigation: true,
        alertMonitoring: true,
      },
    },
    resourceTypes: ['conditional-access', 'entra-id', 'intune', 'defender', 'purview', 'exchange', 'sharepoint'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'ISO 9001 Quality Management',
    description: 'ISO 9001 quality management controls for IT service delivery',
    category: 'compliance',
    baselineType: 'iso9001',
    policyData: {
      // 4. Context of Organization
      organizationContext: {
        stakeholderNeeds: true,
        scopeDefinition: true,
      },
      // 5. Leadership
      leadership: {
        managementCommitment: true,
        qualityPolicy: true,
        rolesResponsibilities: true,
      },
      // 6. Planning
      planning: {
        riskAssessment: true,
        qualityObjectives: true,
        changeManagement: true,
      },
      // 7. Support
      support: {
        resourceManagement: true,
        competence: true,
        awareness: true,
        communication: true,
        documentedInformation: { versionControl: true, retention: true, approval: true },
      },
      // 8. Operation
      operation: {
        operationalPlanning: true,
        requirementsDetermination: true,
        designDevelopment: true,
        externalProvision: true,
        productionServiceProvision: true,
        releaseControl: true,
        nonconformingOutput: true,
      },
      // 9. Performance Evaluation
      performanceEvaluation: {
        monitoringMeasurement: true,
        internalAudit: true,
        managementReview: true,
      },
      // 10. Improvement
      improvement: {
        nonconformityCorrectiveAction: true,
        continualImprovement: true,
      },
      policyConfiguration: {
        documentedPolicies: true,
        policyVersioning: true,
        policyReviewSchedule: { enabled: true, intervalMonths: 6 },
        changeApproval: true,
      },
      auditLogging: {
        configurationChangeLogging: true,
        accessLogging: true,
        performanceMetrics: true,
      },
    },
    resourceTypes: ['intune', 'conditional-access', 'entra-id'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'IRAP PROTECTED Level',
    description: 'Australian Government IRAP assessment controls for PROTECTED classification',
    category: 'compliance',
    baselineType: 'irap',
    policyData: {
      // ISM Guidelines Sections
      governingCyberSecurity: {
        cyberSecurityRoles: true,
        cyberSecurityIncidents: true,
        riskManagement: true,
      },
      // Personnel Security
      personnelSecurity: {
        accessControl: true,
        securityAwareness: true,
        privilegedAccess: true,
      },
      // Information Security Documentation
      documentationSecurity: {
        documentClassification: true,
        documentHandling: true,
        documentRetention: true,
      },
      // Physical Security (for devices)
      physicalSecurity: {
        deviceEncryption: true,
        screenLock: true,
        deviceWipe: true,
      },
      // Communications Security
      communicationsSecurity: {
        encryptionInTransit: { enabled: true, minimumTls: '1.2' },
        networkSegmentation: true,
        emailSecurity: true,
      },
      // Access Control (ISM-0432)
      accessControl: {
        mfaRequired: { enabled: true, forAllUsers: true, forPrivileged: true },
        privilegedAccessManagement: { justInTime: true, approval: true, timeLimit: 8 },
        accessReview: { enabled: true, intervalDays: 90 },
        blockLegacyAuth: true,
        compliantDeviceRequired: true,
      },
      // Cryptographic Controls (ISM-0459)
      cryptographicControls: {
        encryptionAtRest: { enabled: true, algorithm: 'AES-256' },
        encryptionInTransit: { enabled: true, minimumTls: '1.2' },
        keyManagement: true,
      },
      // Data Sovereignty
      dataSovereignty: {
        australianDataResidency: true,
        geoRestrictions: { allowedRegions: ['Australia East', 'Australia Southeast'] },
        dataTransferRestrictions: true,
      },
      // Security Monitoring (ISM-0580)
      securityMonitoring: {
        eventLogging: { enabled: true, retention: 7 },
        securityEventMonitoring: true,
        alerting: true,
        incidentResponse: true,
      },
      // Malware Protection (ISM-1417)
      malwareProtection: {
        antivirusEnabled: true,
        realtimeProtection: true,
        cloudProtection: true,
        automatedScanning: true,
        asrRules: true,
      },
      // Patching (ISM-1143)
      patchManagement: {
        automaticUpdates: true,
        criticalPatchTimeline: { days: 48 },
        updateRings: true,
      },
      conditionalAccess: {
        requireMFA: true,
        blockLegacyAuth: true,
        requireCompliantDevice: true,
        riskBasedAccess: true,
        locationRestrictions: { enabled: true, trustedLocations: true },
        sessionTimeout: { enabled: true, hours: 8 },
      },
      intune: {
        deviceEncryption: true,
        firewallEnabled: true,
        antivirusEnabled: true,
        minimumOsVersion: true,
        jailbreakDetection: true,
        passwordComplexity: { minLength: 14, complexity: true },
      },
    },
    resourceTypes: ['conditional-access', 'intune', 'entra-id', 'defender', 'exchange', 'sharepoint', 'purview'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'Zero Trust Security Model',
    description: 'Microsoft Zero Trust implementation for M365',
    category: 'security',
    baselineType: 'zero_trust',
    policyData: {
      verifyExplicitly: {
        mfaRequired: true,
        deviceCompliance: true,
        riskBasedAccess: true,
        continuousAccessEvaluation: true,
        authenticationContext: true,
      },
      leastPrivilege: {
        justInTimeAccess: true,
        justEnoughAccess: true,
        privilegedAccessWorkstations: true,
        roleBasedAccessControl: true,
        accessReviews: { enabled: true, intervalDays: 30 },
      },
      assumeBreach: {
        microsegmentation: true,
        endToEndEncryption: true,
        threatDetection: true,
        lateralMovementPrevention: true,
        dataClassification: true,
      },
      conditionalAccess: {
        requireMFA: true,
        requireCompliantDevice: true,
        riskBasedPolicies: true,
        appProtectionPolicies: true,
        blockLegacyAuth: true,
        signInRiskPolicy: { enabled: true, threshold: 'medium' },
        userRiskPolicy: { enabled: true, threshold: 'medium' },
      },
      identityProtection: {
        mfaRegistration: true,
        passwordProtection: true,
        identityGovernance: true,
      },
      endpointSecurity: {
        defenderForEndpoint: true,
        attackSurfaceReduction: true,
        deviceCompliance: true,
      },
    },
    resourceTypes: ['conditional-access', 'defender', 'entra-id', 'intune'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'Microsoft Security Baseline',
    description: 'Microsoft recommended security configurations',
    category: 'security',
    baselineType: 'microsoft_security',
    policyData: {
      windows: {
        securityBaseline: true,
        defenderATP: true,
        credentialGuard: true,
        applicationGuard: true,
        bitLocker: true,
      },
      office: {
        macroSecurity: { level: 'DisableAllWithNotification' },
        protectedView: true,
        trustedDocuments: false,
        webExtensions: { restricted: true },
      },
      edge: {
        smartScreen: true,
        passwordMonitor: true,
        enhancedSecurityMode: true,
        trackingPrevention: 'Strict',
      },
      windows11Security: {
        tpm2Required: true,
        secureBootRequired: true,
        vbsEnabled: true,
      },
      defenderAntivirus: {
        realtimeProtection: true,
        cloudDeliveredProtection: true,
        automaticSampleSubmission: true,
        puaProtection: true,
        tamperProtection: true,
      },
      defenderFirewall: {
        domainProfile: true,
        privateProfile: true,
        publicProfile: true,
      },
    },
    resourceTypes: ['intune', 'defender'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
];

// Governance Action Templates - specific remediation policies
export const GOVERNANCE_ACTION_TEMPLATES: Omit<PolicyTemplate, 'id' | 'userId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'MFA Enforcement Policy',
    description: 'Enforce Multi-Factor Authentication for all users, with special focus on admin accounts',
    category: 'security',
    baselineType: 'microsoft_security',
    policyData: {
      conditionalAccess: {
        displayName: 'Require MFA for All Users',
        state: 'enabled',
        conditions: {
          users: {
            includeUsers: ['All'],
          },
          applications: {
            includeApplications: ['All'],
          },
          clientAppTypes: ['all'],
        },
        grantControls: {
          operator: 'OR',
          builtInControls: ['mfa'],
        },
      },
      adminMfaPolicy: {
        displayName: 'Require MFA for Administrators',
        state: 'enabled',
        conditions: {
          users: {
            includeRoles: [
              '62e90394-69f5-4237-9190-012177145e10', // Global Administrator
              'e8611ab8-c189-46e8-94e1-60213ab1f814', // Privileged Role Administrator
              '194ae4cb-b126-40b2-bd5b-6091b380977d', // Security Administrator
              'f28a1f50-f6e7-4571-818b-6a12f2af6b6c', // SharePoint Administrator
              '29232cdf-9323-42fd-ade2-1d097af3e4de', // Exchange Administrator
              'fe930be7-5e62-47db-91af-98c3a49a38b1', // User Administrator
            ],
          },
          applications: {
            includeApplications: ['All'],
          },
        },
        grantControls: {
          operator: 'OR',
          builtInControls: ['mfa'],
        },
        sessionControls: {
          signInFrequency: {
            value: 1,
            type: 'hours',
            isEnabled: true,
          },
        },
      },
      authenticationMethods: {
        microsoftAuthenticator: { enabled: true },
        fido2: { enabled: true },
        sms: { enabled: false },
        voiceCall: { enabled: false },
        email: { enabled: false },
      },
    },
    resourceTypes: ['conditionalAccessPolicies', 'authenticationMethodsPolicy'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'Block Legacy Authentication',
    description: 'Block legacy authentication protocols that bypass MFA and pose security risks',
    category: 'security',
    baselineType: 'microsoft_security',
    policyData: {
      conditionalAccess: {
        displayName: 'Block Legacy Authentication',
        state: 'enabled',
        conditions: {
          users: {
            includeUsers: ['All'],
          },
          applications: {
            includeApplications: ['All'],
          },
          clientAppTypes: ['exchangeActiveSync', 'other'],
        },
        grantControls: {
          operator: 'OR',
          builtInControls: ['block'],
        },
      },
      exchangeOnline: {
        modernAuthEnabled: true,
        basicAuthBlocked: {
          activesync: true,
          autodiscover: true,
          imap: true,
          mapi: true,
          offlineAddressBook: true,
          outlookService: true,
          pop: true,
          reportingWebServices: true,
          rpc: true,
          smtp: true,
          webServices: true,
          powershell: false,
        },
      },
    },
    resourceTypes: ['conditionalAccessPolicies', 'exchangeOnlineSettings'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'Conditional Access Baseline',
    description: 'Comprehensive Conditional Access policy baseline for secure access control',
    category: 'security',
    baselineType: 'zero_trust',
    policyData: {
      policies: [
        {
          displayName: 'Require MFA for All Users',
          state: 'enabled',
          conditions: {
            users: { includeUsers: ['All'] },
            applications: { includeApplications: ['All'] },
          },
          grantControls: {
            operator: 'OR',
            builtInControls: ['mfa'],
          },
        },
        {
          displayName: 'Block Legacy Authentication',
          state: 'enabled',
          conditions: {
            users: { includeUsers: ['All'] },
            applications: { includeApplications: ['All'] },
            clientAppTypes: ['exchangeActiveSync', 'other'],
          },
          grantControls: {
            operator: 'OR',
            builtInControls: ['block'],
          },
        },
        {
          displayName: 'Require Compliant Device',
          state: 'enabled',
          conditions: {
            users: { includeUsers: ['All'] },
            applications: { includeApplications: ['All'] },
            platforms: { includePlatforms: ['windows', 'macOS', 'iOS', 'android'] },
          },
          grantControls: {
            operator: 'AND',
            builtInControls: ['mfa', 'compliantDevice'],
          },
        },
        {
          displayName: 'Block High Risk Sign-Ins',
          state: 'enabled',
          conditions: {
            users: { includeUsers: ['All'] },
            applications: { includeApplications: ['All'] },
            signInRiskLevels: ['high'],
          },
          grantControls: {
            operator: 'OR',
            builtInControls: ['block'],
          },
        },
        {
          displayName: 'Require Password Change for High Risk Users',
          state: 'enabled',
          conditions: {
            users: { includeUsers: ['All'] },
            applications: { includeApplications: ['All'] },
            userRiskLevels: ['high'],
          },
          grantControls: {
            operator: 'AND',
            builtInControls: ['mfa', 'passwordChange'],
          },
        },
      ],
      sessionControls: {
        signInFrequency: {
          value: 12,
          type: 'hours',
          isEnabled: true,
        },
        persistentBrowser: {
          mode: 'never',
          isEnabled: true,
        },
      },
    },
    resourceTypes: ['conditionalAccessPolicies'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'Guest User Access Restriction',
    description: 'Restrict external guest user access and require additional verification',
    category: 'identity',
    baselineType: 'zero_trust',
    policyData: {
      conditionalAccess: {
        displayName: 'Restrict Guest Access',
        state: 'enabled',
        conditions: {
          users: {
            includeGuestsOrExternalUsers: {
              guestOrExternalUserTypes: 'b2bCollaborationGuest,b2bDirectConnectUser',
              externalTenants: { membershipKind: 'all' },
            },
          },
          applications: { includeApplications: ['All'] },
        },
        grantControls: {
          operator: 'AND',
          builtInControls: ['mfa', 'compliantDevice'],
        },
        sessionControls: {
          signInFrequency: {
            value: 1,
            type: 'hours',
            isEnabled: true,
          },
        },
      },
      guestUserSettings: {
        guestUserRoleId: '2af84b1e-32c8-42b7-82bc-daa82404023b', // Restricted Guest
        allowInvitesFrom: 'adminsAndGuestInviters',
        guestSelfServiceSignUp: false,
        allowEmailVerifiedUsersToJoinOrganization: false,
        collaborationRestrictions: {
          allowedDomains: [],
          blockedDomains: [],
        },
      },
      accessReview: {
        enabled: true,
        reviewInterval: 90,
        autoRemoveAccessOnDeny: true,
      },
    },
    resourceTypes: ['conditionalAccessPolicies', 'authorizationPolicy', 'accessReviews'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'Privileged Identity Management',
    description: 'Configure just-in-time privileged access for admin roles using PIM',
    category: 'identity',
    baselineType: 'zero_trust',
    policyData: {
      pimRoleSettings: {
        globalAdministrator: {
          activationMaximumDuration: 'PT8H',
          requireMfaOnActivation: true,
          requireJustification: true,
          requireApproval: true,
          requireTicketInfo: true,
          permanentEligibleAssignmentAllowed: false,
          expirationRule: {
            isExpirationRequired: true,
            maximumDuration: 'P365D',
          },
        },
        privilegedRoleAdministrator: {
          activationMaximumDuration: 'PT8H',
          requireMfaOnActivation: true,
          requireJustification: true,
          requireApproval: true,
        },
        securityAdministrator: {
          activationMaximumDuration: 'PT8H',
          requireMfaOnActivation: true,
          requireJustification: true,
        },
        exchangeAdministrator: {
          activationMaximumDuration: 'PT8H',
          requireMfaOnActivation: true,
          requireJustification: true,
        },
        sharepointAdministrator: {
          activationMaximumDuration: 'PT8H',
          requireMfaOnActivation: true,
          requireJustification: true,
        },
        userAdministrator: {
          activationMaximumDuration: 'PT8H',
          requireMfaOnActivation: true,
          requireJustification: true,
        },
      },
      accessReview: {
        enabled: true,
        reviewInterval: 30,
        reviewerType: 'Manager',
        autoRemoveAccessOnDeny: true,
      },
      alerts: {
        rolesBeingActivatedTooFrequently: true,
        adminElevatingAccessToSubscriptions: true,
        potentialStaleRoleAssignments: true,
        rolesNotRequiringMfa: true,
      },
    },
    resourceTypes: ['privilegedIdentityManagement', 'roleManagement'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
  {
    name: 'License Optimization Policy',
    description: 'Configure automated license reclamation and optimization rules',
    category: 'licensing',
    baselineType: 'custom',
    policyData: {
      licenseReclamation: {
        enabled: true,
        inactivityThresholdDays: 60,
        excludedUsers: [],
        excludedGroups: [],
        notifyBeforeReclaim: true,
        notifyDaysBefore: 14,
      },
      licenseDowngrade: {
        enabled: true,
        rules: [
          {
            name: 'E5 to E3 for Basic Users',
            fromSku: 'SPE_E5',
            toSku: 'SPE_E3',
            conditions: {
              noAdvancedSecurityUsage: true,
              noPowerBIProUsage: true,
              noAudioConferencingUsage: true,
            },
          },
          {
            name: 'E3 to F3 for Frontline Workers',
            fromSku: 'SPE_E3',
            toSku: 'SPE_F1',
            conditions: {
              userType: 'frontline',
              noDesktopAppsUsage: true,
            },
          },
        ],
      },
      reporting: {
        generateWeeklyReport: true,
        includeOptimizationSuggestions: true,
        includeCostSavings: true,
      },
    },
    resourceTypes: ['subscribedSkus', 'users', 'licenseDetails'],
    isDefault: true,
    isActive: true,
    version: 1,
  },
];

export const BASELINE_CONFIG: Record<BaselineType, { label: string; color: string; icon: string }> = {
  cis: { label: 'CIS', color: 'bg-blue-500/20 text-blue-400', icon: 'Shield' },
  nist: { label: 'NIST', color: 'bg-purple-500/20 text-purple-400', icon: 'FileCheck' },
  hipaa: { label: 'HIPAA', color: 'bg-pink-500/20 text-pink-400', icon: 'Heart' },
  iso27001: { label: 'ISO 27001', color: 'bg-green-500/20 text-green-400', icon: 'Globe' },
  iso27018: { label: 'ISO 27018', color: 'bg-teal-500/20 text-teal-400', icon: 'Cloud' },
  soc2: { label: 'SOC 2', color: 'bg-indigo-500/20 text-indigo-400', icon: 'Award' },
  iso9001: { label: 'ISO 9001', color: 'bg-emerald-500/20 text-emerald-400', icon: 'CheckCircle' },
  irap: { label: 'IRAP', color: 'bg-red-500/20 text-red-400', icon: 'Flag' },
  zero_trust: { label: 'Zero Trust', color: 'bg-orange-500/20 text-orange-400', icon: 'Lock' },
  microsoft_security: { label: 'Microsoft', color: 'bg-cyan-500/20 text-cyan-400', icon: 'Laptop' },
  custom: { label: 'Custom', color: 'bg-muted text-muted-foreground', icon: 'Settings' },
};

export const DEPLOYMENT_STATUS_CONFIG: Record<DeploymentStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-muted text-muted-foreground' },
  running: { label: 'Running', color: 'bg-primary/20 text-primary' },
  completed: { label: 'Completed', color: 'bg-success/20 text-success' },
  failed: { label: 'Failed', color: 'bg-destructive/20 text-destructive' },
  cancelled: { label: 'Cancelled', color: 'bg-warning/20 text-warning' },
  rolled_back: { label: 'Rolled Back', color: 'bg-orange-500/20 text-orange-400' },
};
