# Minimal local web server for the Student Access Portal (Windows, no installs needed).
$port = 8000
$root = [IO.Path]::GetFullPath($PSScriptRoot)
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try { $listener.Start() } catch { Write-Host "Port $port is busy. Close the other server window and try again."; Read-Host; exit 1 }
$types = @{ '.html'='text/html; charset=utf-8'; '.js'='application/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.csv'='text/csv; charset=utf-8'; '.md'='text/plain; charset=utf-8'; '.png'='image/png' }
Write-Host "Student Access Portal running at http://localhost:$port/"
Write-Host "Keep this window open while you use the portal. Close it to stop."
Start-Process "http://localhost:$port/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($rel -eq '') { $rel = 'index.html' }
  $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
  if ($full.StartsWith($root) -and (Test-Path -LiteralPath $full -PathType Leaf)) {
    $bytes = [IO.File]::ReadAllBytes($full)
    $type = $types[[IO.Path]::GetExtension($full).ToLower()]
    if ($type) { $ctx.Response.ContentType = $type }
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $ctx.Response.StatusCode = 404 }
  $ctx.Response.Close()
}
