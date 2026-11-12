# Linking GitHub to Azure (one time, about 10 minutes)

After this, every change merged into `main` is deployed to Azure automatically by the **Deploy to Azure** workflow. No password or key is stored in GitHub: Azure trusts short-lived tokens that come only from this repository's `main` branch, and the access is limited to one resource group.

## What you need

- An Azure subscription where you are **Owner**.
- Permission to create an app registration and a group in Microsoft Entra ID (the default for the account that created the tenant).
- Admin access to this GitHub repository.

## Steps

**1. Run the setup script in Azure.** Open <https://shell.azure.com>, choose **Bash**, and run:

```bash
curl -sL https://raw.githubusercontent.com/Mahassira/HRMO/main/infra/setup.sh -o setup.sh
LOCATION=westeurope bash setup.sh
```

Set `LOCATION` to the Azure region where the data must live. The script:

| Step | What it creates | Why |
|---|---|---|
| 1 | Registers resource providers | Lets the subscription create web, SQL, storage and monitoring resources |
| 2 | Resource group `hrmo-rg` | Everything HRMO lives here; deleting it removes everything |
| 3 | App registration `hrmo-github-deploy` | The identity GitHub uses |
| 4 | Federated credential | Azure accepts tokens only from `Mahassira/HRMO`, branch `main` |
| 5 | Owner role on `hrmo-rg` only | No access to anything else in the subscription |
| 6 | Group `HRMO SQL Admins`, with you as a member | The only people who can administer the database |

**2. Copy the four values it prints into GitHub.** In the repository: **Settings → Secrets and variables → Actions → Variables → New repository variable**.

| Name | Value |
|---|---|
| `AZURE_CLIENT_ID` | printed by the script |
| `AZURE_TENANT_ID` | printed by the script |
| `AZURE_SUBSCRIPTION_ID` | printed by the script |
| `SQL_ADMIN_GROUP_ID` | printed by the script |

These are identifiers, not secrets, so they go under **Variables**.

**3. Run the deployment.** **Actions → Deploy to Azure → Run workflow**. The first run takes about 5–10 minutes. The site address appears in the run summary.

**4. Create the database tables (first deployment only).** In the Azure portal open the SQL database `hrmo` → **Query editor**, sign in with your account, paste `db/schema.sql` and run it. Then run the two lines of step 0 in that file with the API app name from the run summary.

## Optional variables

| Name | Default | Use |
|---|---|---|
| `SWA_SKU` | `Standard` | `Free` for a zero-cost pilot (no SLA) |
| `SQL_SKU` | `Basic` | `S0` or `S1` if queries are slow |
| `AZURE_RESOURCE_GROUP` | `hrmo-rg` | Only if you changed `RG` in the script |

## If the run fails

| Message | Cause | Fix |
|---|---|---|
| `AADSTS70021` / no matching federated identity | Repository name or branch differs from the credential | Re-run the script with `REPO=owner/name` exactly as GitHub shows it |
| `AuthorizationFailed` | Role not yet propagated, or script not run as Owner | Wait a few minutes and re-run the workflow |
| `LocationNotAvailableForResourceType` | A service is not offered in the chosen region | Re-run the script with another `LOCATION` and a new `RG` |
| Job is skipped | Variables missing | Check step 2 |

## Removing everything

The database server, the storage account and the key vault carry delete locks, so deleting the resource group fails until the locks are removed. This is deliberate.

1. In the portal open each of the three resources → **Locks** → delete `hrmo-do-not-delete`.
2. Delete the resource group `hrmo-rg`. Billing stops here.
3. Delete the app registration `hrmo-github-deploy` and the group `HRMO SQL Admins`.

The key vault stays recoverable for 30 days after deletion (purge protection). For a pilot you will throw away, add the repository variable `PROTECT_FROM_DELETION` = `false` before the first run.

## Current state

The workflow deploys the infrastructure and the front end. The front end is still the demo with fictitious data until the API (phase 2) is deployed. This setup was written without access to an Azure subscription, so the first run is its first real test.
