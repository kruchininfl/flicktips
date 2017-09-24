<?php

namespace Services;

use ElephantIO\Client;
use ElephantIO\Engine\SocketIO\Version2X;

class Socket
{
    static function send($chanel, $data)
    {
        $client = new Client(new Version2X('http://localhost:3001'));
        $client->initialize();
        $client->emit('php-chanel-55e3a007b26c5adc2362edf6a50f18e6', [
            'chanel' => $chanel,
            'data' => $data
        ]);
        $client->close();
    }}