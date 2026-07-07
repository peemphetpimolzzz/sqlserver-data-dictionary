using './main.bicep'

param appName = 'sqldatadict'

// Name of the database the generator documents. Point this at an existing
// database with data (the tool documents whatever schema it connects to).
param databaseName = 'appdb'

// SQL admin credentials + deployer object ID. Supply at deploy time — do NOT
// commit real values:
//   -p sqlAdminPassword=$SQL_ADMIN_PASSWORD -p deployerObjectId=$(az ad signed-in-user show --query id -o tsv)
param sqlAdminLogin = 'sqladmin'
param sqlAdminPassword = readEnvironmentVariable('SQL_ADMIN_PASSWORD', '')
param deployerObjectId = readEnvironmentVariable('DEPLOYER_OBJECT_ID', '')
