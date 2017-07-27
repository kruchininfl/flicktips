<?php
ini_set('display_errors', true);
error_reporting(E_ALL);

require_once('../src/wielski/KinopoiskApi/Kinopoisk.php');

$Kinopoisk = new \wielski\KinopoiskApi\Kinopoisk();
$film = $Kinopoisk->call('getFilm', [
  'filmID' => '714888'
  ]);

header('Content-Type: application/json');
echo $film;
