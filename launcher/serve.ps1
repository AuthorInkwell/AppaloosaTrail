<#
    The Appaloosa Trail - local launcher.

    Serves the game folder over http://127.0.0.1 and opens it in a browser
    window. Deliberately dependency-free: it uses a raw TcpListener rather than
    HttpListener (which needs administrator rights on Windows) and nothing but
    what ships with Windows PowerShell 5.1, so there is nothing to install.

    Called by "Play The Appaloosa Trail.bat". Run it directly for options:
        powershell -ExecutionPolicy Bypass -File serve.ps1 -NoBrowser
#>

[CmdletBinding()]
param(
    # 0 means "pick the first free port from the list below".
    [int]$Port = 0,
    # Serve only; do not open a browser. Used by the automated tests.
    [switch]$NoBrowser,
    # Keep serving after the browser window closes.
    [switch]$StayOpen,
    # Root of the built game. Defaults to the "game" folder beside this script.
    [string]$Root,
    # Folder holding drop-in music. Defaults to "music" beside this script.
    [string]$MusicRoot
)

$ErrorActionPreference = 'Stop'

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$parent = Split-Path -Parent $here
if (-not $Root) { $Root = Join-Path $parent 'game' }
if (-not (Test-Path -LiteralPath $Root)) { $Root = $parent }
if (-not $MusicRoot) { $MusicRoot = Join-Path $parent 'music' }
$Root = (Resolve-Path -LiteralPath $Root).Path

$candidatePorts = @()
if ($Port -gt 0) { $candidatePorts += $Port }
$candidatePorts += 8731, 8732, 8733, 8734, 8735, 8760, 8761, 9731, 0

$mimeTypes = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.js'   = 'text/javascript; charset=utf-8'
    '.mjs'  = 'text/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.txt'  = 'text/plain; charset=utf-8'
    '.md'   = 'text/plain; charset=utf-8'
    '.svg'  = 'image/svg+xml'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.ico'  = 'image/x-icon'
    '.webp' = 'image/webp'
    '.mid'  = 'audio/midi'
    '.midi' = 'audio/midi'
    '.ogg'  = 'audio/ogg'
    '.mp3'  = 'audio/mpeg'
    '.wav'  = 'audio/wav'
    '.m4a'  = 'audio/mp4'
    '.woff' = 'font/woff'
    '.woff2' = 'font/woff2'
}

$musicExtensions = @('.mid', '.midi', '.ogg', '.mp3', '.wav', '.m4a')

function Get-MimeType([string]$path) {
    $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
    if ($mimeTypes.ContainsKey($ext)) { return $mimeTypes[$ext] }
    return 'application/octet-stream'
}

# The game asks for this to discover drop-in music. Building it live means a
# file copied into the music folder works on the next reload, with no rebuild.
function Get-MusicManifest {
    $files = @()
    if (Test-Path -LiteralPath $MusicRoot) {
        $found = Get-ChildItem -LiteralPath $MusicRoot -File -ErrorAction SilentlyContinue
        foreach ($f in $found) {
            if ($musicExtensions -contains $f.Extension.ToLowerInvariant()) { $files += $f.Name }
        }
    }
    $quoted = @()
    foreach ($name in ($files | Sort-Object)) {
        $quoted += '"' + ($name -replace '\\', '\\\\' -replace '"', '\"') + '"'
    }
    return '{"files":[' + ($quoted -join ',') + ']}'
}

function Resolve-RequestPath([string]$requestPath) {
    # Strip the query string and decode percent-escapes.
    $clean = $requestPath.Split('?')[0].Split('#')[0]
    try { $clean = [System.Uri]::UnescapeDataString($clean) } catch { }
    $clean = $clean -replace '/+', '/'
    if ($clean -eq '/' -or $clean -eq '') { $clean = '/index.html' }

    # Music lives beside the launcher rather than inside the game folder, so it
    # is somewhere a person can actually find it.
    $baseDir = $Root
    if ($clean.ToLowerInvariant().StartsWith('/music/')) {
        $baseDir = $MusicRoot
        $clean = $clean.Substring(6)
    }

    $relative = $clean.TrimStart('/')
    if ($relative -eq '') { return $null }
    if ($relative.Contains('..')) { return $null }
    $relative = $relative -replace '/', [System.IO.Path]::DirectorySeparatorChar

    $full = [System.IO.Path]::GetFullPath((Join-Path $baseDir $relative))
    $allowed = @($Root)
    if (Test-Path -LiteralPath $MusicRoot) { $allowed += (Resolve-Path -LiteralPath $MusicRoot).Path }
    foreach ($dir in $allowed) {
        if ($full.StartsWith($dir, [System.StringComparison]::OrdinalIgnoreCase)) { return $full }
    }
    return $null
}

function Read-RequestHead([System.Net.Sockets.NetworkStream]$stream) {
    $bytes = New-Object System.Collections.Generic.List[byte]
    $matched = 0
    # Read a byte at a time until the blank line that ends the headers. Request
    # heads are a few hundred bytes, so this is cheap and needs no buffering.
    while ($bytes.Count -lt 16384) {
        $b = $stream.ReadByte()
        if ($b -lt 0) { break }
        $bytes.Add([byte]$b)
        switch ($matched) {
            0 { if ($b -eq 13) { $matched = 1 } }
            1 { if ($b -eq 10) { $matched = 2 } else { $matched = 0 } }
            2 { if ($b -eq 13) { $matched = 3 } else { $matched = 0 } }
            3 { if ($b -eq 10) { $matched = 4 } else { $matched = 0 } }
        }
        if ($matched -eq 4) { break }
    }
    if ($bytes.Count -eq 0) { return $null }
    return [System.Text.Encoding]::ASCII.GetString($bytes.ToArray())
}

function Send-Response {
    param(
        [System.Net.Sockets.NetworkStream]$stream,
        [int]$status,
        [string]$statusText,
        [string]$contentType,
        [byte[]]$body,
        [bool]$headOnly
    )
    if ($null -eq $body) { $body = New-Object byte[] 0 }
    $head = "HTTP/1.1 $status $statusText`r`n"
    $head += "Content-Type: $contentType`r`n"
    $head += "Content-Length: $($body.Length)`r`n"
    $head += "Cache-Control: no-store`r`n"
    $head += "Connection: close`r`n`r`n"
    $headBytes = [System.Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($headBytes, 0, $headBytes.Length)
    if (-not $headOnly -and $body.Length -gt 0) { $stream.Write($body, 0, $body.Length) }
    $stream.Flush()
}

function Find-Browser {
    # Escape hatch for the automated launcher tests.
    if ($env:APPALOOSA_BROWSER -and (Test-Path -LiteralPath $env:APPALOOSA_BROWSER)) {
        return $env:APPALOOSA_BROWSER
    }
    $candidates = @()
    foreach ($base in @($env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:LOCALAPPDATA)) {
        if (-not $base) { continue }
        $candidates += (Join-Path $base 'Google\Chrome\Application\chrome.exe')
        $candidates += (Join-Path $base 'Microsoft\Edge\Application\msedge.exe')
        $candidates += (Join-Path $base 'BraveSoftware\Brave-Browser\Application\brave.exe')
    }
    foreach ($path in $candidates) {
        if ($path -and (Test-Path -LiteralPath $path)) { return $path }
    }
    return $null
}

# ---------------------------------------------------------------------------
# Start listening
# ---------------------------------------------------------------------------

$listener = $null
$boundPort = 0
foreach ($p in $candidatePorts) {
    $attempt = $null
    try {
        $attempt = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
        $attempt.Start()
        $listener = $attempt
        $boundPort = ([System.Net.IPEndPoint]$attempt.LocalEndpoint).Port
        break
    } catch {
        if ($null -ne $attempt) { try { $attempt.Stop() } catch { } }
    }
}

if (-not $listener) {
    Write-Host ''
    Write-Host '  Could not open a local port for the game.' -ForegroundColor Red
    Write-Host '  Something else may be using them all. Try restarting your computer.'
    Write-Host ''
    if (-not $NoBrowser) { Read-Host '  Press ENTER to close' }
    exit 1
}

$url = "http://127.0.0.1:$boundPort/"

Write-Host ''
Write-Host '   THE APPALOOSA TRAIL' -ForegroundColor Yellow
Write-Host '   ===================' -ForegroundColor DarkYellow
Write-Host ''
Write-Host "   The game is running at $url"
Write-Host ''
Write-Host '   Keep this window open while you play.' -ForegroundColor Green
Write-Host '   Closing it stops the game.' -ForegroundColor Green
Write-Host ''

$browserProcess = $null
$browserStarted = Get-Date
if (-not $NoBrowser) {
    $browser = Find-Browser
    if ($browser) {
        try {
            # A private profile folder means we always get our own window and our
            # own process to wait on, and it keeps saved journeys between runs.
            $profileBase = $env:LOCALAPPDATA
            if (-not $profileBase) { $profileBase = $parent }
            $profileDir = Join-Path $profileBase 'AppaloosaTrail-browser'
            $arguments = @(
                "--app=$url",
                "--user-data-dir=`"$profileDir`"",
                '--window-size=1300,900',
                '--no-first-run',
                '--no-default-browser-check'
            )
            $browserProcess = Start-Process -FilePath $browser -ArgumentList $arguments -PassThru
            $browserStarted = Get-Date
            Write-Host '   A game window should have opened. If it did not, open this' -ForegroundColor DarkGray
            Write-Host "   address in any browser: $url" -ForegroundColor DarkGray
        } catch {
            $browserProcess = $null
        }
    }
    if (-not $browserProcess) {
        try {
            Start-Process $url | Out-Null
            Write-Host '   Opened in your default browser.' -ForegroundColor DarkGray
        } catch {
            Write-Host "   Open this address in your browser: $url" -ForegroundColor DarkGray
        }
    }
    Write-Host ''
}

# ---------------------------------------------------------------------------
# Serve until the game window closes
# ---------------------------------------------------------------------------

$notFound = [System.Text.Encoding]::UTF8.GetBytes('Not found')
$running = $true
try {
    while ($running) {
        # Body of the accept loop; wrapped so an unexpected failure explains
        # itself instead of the window blinking out of existence.
        if (-not $listener.Pending()) {
            Start-Sleep -Milliseconds 20
            # When we launched the browser ourselves, closing its window ends
            # the session, so the player never has to think about this window.
            if ($browserProcess -and -not $StayOpen -and $browserProcess.HasExited) {
                $lifetime = (Get-Date) - $browserStarted
                if ($lifetime.TotalSeconds -lt 6) {
                    # It died on the spot, so it never really opened. Hand the
                    # job to the default browser and keep the game running.
                    $browserProcess = $null
                    Write-Host '   That browser would not start. Trying your default one instead.' -ForegroundColor DarkGray
                    try { Start-Process $url | Out-Null } catch { }
                } else {
                    $running = $false
                }
            }
            continue
        }

        $client = $listener.AcceptTcpClient()
        try {
            $client.ReceiveTimeout = 5000
            $client.SendTimeout = 15000
            $stream = $client.GetStream()
            $head = Read-RequestHead $stream
            if (-not $head) { continue }

            $requestLine = ($head -split "`r`n")[0]
            $parts = $requestLine -split ' '
            if ($parts.Count -lt 2) { continue }
            $method = $parts[0].ToUpperInvariant()
            $target = $parts[1]
            $headOnly = ($method -eq 'HEAD')

            if ($method -ne 'GET' -and $method -ne 'HEAD') {
                Send-Response $stream 405 'Method Not Allowed' 'text/plain' $notFound $false
                continue
            }

            $cleanTarget = $target.Split('?')[0].ToLowerInvariant()
            if ($cleanTarget -eq '/music/manifest.json') {
                $json = [System.Text.Encoding]::UTF8.GetBytes((Get-MusicManifest))
                Send-Response $stream 200 'OK' 'application/json; charset=utf-8' $json $headOnly
                continue
            }

            $file = Resolve-RequestPath $target
            if ($file -and (Test-Path -LiteralPath $file -PathType Leaf)) {
                $bytes = [System.IO.File]::ReadAllBytes($file)
                Send-Response $stream 200 'OK' (Get-MimeType $file) $bytes $headOnly
            } else {
                Send-Response $stream 404 'Not Found' 'text/plain; charset=utf-8' $notFound $headOnly
            }
        } catch {
            # A browser hanging up mid-request is normal; keep serving.
        } finally {
            try { $client.Close() } catch { }
        }
    }
} catch {
    Write-Host ''
    Write-Host '   Something went wrong while running the game:' -ForegroundColor Red
    Write-Host "   $($_.Exception.Message)"
    Write-Host ''
    Write-Host '   You can still play by opening game\index.html in a browser.'
    Write-Host ''
    if (-not $NoBrowser) { Read-Host '   Press ENTER to close' }
} finally {
    try { $listener.Stop() } catch { }
}

Write-Host '   Thanks for playing. Safe travels!' -ForegroundColor Yellow
Write-Host ''
Start-Sleep -Milliseconds 700
