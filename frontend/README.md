# WebRTC Video Application

A real-time video communication application built with React and Laravel, using the Janus WebRTC Server for video streaming.

## Project Structure

The application consists of two main components:
- **Frontend**: React application for the user interface
- **Backend**: Laravel application for API endpoints and server-side logic

## Prerequisites

- [Node.js](https://nodejs.org/) (v14 or higher)
- [PHP](https://www.php.net/) (v8.0 or higher)
- [Composer](https://getcomposer.org/)
- [XAMPP](https://www.apachefriends.org/) or similar local development environment
- [Janus WebRTC Server](https://janus.conf.meetecho.com/docs/) instance (self-hosted or cloud)

## Installation

### Backend Setup

1. Navigate to the backend directory:
cd backend

2. Install PHP dependencies:
composer install

3. Create environment file:
cp .env.example .env

4. Generate application key:
php artisan key:generate

6. Add your Janus WebRTC server URL to the `.env` file:
JANUS_URL=https://dev-live-cast-wrtc.transperfect.com:8089/janus


### Frontend Setup

1. Navigate to the frontend directory:
cd frontend

2. Install Node.js dependencies:
npm install

## Running the Application

### Start the Backend Server

1. Navigate to the backend directory:
cd backend

2. Start the Laravel development server:
php artisan serve

This will start the server at http://localhost:8000

### Start the Frontend Development Server

1. Navigate to the frontend directory:
cd frontend

2. Start the React development server:
npm start


This will start the React application at http://localhost:3000

## Using the Application

1. Open your browser and go to http://localhost:3000
2. Choose either "Presenter" or "Viewer" role
3. If you're a presenter, a room ID will be created - share this with viewers
4. If you're a viewer, enter the room ID shared by the presenter and join the room
5. Allow camera and microphone access when prompted

## Features

- Real-time video and audio communication
- Presenter and viewer roles
- Room-based sessions
- Mute/unmute audio
- Turn camera on/off

