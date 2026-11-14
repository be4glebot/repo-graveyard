param([string]$Tag, [string]$Place, [int]$W = 1440, [int]$Cols = 5, [int]$Tw = 380, [int]$Stride = 1)
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot "..\ux-polish"
$files = Get-ChildItem $dir -Filter "24-1-$Tag-travel-$Place-$W-*.jpg" | Sort-Object Name; $files = @($files | Where-Object { $true }); $files = for($k=0;$k -lt $files.Count;$k+=$Stride){ $files[$k] }
$first = [System.Drawing.Image]::FromFile($files[0].FullName)
$th = [int]($Tw * $first.Height / $first.Width)
$first.Dispose()
$rows = [math]::Ceiling($files.Count / $Cols)
$bmp = New-Object System.Drawing.Bitmap ($Cols * $Tw), ($rows * ($th + 16))
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.Clear([System.Drawing.Color]::Gray)
$font = New-Object System.Drawing.Font "Arial", 10
$i = 0
foreach ($f in $files) {
  $img = [System.Drawing.Image]::FromFile($f.FullName)
  $x = ($i % $Cols) * $Tw; $y = [math]::Floor($i / $Cols) * ($th + 16)
  $g.DrawImage($img, $x, $y + 16, $Tw - 2, $th)
  $g.DrawString(($f.BaseName -replace '.*-', '') + "ms", $font, [System.Drawing.Brushes]::Yellow, $x + 2, $y)
  $img.Dispose(); $i++
}
$out = Join-Path $dir "24-1-$Tag-sheet-$Place-$W.png"
$bmp.Save($out); $g.Dispose(); $bmp.Dispose()
Write-Output $out


