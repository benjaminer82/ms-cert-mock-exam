# Deploy `ms-cert-mock-exam` to Azure App Service for Containers

This is a Vite SPA. The container is `nginx` serving the built static files on port **8080**.

## 0. Prerequisites

- Docker Desktop (for local build/test) **or** skip Docker locally and use `az acr build` (server-side build).
- Azure CLI logged in: `az login`
- Pick names & values (edit and reuse these in PowerShell):

```powershell
$RG       = "rg-mscert-exam"
$LOC      = "eastus"
$ACR      = "mscertexamacr$(Get-Random -Maximum 9999)"   # must be globally unique, lowercase letters+digits
$APP      = "ms-cert-exam-$(Get-Random -Maximum 9999)"   # globally unique
$PLAN     = "asp-mscert-exam"
$IMAGE    = "ms-cert-mock-exam"
$TAG      = "v1"
```

## 1. Create resource group + ACR

```powershell
az group create -n $RG -l $LOC
az acr create -g $RG -n $ACR --sku Basic --admin-enabled true
```

## 2. Build & push the image

**Option A — server-side build (no Docker needed locally):**
```powershell
az acr build -r $ACR -t "${IMAGE}:${TAG}" .
```

**Option B — local build, then push:**
```powershell
docker build -t "$ACR.azurecr.io/${IMAGE}:${TAG}" .
az acr login -n $ACR
docker push "$ACR.azurecr.io/${IMAGE}:${TAG}"
```

(Optional — test locally before pushing:)
```powershell
docker run --rm -p 8080:8080 "$ACR.azurecr.io/${IMAGE}:${TAG}"
# open http://localhost:8080
```

## 3. Create App Service (Linux, container)

```powershell
az appservice plan create -g $RG -n $PLAN --is-linux --sku B1
az webapp create -g $RG -p $PLAN -n $APP `
  --deployment-container-image-name "$ACR.azurecr.io/${IMAGE}:${TAG}"
```

## 4. Wire up ACR credentials + listen port

```powershell
$ACR_USER = az acr credential show -n $ACR --query username -o tsv
$ACR_PASS = az acr credential show -n $ACR --query "passwords[0].value" -o tsv

az webapp config container set -g $RG -n $APP `
  --container-image-name "$ACR.azurecr.io/${IMAGE}:${TAG}" `
  --container-registry-url "https://$ACR.azurecr.io" `
  --container-registry-user $ACR_USER `
  --container-registry-password $ACR_PASS

az webapp config appsettings set -g $RG -n $APP --settings `
  WEBSITES_PORT=8080 `
  WEBSITES_ENABLE_APP_SERVICE_STORAGE=false
```

## 5. Browse + verify

```powershell
az webapp show -g $RG -n $APP --query defaultHostName -o tsv
# https://<that-hostname>
```

## 6. Configure Azure OpenAI CORS (important)

The app calls AOAI **directly from the browser**, so the AOAI resource must allow your App Service origin.

```powershell
$AOAI_RG   = "<rg-of-aoai-resource>"
$AOAI_NAME = "<your-aoai-resource-name>"
$APP_URL   = "https://$(az webapp show -g $RG -n $APP --query defaultHostName -o tsv)"

# Append origin to AOAI CORS list
az rest --method patch `
  --url "https://management.azure.com/subscriptions/$(az account show --query id -o tsv)/resourceGroups/$AOAI_RG/providers/Microsoft.CognitiveServices/accounts/${AOAI_NAME}?api-version=2023-05-01" `
  --body (@{ properties = @{ networkAcls = @{}; apiProperties = @{ }; }; } | ConvertTo-Json -Depth 5)
```

Easier: **Azure Portal → your AOAI resource → "Resource Management" → "CORS"** → add `https://<app>.azurewebsites.net` → Save.

## 7. Updating the app later

```powershell
# Rebuild with a new tag and roll over:
$TAG = "v2"
az acr build -r $ACR -t "${IMAGE}:${TAG}" .
az webapp config container set -g $RG -n $APP `
  --container-image-name "$ACR.azurecr.io/${IMAGE}:${TAG}"
az webapp restart -g $RG -n $APP
```

## 8. Custom domain + HTTPS (optional)

```powershell
az webapp config hostname add -g $RG --webapp-name $APP --hostname app.example.com
az webapp config ssl create -g $RG --name $APP --hostname app.example.com   # managed cert
```

## Notes

- **Tier**: `B1` (~$13/mo) keeps the container warm 24/7. Free `F1` does **not** support custom containers.
- **Credentials & history**: AOAI keys and exam history live in the **browser's localStorage**, scoped per origin. Switching browsers/devices means re-entering settings — that's expected for a static SPA with no backend.
- **No secrets in image**: nothing sensitive is baked into the container.
- **Alternative**: Azure Container Apps (`az containerapp create`) — better for scale-to-zero, slightly more setup.
