param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$Message
)

$ErrorActionPreference = "Stop"
$tag = "restore/refactor-estudos-$Name"

Write-Host "Running study domain tests..."
npm run test:study
if ($LASTEXITCODE -ne 0) {
    Write-Error "Tests failed. Restore point NOT created."
    exit 1
}

Write-Host "Running build..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Error "Build failed. Restore point NOT created."
    exit 1
}

Write-Host "Creating commit..."
git add -A
git commit -m $Message
if ($LASTEXITCODE -ne 0) {
    Write-Host "Nothing to commit or commit failed."
}

Write-Host "Creating tag $tag..."
git tag -a $tag -m $Message

Write-Host "Done. Tag: $tag"
Write-Host "Push with: git push origin main --tags"
