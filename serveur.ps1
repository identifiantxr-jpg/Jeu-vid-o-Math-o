# Petit serveur web local pour tester le jeu (sert le dossier jeu/).
param([int]$Port = 8766, [string]$Root = "$PSScriptRoot\..\jeu")
$Root = (Resolve-Path $Root).Path
$types = @{ '.html'='text/html; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.js'='text/javascript; charset=utf-8';
            '.gltf'='model/gltf+json'; '.bin'='application/octet-stream'; '.png'='image/png'; '.jpg'='image/jpeg'; '.json'='application/json' }
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/"); $l.Prefixes.Add("http://127.0.0.1:$Port/")
$l.Start()
Write-Host "Serveur prêt sur http://localhost:$Port/ ($Root)"
while($l.IsListening){
  $ctx = $l.GetContext()
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
    if($rel -eq ''){ $rel = 'index.html' }
    $path = [IO.Path]::GetFullPath((Join-Path $Root $rel))
    if($path.StartsWith($Root) -and (Test-Path -LiteralPath $path -PathType Leaf)){
      $bytes = [IO.File]::ReadAllBytes($path)
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $ctx.Response.ContentType = if($types[$ext]){ $types[$ext] } else { 'application/octet-stream' }
      $ctx.Response.Headers.Add('Cache-Control','no-store')
      $ctx.Response.ContentLength64 = $bytes.Length
      if($ctx.Request.HttpMethod -ne 'HEAD'){ $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
      Write-Host "200 $rel"
    } else { $ctx.Response.StatusCode = 404; Write-Host "404 $rel" }
  } catch { Write-Host "ERR $_" } finally { $ctx.Response.Close() }
}
