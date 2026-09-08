Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  DDT ê°œë°œ ?˜ê²½ ?‹ì—…" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

if (-not (Get-Command conda -ErrorAction SilentlyContinue)) {
    Write-Host "?“¦ Condaê°€ ?¤ì¹˜?˜ì–´ ?ˆì? ?ŠìŠµ?ˆë‹¤. ?ë™ ?¤ì¹˜ë¥?ì§„í–‰?©ë‹ˆ??.." -ForegroundColor Yellow
    Write-Host "Windows??Miniconda ?¤ìš´ë¡œë“œ ì¤?.."
    
    $minicondaUrl = "https://repo.anaconda.com/miniconda/Miniconda3-latest-Windows-x86_64.exe"
    Invoke-WebRequest -Uri $minicondaUrl -OutFile "miniconda.exe"
    
    Write-Host "Miniconda ?¤ì¹˜ ì¤?(??1~2ë¶??Œìš”)..."
    $installDir = Join-Path $env:USERPROFILE "miniconda3"
    $argsList = "/InstallationType=JustMe /RegisterPython=0 /AddToPath=0 /S /D=$installDir"
    
    Start-Process -FilePath ".\miniconda.exe" -ArgumentList $argsList -Wait -NoNewWindow
    Remove-Item ".\miniconda.exe" -Force
    
    # PATH ?˜ê²½ ë³€?˜ì— ì¶”ê?
    $env:PATH = "$installDir\Scripts;$installDir\condabin;$installDir;" + $env:PATH
    
    # PowerShell??ì´ˆê¸°??(?ëŸ¬ ë¬´ì‹œ)
    & "$installDir\Scripts\conda.exe" init powershell | Out-Null
    
    Write-Host "??Conda ?ë™ ?¤ì¹˜ ?„ë£Œ!" -ForegroundColor Green
    Write-Host "? ï¸ ì§€ê¸?ë°”ë¡œ ?˜ê²½???ìš©?˜ë ¤ë©??°ë??ì— ?„ë˜ ëª…ë ¹?´ë? ?¤í–‰?˜ê±°??ê»ë‹¤ ì¼œì£¼?¸ìš”:" -ForegroundColor Yellow
    Write-Host "   . `$PROFILE"
    Write-Host "?ìš© ??ë³??¤í¬ë¦½íŠ¸ë¥??¤ì‹œ ?¤í–‰??ì£¼ì„¸??" -ForegroundColor Yellow
    exit 0
}
Write-Host "??conda ì¤€ë¹„ë¨" -ForegroundColor Green

Write-Host "?“œ Conda ì±„ë„ ToS ?ë™ ?™ì˜ ì²˜ë¦¬ ì¤?.." -ForegroundColor Yellow
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main 2>$null
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r 2>$null
conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/msys2 2>$null

$envList = conda env list 2>&1 | Out-String
if ($envList -match "^ddt\s") {
    Write-Host "?“¦ conda ?˜ê²½ 'ddt' ?…ë°?´íŠ¸ ì¤?.." -ForegroundColor Yellow
    conda env update -f environment.yml --prune
} else {
    Write-Host "?“¦ conda ?˜ê²½ 'ddt' ?ì„± ì¤?.." -ForegroundColor Yellow
    conda env create -f environment.yml
}

Write-Host ""
Write-Host "? ï¸  conda ?˜ê²½???œì„±?”í•˜?¸ìš”:" -ForegroundColor Yellow
Write-Host "   conda activate ddt"
Write-Host ""

if ($env:CONDA_DEFAULT_ENV -ne "ddt") {
    Write-Host "?„ì¬ conda ?˜ê²½??'ddt'ê°€ ?„ë‹™?ˆë‹¤. ?œì„±?????¤ì‹œ ?¤í–‰?´ì£¼?¸ìš”." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "?“¦ Skaffold ?¤ì¹˜ ?•ì¸ ì¤?.." -ForegroundColor Yellow
if (-not (Get-Command skaffold -ErrorAction SilentlyContinue)) {
    Write-Host "Windows??Skaffold ë°”ì´?ˆë¦¬ë¥??¤ìš´ë¡œë“œ?©ë‹ˆ??"
    $skaffoldUrl = "https://storage.googleapis.com/skaffold/releases/latest/skaffold-windows-amd64.exe"
    $binDir = Join-Path $HOME "bin"
    if (-not (Test-Path $binDir)) {
        New-Item -ItemType Directory -Path $binDir | Out-Null
    }
    $skaffoldPath = Join-Path $binDir "skaffold.exe"
    Invoke-WebRequest -Uri $skaffoldUrl -OutFile $skaffoldPath
    Write-Host "? ï¸ PATH ?˜ê²½ ë³€?˜ì— $binDir ê²½ë¡œë¥?ì¶”ê??´ì£¼?¸ìš”." -ForegroundColor Yellow
    $env:PATH = "$binDir;" + $env:PATH
    Write-Host "??Skaffold ?¤ì¹˜ ?„ë£Œ" -ForegroundColor Green
} else {
    Write-Host "??Skaffold ?´ë? ?¤ì¹˜??" -ForegroundColor Green
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "??Dockerê°€ ?¤ì¹˜?˜ì–´ ?ˆì? ?ŠìŠµ?ˆë‹¤." -ForegroundColor Red
    exit 1
}
Write-Host "??Docker ?¤ì¹˜?? -ForegroundColor Green

Write-Host ""
Write-Host "?“¦ ???˜ì¡´???¤ì¹˜ ì¤?.."
Push-Location portal
pnpm install
Pop-Location

Write-Host ""
Write-Host "?“¦ MCP Server ?˜ì¡´???¤ì¹˜ ì¤?.."
Push-Location mcp-server
pnpm install
Pop-Location

Write-Host ""
Write-Host "?“¦ SDLC Pod Runner ?˜ì¡´???¤ì¹˜ ì¤?.."
Push-Location sdlc-pod-runner
npm install
Pop-Location

Write-Host ""
Write-Host "?“¦ Prisma ?´ë¼?´ì–¸???ì„± ì¤?.."
Push-Location portal
pnpm db:generate
Pop-Location

Write-Host ""
Write-Host "?”§ Husky git hooks ?¤ì • ì¤?.."
Push-Location portal
pnpm exec husky init 2>$null
Set-Content -Path ".husky/pre-commit" -Value "pnpm --dir portal exec lint-staged" -NoNewline
Set-Content -Path ".husky/commit-msg" -Value 'pnpm --dir portal exec commitlint --edit $1' -NoNewline
Pop-Location

if (-not (Test-Path "portal/.env")) {
    Copy-Item "portal/.env.example" "portal/.env"
    Write-Host "?“ portal/.env ?Œì¼???ì„±?˜ì—ˆ?µë‹ˆ?? GitHub OAuth ?¤ì •???…ë ¥?´ì£¼?¸ìš”." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "?™ï¸  kubectl ?ë™ ?„ì„±autocompletion ?¤ì • ì¤?.." -ForegroundColor Yellow

if (Get-Command kubectl -ErrorAction SilentlyContinue) {
    if (-not (Test-Path $PROFILE)) {
        New-Item -ItemType File -Path $PROFILE -Force | Out-Null
    }
    $content = Get-Content $PROFILE -ErrorAction SilentlyContinue
    if (-not ($content -match "kubectl completion powershell")) {
        # '&' ´ë½Å 'and'¸¦ »ç¿ëÇÏ¿© Æ¯¼ö ±âÈ£ ¿À·ù ¿øÃµ Â÷´Ü
        Add-Content -Path $PROFILE -Value "`n# kubectl autocompletion and alias"
        Add-Content -Path $PROFILE -Value "kubectl completion powershell | Out-String | Invoke-Expression"
        Add-Content -Path $PROFILE -Value "Set-Alias -Name k -Value kubectl"
    }
    Write-Host "???°ë????¬ì‹œ????kubectl ?ë™ ?„ì„±???ìš©?©ë‹ˆ??" -ForegroundColor Green
} else {
    Write-Host "??kubectl??ì°¾ì„ ???†ì–´ ?ë™ ?„ì„± ?¤ì •??ê±´ë„ˆ?ë‹ˆ??" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "?‰ ?‹ì—… ?„ë£Œ!" -ForegroundColor Green
Write-Host ""
Write-Host "ê°œë°œ ?˜ê²½ ?œì‘:"
Write-Host "  conda activate ddt"
Write-Host "  skaffold dev"
Write-Host ""
Write-Host "?‘ì† ì£¼ì†Œ:"
Write-Host "  App:        http://localhost:3000"
Write-Host "  n8n:        http://localhost:5678"
Write-Host "  MCP:        http://localhost:3001"
Write-Host "  PostgreSQL: localhost:5432"
Write-Host "  Minio S3: http://localhost:9001 API: 9000"
Write-Host "============================================"" -ForegroundColor Cyan