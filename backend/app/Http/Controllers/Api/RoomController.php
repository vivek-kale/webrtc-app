<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class RoomController extends Controller
{
    public function create(Request $request)
    {
        return response()->json(['room_id' => rand(1000, 9999)]);
    }

    public function join(Request $request)
    {
        $room = $request->input('room');
        return response()->json(['room_id' => $room, 'message' => 'Joined']);
    }
}
