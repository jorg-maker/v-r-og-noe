$ErrorActionPreference = "Stop"

$certificate = New-SelfSignedCertificate `
    -Subject "CN=localhost" `
    -TextExtension @("2.5.29.17={text}DNS=localhost&IPAddress=127.0.0.1") `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -KeyExportPolicy Exportable `
    -KeySpec Signature `
    -HashAlgorithm SHA256 `
    -NotAfter (Get-Date).AddYears(2)

$certificatePath = Join-Path $PSScriptRoot "certs\localhost.pem"
$keyPath = Join-Path $PSScriptRoot "certs\localhost-key.pem"
$derPath = Join-Path $PSScriptRoot "certs\localhost.cer"
$certificateDirectory = Split-Path -Parent $certificatePath
New-Item -ItemType Directory -Path $certificateDirectory -Force | Out-Null

$rsa = $certificate.PrivateKey
if ($null -eq $rsa) {
    throw "Klarte ikke å hente den private nøkkelen fra sertifikatet."
}

$rsaPemEncoder = @"
using System;
using System.Collections.Generic;
using System.Security.Cryptography;

public static class RsaPemEncoder
{
    private static byte[] EncodeLength(int length)
    {
        if (length < 128)
        {
            return new byte[] { (byte)length };
        }

        var bytes = new List<byte>();
        while (length > 0)
        {
            bytes.Insert(0, (byte)(length & 255));
            length >>= 8;
        }

        bytes.Insert(0, (byte)(128 | bytes.Count));
        return bytes.ToArray();
    }

    private static byte[] EncodeInteger(byte[] value)
    {
        int first = 0;
        while (first < value.Length - 1 && value[first] == 0)
        {
            first++;
        }

        int prefix = (value[first] & 128) == 128 ? 1 : 0;
        var content = new byte[value.Length - first + prefix];
        Buffer.BlockCopy(value, first, content, prefix, value.Length - first);
        var result = new List<byte> { 2 };
        result.AddRange(EncodeLength(content.Length));
        result.AddRange(content);
        return result.ToArray();
    }

    public static byte[] Encode(RSAParameters parameters)
    {
        var content = new List<byte>();
        content.AddRange(EncodeInteger(new byte[] { 0 }));
        content.AddRange(EncodeInteger(parameters.Modulus));
        content.AddRange(EncodeInteger(parameters.Exponent));
        content.AddRange(EncodeInteger(parameters.D));
        content.AddRange(EncodeInteger(parameters.P));
        content.AddRange(EncodeInteger(parameters.Q));
        content.AddRange(EncodeInteger(parameters.DP));
        content.AddRange(EncodeInteger(parameters.DQ));
        content.AddRange(EncodeInteger(parameters.InverseQ));

        var sequence = new List<byte> { 48 };
        sequence.AddRange(EncodeLength(content.Count));
        sequence.AddRange(content);
        return sequence.ToArray();
    }
}
"@
Add-Type -TypeDefinition $rsaPemEncoder

function Write-PemFile {
    param(
        [string]$Path,
        [string]$Label,
        [byte[]]$Bytes
    )

    $base64 = [Convert]::ToBase64String($Bytes, [Base64FormattingOptions]::InsertLineBreaks)
    $pem = "-----BEGIN $Label-----`n$base64`n-----END $Label-----`n"
    [System.IO.File]::WriteAllText($Path, $pem, [System.Text.Encoding]::ASCII)
}

$privateKey = $rsa.ExportParameters($true)
Write-PemFile -Path $keyPath -Label "RSA PRIVATE KEY" -Bytes ([RsaPemEncoder]::Encode($privateKey))
Write-PemFile -Path $certificatePath -Label "CERTIFICATE" -Bytes $certificate.RawData
[System.IO.File]::WriteAllBytes($derPath, $certificate.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert))
Import-Certificate -FilePath $derPath -CertStoreLocation "Cert:\CurrentUser\Root" | Out-Null
Remove-Item -LiteralPath $derPath
Remove-Item -LiteralPath "Cert:\CurrentUser\My\$($certificate.Thumbprint)"

Write-Output "HTTPS-sertifikatet er klart. Start nettsiden med: python app.py"
Write-Output "Åpne https://localhost:8000"
Write-Output "Sertifikatets fingeravtrykk: $($certificate.Thumbprint)"
