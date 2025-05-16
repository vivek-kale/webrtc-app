<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\RoomController;


// WebRTC API Routes - Use Controller
Route::post('/room/create', [RoomController::class, 'create']);
Route::post('/room/join', [RoomController::class, 'join']);

// Janus URL endpoint
Route::get('/janus-url', function () {
    return response()->json([
        'janus_url' => env('JANUS_URL')
    ]);
});