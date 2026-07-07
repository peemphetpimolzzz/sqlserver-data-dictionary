// SQL Server Data Dictionary — Azure infrastructure (deployment-ready).
//
// The generator is a batch tool, not a long-running service, so it runs as an
// Azure Container Apps *Job* (manual trigger). It reads a SQL database (an
// Azure SQL Database is provisioned here) and writes the Excel dictionary to an
// Azure Files share mounted at /app/output, so the artifact survives the run.
// The image is pulled from ACR with a user-assigned managed identity, and the
// database password is stored in Key Vault and surfaced as a referenced secret.
//
// Deploy:
//   az deployment group create -g <rg> -f infra/main.bicep -p infra/main.bicepparam
//
// See docs/deployment.md for the full walkthrough (identity, OIDC, running the job).

targetScope = 'resourceGroup'

@description('Base name used to derive resource names. Lowercase letters and numbers.')
@minLength(3)
@maxLength(18)
param appName string = 'sqldatadict'

@description('Azure region for all resources.')
param location string = resourceGroup().location

@description('Container image reference for the job. Leave as the placeholder for the first infra-only deploy; the deploy workflow updates it on each release.')
param jobImage string = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

@description('Azure SQL administrator login.')
param sqlAdminLogin string = 'sqladmin'

@description('Azure SQL administrator password.')
@secure()
param sqlAdminPassword string

@description('Name of the database the generator documents.')
param databaseName string = 'appdb'

@description('Object ID of the deploying user/service principal, granted Key Vault Secrets Officer so the password secret can be written.')
param deployerObjectId string

var suffix = uniqueString(resourceGroup().id, appName)
var acrName = toLower('${appName}acr${suffix}')
var kvName = take(toLower('${appName}kv${suffix}'), 24)
var saName = take(toLower('${appName}st${suffix}'), 24)
var sqlServerName = toLower('${appName}-sql-${suffix}')
var identityName = '${appName}-id'
var envName = '${appName}-cae'
var logName = '${appName}-logs'
var jobName = '${appName}-job'
var shareName = 'output'
var pwSecretName = 'sql-admin-password'

var acrPullRoleId = '7f951dda-4ed3-4680-a7ca-43fe172d538d'
var kvSecretsUserRoleId = '4633458b-17de-408a-b874-0445c86b69e6'
var kvSecretsOfficerRoleId = 'b86a8fe4-44ce-4948-aff5-f7d1c8c9a5a3'

resource identity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: identityName
  location: location
}

resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logName
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: acrName
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false
  }
}

resource acrPull 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(acr.id, identity.id, acrPullRoleId)
  scope: acr
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRoleId)
  }
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: kvName
  location: location
  properties: {
    sku: { family: 'A', name: 'standard' }
    tenantId: tenant().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
  }
}

resource kvSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, identity.id, kvSecretsUserRoleId)
  scope: keyVault
  properties: {
    principalId: identity.properties.principalId
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsUserRoleId)
  }
}

resource kvSecretsOfficer 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, deployerObjectId, kvSecretsOfficerRoleId)
  scope: keyVault
  properties: {
    principalId: deployerObjectId
    principalType: 'User'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', kvSecretsOfficerRoleId)
  }
}

resource pwSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: pwSecretName
  properties: {
    value: sqlAdminPassword
  }
  dependsOn: [
    kvSecretsOfficer
  ]
}

resource sqlServer 'Microsoft.Sql/servers@2023-08-01' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource sqlAllowAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01' = {
  parent: sqlServer
  name: 'AllowAllAzureIps'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

resource sqlDb 'Microsoft.Sql/servers/databases@2023-08-01' = {
  parent: sqlServer
  name: databaseName
  location: location
  sku: {
    name: 'GP_S_Gen5_1'
    tier: 'GeneralPurpose'
  }
  properties: {
    autoPauseDelay: 60
    minCapacity: json('0.5')
  }
}

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: saName
  location: location
  sku: { name: 'Standard_LRS' }
  kind: 'StorageV2'
  properties: {
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
  }
}

resource fileService 'Microsoft.Storage/storageAccounts/fileServices@2023-01-01' = {
  parent: storage
  name: 'default'
}

resource share 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-01-01' = {
  parent: fileService
  name: shareName
  properties: {
    shareQuota: 5
  }
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: envName
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
  }
}

resource envStorage 'Microsoft.App/managedEnvironments/storages@2024-03-01' = {
  parent: env
  name: shareName
  properties: {
    azureFile: {
      accountName: storage.name
      accountKey: storage.listKeys().keys[0].value
      shareName: share.name
      accessMode: 'ReadWrite'
    }
  }
}

resource job 'Microsoft.App/jobs@2024-03-01' = {
  name: jobName
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: {
      '${identity.id}': {}
    }
  }
  properties: {
    environmentId: env.id
    configuration: {
      triggerType: 'Manual'
      replicaTimeout: 1800
      replicaRetryLimit: 1
      manualTriggerConfig: {
        parallelism: 1
        replicaCompletionCount: 1
      }
      registries: [
        {
          server: acr.properties.loginServer
          identity: identity.id
        }
      ]
      secrets: [
        {
          name: pwSecretName
          keyVaultUrl: pwSecret.properties.secretUri
          identity: identity.id
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'generator'
          image: jobImage
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'DB_HOST', value: sqlServer.properties.fullyQualifiedDomainName }
            { name: 'DB_PORT', value: '1433' }
            { name: 'DB_USER', value: sqlAdminLogin }
            { name: 'DB_PASSWORD', secretRef: pwSecretName }
            { name: 'DB_NAME', value: databaseName }
            { name: 'OUTPUT_PATH', value: '/app/output/${databaseName}-data-dictionary.xlsx' }
          ]
          volumeMounts: [
            {
              volumeName: 'output'
              mountPath: '/app/output'
            }
          ]
        }
      ]
      volumes: [
        {
          name: 'output'
          storageType: 'AzureFile'
          storageName: envStorage.name
        }
      ]
    }
  }
  dependsOn: [
    acrPull
    kvSecretsUser
  ]
}

@description('Login server of the container registry (used by the deploy workflow).')
output acrLoginServer string = acr.properties.loginServer

@description('Name of the container registry.')
output acrName string = acr.name

@description('Name of the Container Apps job (used by the deploy workflow and to start runs).')
output jobName string = job.name

@description('Storage account holding the output file share.')
output storageAccount string = storage.name

@description('Azure SQL server FQDN the generator reads from.')
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
