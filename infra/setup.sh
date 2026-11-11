#!/usr/bin/env bash
# HRMO — one-time link between this GitHub repository and an Azure subscription.
# Run in Azure Cloud Shell (https://shell.azure.com, Bash) as an owner of the subscription.
# It stores no password: GitHub signs in with a short-lived token that Azure accepts only from this repository's main branch.
#
#   bash setup.sh                     # defaults below
#   LOCATION=uaenorth bash setup.sh   # choose the data region
set -euo pipefail

REPO="${REPO:-Mahassira/HRMO}"            # owner/name exactly as shown on GitHub (case-sensitive)
BRANCH="${BRANCH:-main}"
RG="${RG:-hrmo-rg}"
LOCATION="${LOCATION:-westeurope}"        # region where the data will live
APP_NAME="${APP_NAME:-hrmo-github-deploy}"
SQL_GROUP="${SQL_GROUP:-HRMO SQL Admins}"

SUB=$(az account show --query id -o tsv)
TENANT=$(az account show --query tenantId -o tsv)
echo "Subscription: $SUB"
echo "Tenant:       $TENANT"

echo "1/6 Registering resource providers (first time can take a few minutes)…"
for ns in Microsoft.Web Microsoft.Sql Microsoft.Storage Microsoft.KeyVault Microsoft.Insights Microsoft.OperationalInsights; do
  az provider register --namespace "$ns" --wait >/dev/null
done

echo "2/6 Creating resource group $RG in $LOCATION…"
az group create --name "$RG" --location "$LOCATION" >/dev/null

echo "3/6 Creating the deployment identity…"
APP_ID=$(az ad app list --display-name "$APP_NAME" --query "[0].appId" -o tsv)
if [ -z "$APP_ID" ]; then APP_ID=$(az ad app create --display-name "$APP_NAME" --query appId -o tsv); fi
az ad sp show --id "$APP_ID" >/dev/null 2>&1 || az ad sp create --id "$APP_ID" >/dev/null
SP_ID=$(az ad sp show --id "$APP_ID" --query id -o tsv)

echo "4/6 Trusting GitHub ($REPO, branch $BRANCH)…"
if ! az ad app federated-credential list --id "$APP_ID" --query "[?name=='github-$BRANCH'] | [0].name" -o tsv | grep -q .; then
  az ad app federated-credential create --id "$APP_ID" --parameters "{
    \"name\": \"github-$BRANCH\",
    \"issuer\": \"https://token.actions.githubusercontent.com\",
    \"subject\": \"repo:$REPO:ref:refs/heads/$BRANCH\",
    \"audiences\": [\"api://AzureADTokenExchange\"]
  }" >/dev/null
fi

echo "5/6 Granting access to the resource group only…"
# Owner on this one resource group: the template also creates role assignments for the API's managed identity.
az role assignment create --assignee-object-id "$SP_ID" --assignee-principal-type ServicePrincipal \
  --role Owner --scope "/subscriptions/$SUB/resourceGroups/$RG" >/dev/null

echo "6/6 Creating the SQL administrators group…"
GROUP_ID=$(az ad group list --display-name "$SQL_GROUP" --query "[0].id" -o tsv)
if [ -z "$GROUP_ID" ]; then
  GROUP_ID=$(az ad group create --display-name "$SQL_GROUP" --mail-nickname "hrmo-sql-admins" --query id -o tsv)
fi
ME=$(az ad signed-in-user show --query id -o tsv)
az ad group member check --group "$GROUP_ID" --member-id "$ME" --query value -o tsv | grep -q true \
  || az ad group member add --group "$GROUP_ID" --member-id "$ME"

cat <<OUT

Done. Add these four repository variables in GitHub
(Settings → Secrets and variables → Actions → Variables → New repository variable):

  AZURE_CLIENT_ID        $APP_ID
  AZURE_TENANT_ID        $TENANT
  AZURE_SUBSCRIPTION_ID  $SUB
  SQL_ADMIN_GROUP_ID     $GROUP_ID

Then run the workflow: Actions → Deploy to Azure → Run workflow.
OUT
