# Deploying to Azure

The generator is a batch tool, so it runs as an **Azure Container Apps Job** (manual
trigger) rather than a long-running service. It reads a database (an **Azure SQL Database**
is provisioned here) and writes the Excel dictionary to an **Azure Files** share mounted at
`/app/output`, so the artifact survives the run. The image is pulled from **ACR** with a
**user-assigned managed identity**, and the SQL password is stored in **Key Vault** and
surfaced as a referenced secret. CI/CD authenticates with **OIDC federated credentials**,
so no long-lived cloud secret is stored in the repository.

```
GitHub Actions ──OIDC──▶ Azure          (workflow ships the image; you start the job)
      │
      ├─ az acr build ─────▶ ACR ──(mi pull)──▶ Container Apps Job (manual)
      └─ job update                                  │  reads ▼            writes ▼
                                            Azure SQL Database      Azure Files share (/app/output)
```

> Everything here is **deployment-ready** infrastructure-as-code. It has not been applied
> to a live subscription in this repository — follow the steps below to provision it in your
> own Azure account.

## Prerequisites

- Docker and git (the Azure CLI runs from a container — no host install needed).
- An Azure subscription and permission to create resource groups and role assignments.

```bash
az() { docker run --rm -it -v "$HOME/.azure:/root/.azure" mcr.microsoft.com/azure-cli az "$@"; }
az login
```

## 1. Provision the infrastructure

```bash
RG=sqlserver-data-dictionary-rg
LOCATION=southeastasia

az group create -n "$RG" -l "$LOCATION"

export SQL_ADMIN_PASSWORD='<a-strong-password>'
export DEPLOYER_OBJECT_ID="$(az ad signed-in-user show --query id -o tsv)"

az deployment group create \
  -g "$RG" \
  -f infra/main.bicep \
  -p infra/main.bicepparam \
  -p sqlAdminPassword="$SQL_ADMIN_PASSWORD" \
  -p deployerObjectId="$DEPLOYER_OBJECT_ID"
```

Outputs: `acrName`, `jobName`, `storageAccount`, `sqlServerFqdn`. Point `databaseName`
(a parameter) at a database that actually has data — the tool documents whatever schema it
connects to.

## 2. Wire up OIDC for GitHub Actions

```bash
APP_ID="$(az ad app create --display-name sqlserver-data-dictionary-deploy --query appId -o tsv)"
az ad sp create --id "$APP_ID"

az ad app federated-credential create --id "$APP_ID" --parameters '{
  "name": "github-main",
  "issuer": "https://token.actions.githubusercontent.com",
  "subject": "repo:peemphetpimolzzz/sqlserver-data-dictionary:ref:refs/heads/main",
  "audiences": ["api://AzureADTokenExchange"]
}'

SUB_ID="$(az account show --query id -o tsv)"
az role assignment create --assignee "$APP_ID" --role Contributor \
  --scope "/subscriptions/$SUB_ID/resourceGroups/$RG"
```

## 3. Configure the repository

**Settings → Secrets and variables → Actions**

| Kind | Name | Value |
|------|------|-------|
| Secret | `AZURE_CLIENT_ID` | the app registration's `appId` |
| Secret | `AZURE_TENANT_ID` | `az account show --query tenantId -o tsv` |
| Secret | `AZURE_SUBSCRIPTION_ID` | `az account show --query id -o tsv` |
| Variable | `AZURE_RESOURCE_GROUP` | `sqlserver-data-dictionary-rg` |
| Variable | `ACR_NAME` | ACR name from step 1 |
| Variable | `JOB_NAME` | job name from step 1 |

## 4. Ship the image and run the job

Run the **Deploy (Azure)** workflow from the Actions tab (it is `workflow_dispatch` only
until the secrets above are set; re-enable the `push` trigger in `deploy.yml` to ship on
every merge to `main`) to build and attach the image. Then start a run and collect the Excel
from the file share:

```bash
az containerapp job start --name "<jobName>" --resource-group "$RG"

# Download the generated dictionary from the Azure Files share
az storage file download \
  --account-name "<storageAccount>" \
  --share-name output \
  --path "appdb-data-dictionary.xlsx" \
  --dest ./appdb-data-dictionary.xlsx
```

## First-deploy & re-deploy notes

- **Key Vault RBAC propagation.** The template grants the deployer *Key Vault Secrets
  Officer* and writes the SQL password secret in the same deployment. If the first
  `az deployment group create` fails with a Key Vault `403 Forbidden` on the secret write
  (or the job cannot resolve the secret on its first run), the role assignment has not
  reached the data plane yet — wait a minute and re-run the same command; it is idempotent.
- **Re-deploying into the same resource group.** Key Vault names are deterministic and
  soft-delete is on, so after `az group delete` you must purge the vault before
  re-deploying within the retention window: `az keyvault purge --name <kvName>`.

## Known limitations

This is a portfolio template optimised for a one-command deploy, so one production concern
is deliberately traded for simplicity:

- **Azure SQL is on the public endpoint** with the "Allow Azure services" firewall rule, so
  the admin password is the only network barrier. The job only needs the Azure-internal
  Container Apps Job to reach SQL — in production, put the environment on a VNet, reach SQL
  through a **Private Endpoint** + private DNS zone, drop the `AllowAllAzureIps` rule, and
  set `publicNetworkAccess: 'Disabled'`.

## Teardown

```bash
az group delete -n "$RG" --yes --no-wait
```
