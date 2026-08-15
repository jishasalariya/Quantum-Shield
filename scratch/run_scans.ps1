# Trigger scans for all 4 test files against the active dev server on port 3000

Write-Host "Starting audit scans..." -ForegroundColor Cyan

$files = @("vulnerable_python.py", "vulnerable_java.java", "vulnerable_cpp.cpp", "false_positive.py")

foreach ($file in $files) {
    Write-Host "`nScanning: $file" -ForegroundColor Yellow
    $code = Get-Content -Path "scratch/$file" -Raw
    
    # Pack payload
    $bodyObj = @{
        code = $code
        filename = $file
    }
    
    $bodyJson = $bodyObj | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/scan" -Method Post -Body $bodyJson -ContentType "application/json"
        $response | ConvertTo-Json -Depth 5 | Out-File -FilePath "scratch/result_$($file.replace('.', '_')).json"
        
        Write-Host "Status: Success" -ForegroundColor Green
        Write-Host "Vulnerabilities Count: $($response.riskAnalysis.findings.Count)"
        Write-Host "Risk Score: $($response.riskAnalysis.aggregateScore)"
        Write-Host "Risk Level: $($response.riskAnalysis.riskLevel)"
        if ($response.manualReview.Count -gt 0) {
            Write-Host "Manual Review Items: $($response.manualReview.Count)" -ForegroundColor DarkYellow
        }
    } catch {
        Write-Host "Error scanning $($file): $_" -ForegroundColor Red
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Server Response: $responseBody" -ForegroundColor Red
        }
    }
}
