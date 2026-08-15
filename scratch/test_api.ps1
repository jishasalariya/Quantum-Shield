# Integration test for Quantum Shield API scan endpoint

# Load fnm env to make sure node/npm are in Path
fnm env --shell=powershell | Out-String | Invoke-Expression

# 1. Start the dev server in the background
Write-Host "Starting Next.js dev server..." -ForegroundColor Cyan
$serverJob = Start-Job -ScriptBlock {
    fnm env --shell=powershell | Out-String | Invoke-Expression
    npm run dev
}

# Wait for server to initialize
Write-Host "Waiting 8 seconds for server to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 8

$success = $true

try {
    # Test 1: Vulnerable Python File
    Write-Host "`n=== Test 1: Scanning Python vulnerability ===" -ForegroundColor Green
    $pyCode = Get-Content -Path "scratch/vulnerable_python.py" -Raw
    $body = @{
        code = $pyCode
        filename = "vulnerable_python.py"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/scan" -Method Post -Body $body -ContentType "application/json"
    $response | ConvertTo-Json -Depth 5 | Out-File -FilePath "scratch/result_python.json"
    Write-Host "Vulnerabilities found: $($response.riskAnalysis.findings.Count)"
    Write-Host "Aggregate Score: $($response.riskAnalysis.aggregateScore)"
    Write-Host "Risk Level: $($response.riskAnalysis.riskLevel)"

    # Test 2: Vulnerable Java File
    Write-Host "`n=== Test 2: Scanning Java vulnerability ===" -ForegroundColor Green
    $javaCode = Get-Content -Path "scratch/vulnerable_java.java" -Raw
    $body = @{
        code = $javaCode
        filename = "vulnerable_java.java"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/scan" -Method Post -Body $body -ContentType "application/json"
    $response | ConvertTo-Json -Depth 5 | Out-File -FilePath "scratch/result_java.json"
    Write-Host "Vulnerabilities found: $($response.riskAnalysis.findings.Count)"
    Write-Host "Aggregate Score: $($response.riskAnalysis.aggregateScore)"
    Write-Host "Risk Level: $($response.riskAnalysis.riskLevel)"

    # Test 3: Vulnerable C++ File
    Write-Host "`n=== Test 3: Scanning C++ vulnerability ===" -ForegroundColor Green
    $cppCode = Get-Content -Path "scratch/vulnerable_cpp.cpp" -Raw
    $body = @{
        code = $cppCode
        filename = "vulnerable_cpp.cpp"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/scan" -Method Post -Body $body -ContentType "application/json"
    $response | ConvertTo-Json -Depth 5 | Out-File -FilePath "scratch/result_cpp.json"
    Write-Host "Vulnerabilities found: $($response.riskAnalysis.findings.Count)"
    Write-Host "Aggregate Score: $($response.riskAnalysis.aggregateScore)"
    Write-Host "Risk Level: $($response.riskAnalysis.riskLevel)"

    # Test 4: False Positive Trap
    Write-Host "`n=== Test 4: Scanning False Positive Trap ===" -ForegroundColor Green
    $fpCode = Get-Content -Path "scratch/false_positive.py" -Raw
    $body = @{
        code = $fpCode
        filename = "false_positive.py"
    } | ConvertTo-Json

    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/scan" -Method Post -Body $body -ContentType "application/json"
    $response | ConvertTo-Json -Depth 5 | Out-File -FilePath "scratch/result_false_positive.json"
    Write-Host "Vulnerabilities found (expecting 0): $($response.riskAnalysis.findings.Count)"
    Write-Host "Manual Review found: $($response.manualReview.Count)"
    Write-Host "Risk Level: $($response.riskAnalysis.riskLevel)"

} catch {
    Write-Host "Error occurred during scan: $_" -ForegroundColor Red
    $success = $false
} finally {
    # 2. Stop the dev server job
    Write-Host "`nStopping dev server..." -ForegroundColor Cyan
    Stop-Job -Job $serverJob
    Remove-Job -Job $serverJob

    # Kill any dangling next-dev or node processes started by the job
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*next-dev*" -or $_.CommandLine -like "*next dev*" } | Stop-Process -Force -ErrorAction SilentlyContinue
}

if ($success) {
    Write-Host "`nAll scans completed. Results stored in scratch/result_*.json." -ForegroundColor Green
}
