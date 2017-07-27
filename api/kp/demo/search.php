<?php
require_once('../src/wielski/KinopoiskApi/Kinopoisk.php');

$Kinopoisk = new \wielski\KinopoiskApi\Kinopoisk();
$films = $Kinopoisk->call('searchFilms', [
  'keyword' => 'побег'
  ]);

header('Content-Type: application/json');
echo $films;
