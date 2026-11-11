// HRMO — minimum-cost, secure Azure footprint. Deploy into the customer's own subscription.
// Usage: az deployment group create -g <rg> -f infra/main.bicep -p infra/main.parameters.json
targetScope = 'resourceGroup'

@description('Short name used as a prefix for all resources (3-11 lowercase letters/digits).')
@minLength(3)
@maxLength(11)
param name string = 'hrmo'

@description('Region for data resources. Choose the region required by the organisation\'s data-residency policy.')
param location string = resourceGroup().location

@description('Region for the Static Web App control plane (limited list of regions).')
@allowed(['westeurope', 'centralus', 'eastus2', 'eastasia', 'westus2'])
param staticWebAppLocation string = 'westeurope'

@description('Object ID of the Microsoft Entra group that administers the SQL server (e.g. "HRMO SQL Admins").')
param sqlAdminGroupObjectId string

@description('Display name of that Entra group.')
param sqlAdminGroupName string

@description('Static Web App plan. Standard gives an SLA, tenant-restricted sign-in and a linked backend.')
@allowed(['Standard', 'Free'])
param staticWebAppSku string = 'Standard'

@description('Azure SQL database SKU. Basic is the cheapest paid tier; move to S0/S1 if queries slow down.')
@allowed(['Basic', 'S0', 'S1'])
param sqlSku string = 'Basic'

var suffix = uniqueString(resourceGroup().id)
var tags = { app: 'hrmo' }

// ---------- Monitoring ----------
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: '${name}-logs-${suffix}'
  location: location
  tags: tags
  properties: { sku: { name: 'PerGB2018' }, retentionInDays: 30, workspaceCapping: { dailyQuotaGb: 1 } }
}

resource insights 'Microsoft.Insights/components@2020-02-02' = {
  name: '${name}-insights-${suffix}'
  location: location
  tags: tags
  kind: 'web'
  properties: { Application_Type: 'web', WorkspaceResourceId: logs.id }
}

// ---------- Storage (documents + function deployment package) ----------
resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: take('${name}st${suffix}', 24)
  location: location
  tags: tags
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: false
    allowSharedKeyAccess: false // identity-based access only: no account keys in app settings
    encryption: { services: { blob: { enabled: true } }, keySource: 'Microsoft.Storage' }
  }
  resource blob 'blobServices' = {
    name: 'default'
    properties: { deleteRetentionPolicy: { enabled: true, days: 14 }, isVersioningEnabled: true }
    resource documents 'containers' = { name: 'documents' }
    resource deployments 'containers' = { name: 'deployments' }
  }
}

// ---------- SQL (Entra-only authentication, no SQL passwords) ----------
resource sql 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: '${name}-sql-${suffix}'
  location: location
  tags: tags
  properties: {
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled' // restricted by the firewall rule below; see docs for the private-endpoint option
    administrators: {
      administratorType: 'ActiveDirectory'
      principalType: 'Group'
      login: sqlAdminGroupName
      sid: sqlAdminGroupObjectId
      tenantId: tenant().tenantId
      azureADOnlyAuthentication: true
    }
  }
  // Allows Azure-hosted services (the Function App) to reach the server. Authentication is still Entra-only.
  resource allowAzure 'firewallRules' = {
    name: 'AllowAllWindowsAzureIps'
    properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
  }
  resource audit 'auditingSettings' = {
    name: 'default'
    properties: { state: 'Enabled', isAzureMonitorTargetEnabled: true }
  }
}

resource db 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sql
  name: 'hrmo'
  location: location
  tags: tags
  sku: { name: sqlSku, tier: sqlSku == 'Basic' ? 'Basic' : 'Standard' }
  properties: { requestedBackupStorageRedundancy: 'Local' }
  // Transparent data encryption is on by default; declared so that drift is visible.
  resource tde 'transparentDataEncryption' = {
    name: 'current'
    properties: { state: 'Enabled' }
  }
}

// ---------- Key Vault (secrets for Graph / SMS; RBAC, soft delete) ----------
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: take('${name}-kv-${suffix}', 24)
  location: location
  tags: tags
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: tenant().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 30
    enablePurgeProtection: true
  }
}

// ---------- API: Function App on Flex Consumption with a managed identity ----------
resource plan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: '${name}-plan-${suffix}'
  location: location
  tags: tags
  kind: 'functionapp'
  sku: { name: 'FC1', tier: 'FlexConsumption' }
  properties: { reserved: true }
}

resource api 'Microsoft.Web/sites@2023-12-01' = {
  name: '${name}-api-${suffix}'
  location: location
  tags: tags
  kind: 'functionapp,linux'
  identity: { type: 'SystemAssigned' }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    functionAppConfig: {
      deployment: {
        storage: {
          type: 'blobContainer'
          value: '${storage.properties.primaryEndpoints.blob}deployments'
          authentication: { type: 'SystemAssignedIdentity' }
        }
      }
      scaleAndConcurrency: { maximumInstanceCount: 40, instanceMemoryMB: 2048 }
      runtime: { name: 'node', version: '22' }
    }
    siteConfig: {
      minTlsVersion: '1.2'
      appSettings: [
        { name: 'AzureWebJobsStorage__accountName', value: storage.name }
        { name: 'APPLICATIONINSIGHTS_CONNECTION_STRING', value: insights.properties.ConnectionString }
        { name: 'SQL_SERVER', value: sql.properties.fullyQualifiedDomainName }
        { name: 'SQL_DATABASE', value: db.name }
        { name: 'DOCUMENTS_ACCOUNT', value: storage.name }
        { name: 'KEY_VAULT_URI', value: vault.properties.vaultUri }
        { name: 'TENANT_ID', value: tenant().tenantId }
      ]
    }
  }
}

// Role assignments for the API identity (no keys or passwords anywhere).
var roles = {
  blobDataOwner: 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b'
  kvSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
}

resource apiBlob 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, api.id, roles.blobDataOwner)
  properties: {
    principalId: api.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.blobDataOwner)
  }
}

resource apiVault 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: vault
  name: guid(vault.id, api.id, roles.kvSecretsUser)
  properties: {
    principalId: api.identity.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.kvSecretsUser)
  }
}

// ---------- Front end: Static Web App, linked to the API ----------
resource web 'Microsoft.Web/staticSites@2023-12-01' = {
  name: '${name}-web-${suffix}'
  location: staticWebAppLocation
  tags: tags
  sku: { name: staticWebAppSku, tier: staticWebAppSku }
  properties: {}
}

resource link 'Microsoft.Web/staticSites/linkedBackends@2023-12-01' = if (staticWebAppSku == 'Standard') {
  parent: web
  name: 'api'
  properties: { backendResourceId: api.id, region: location }
}

output webName string = web.name
output webUrl string = 'https://${web.properties.defaultHostname}'
output apiName string = api.name
output sqlServer string = sql.properties.fullyQualifiedDomainName
output sqlDatabase string = db.name
output apiIdentityName string = api.name // use as the database user name in db/schema.sql step 0
