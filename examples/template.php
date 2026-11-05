<?php
// Public configuration only. Never render API keys, partner tokens or client secrets.
// Replace with the active integration's public token: exactly 64 lowercase hex characters.
$integrationId = 'INTEGRATION_ID';
$bookingUrl = 'https://mybooking.space2book.com/bf/PUBLIC_ID/venue';
function escapeAttribute(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}
?>
<!doctype html>
<html lang="nl">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Boek bij onze locatie</title>
<link rel="stylesheet" href="../dist/space2book.min.css">
<script defer src="../dist/space2book.min.js"></script>
<body>
<a href="<?= escapeAttribute($bookingUrl) ?>" target="_blank" rel="noopener noreferrer">Boek direct</a>
<button type="button" data-s2b-mode="modal" data-s2b-integration="<?= escapeAttribute($integrationId) ?>" data-s2b-locale="nl">Boek in venster</button>
<div data-s2b-mode="inline" data-s2b-integration="<?= escapeAttribute($integrationId) ?>" data-s2b-locale="nl"></div>
</body>
</html>
