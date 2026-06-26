Add-Type -AssemblyName System.Drawing

$src = 'C:\Projects\mailApp-main\mailApp-main\electron\icon.png'
$dst = 'C:\Projects\mailApp-main\mailApp-main\electron\icon.ico'

# Load the image (works for both JPEG and PNG)
$srcImage = [System.Drawing.Image]::FromFile($src)

# Resize to 256x256 for the ICO
$size = 256
$bmp = New-Object System.Drawing.Bitmap($size, $size)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.DrawImage($srcImage, 0, 0, $size, $size)
$g.Dispose()
$srcImage.Dispose()

# Save as PNG to a temp file (ICO needs PNG or BMP data internally)
$tmpPng = [System.IO.Path]::GetTempFileName() + '.png'
$bmp.Save($tmpPng, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()

# Read PNG bytes
$pngBytes = [System.IO.File]::ReadAllBytes($tmpPng)
$pngLen = $pngBytes.Length

# Build ICO file manually:
# ICO header: 6 bytes (reserved=0, type=1, count=1)
# Image entry: 16 bytes (w, h, colorCount, reserved, planes, bitCount, sizeInBytes, offset)
# Then the PNG data

$header = [byte[]](0, 0, 1, 0, 1, 0)   # reserved, type=ICO, count=1

$entry = [byte[]](
    0,                          # width  (0 = 256)
    0,                          # height (0 = 256)
    0,                          # color count (0 = no palette)
    0,                          # reserved
    1, 0,                       # planes
    32, 0,                      # bit count
    ($pngLen -band 0xFF),       # size bytes 0
    (($pngLen -shr 8) -band 0xFF),   # size bytes 1
    (($pngLen -shr 16) -band 0xFF),  # size bytes 2
    (($pngLen -shr 24) -band 0xFF),  # size bytes 3
    22, 0, 0, 0                # offset: 6 (header) + 16 (entry) = 22
)

$fs = [System.IO.File]::OpenWrite($dst)
$fs.Write($header, 0, $header.Length)
$fs.Write($entry, 0, $entry.Length)
$fs.Write($pngBytes, 0, $pngBytes.Length)
$fs.Flush()
$fs.Close()

# Cleanup temp
Remove-Item $tmpPng -Force

$icoSize = (Get-Item $dst).Length
Write-Host "icon.ico created successfully: $icoSize bytes"
