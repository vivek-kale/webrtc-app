import React, { useCallback, useEffect, useRef, useState } from 'react';

function VideoCall({ role }) {
  // Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const janusRef = useRef(null);
  const pluginRef = useRef(null);
  const hasFetchedRef = useRef(false);
  const subscribedRef = useRef(false);

  // State
  const [started, setStarted] = useState(false);
  const [janusUrl, setJanusUrl] = useState(null);
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [localStream, setLocalStream] = useState(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [inputRoom, setInputRoom] = useState("");
  const [remoteStreamActive, setRemoteStreamActive] = useState(false);

  // Fetch initial Janus URL and create/set room ID
  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;
    
    async function fetchJanusAndRoom() {
      try {
        // Get Janus server URL from our backend
        const response = await fetch('http://localhost:8000/api/janus-url');
        const data = await response.json();
        setJanusUrl(data.janus_url);
        console.log("Retrieved Janus URL:", data.janus_url);

        if (role === 'presenter') {
          // Create a new room via our backend
          const roomResponse = await fetch('http://localhost:8000/api/room/create', { 
            method: 'POST' 
          });
          const roomData = await roomResponse.json();
          setRoomId(roomData.room_id);
          console.log("Created room:", roomData.room_id);
        }
      } catch (err) {
        console.error("Error setting up connection:", err);
        setError("Connection setup failed. Please try again.");
      }
    }
    
    fetchJanusAndRoom();
  }, [role]);

  // Handle room joining for viewers
  const handleRoomJoin = async () => {
    if (!inputRoom) return;
    
    const roomNum = parseInt(inputRoom, 10);
    if (isNaN(roomNum) || roomNum <= 0) {
      setError("Please enter a valid room number");
      return;
    }
    
    try {
      const response = await fetch('http://localhost:8000/api/room/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room: roomNum }),
      });
      
      const data = await response.json();
      setRoomId(data.room_id || roomNum);
      console.log("Joined room:", data.room_id || roomNum);
    } catch (err) {
      console.error("Room join failed:", err);
      setError("Couldn't join the room. Try again.");
    }
  };

  // Start the presenter's video stream
  const startPresenter = useCallback(() => {
    console.log("Starting presenter mode...");
    
    // First create/configure the room
    pluginRef.current.send({
      message: {
        request: 'create',
        room: roomId,
        publishers: 1,
      },
      success: () => {
        // Then join as publisher
        pluginRef.current.send({
          message: {
            request: 'join',
            room: roomId,
            ptype: 'publisher',
            display: 'Presenter'
          }
        });
      }
    });

    // Get local camera/mic stream
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        console.log("Camera access granted");
        setLocalStream(stream);
        
        // Show local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(err => console.warn("Video play blocked:", err));
        }
        
        // Create WebRTC offer
        pluginRef.current.createOffer({
          media: { audio: true, video: true },
          stream,
          success: (jsep) => {
            console.log("Created offer");
            pluginRef.current.send({
              message: { request: 'publish', audio: true, video: true },
              jsep
            });
          },
          error: (err) => console.error("Offer creation failed:", err)
        });
      })
      .catch((err) => {
        console.error("Camera access denied:", err);
        setError("Please allow camera access to continue");
      });
  }, [roomId]);

  // Start viewer connection
  const startViewer = useCallback(() => {
    console.log("Starting viewer mode for room:", roomId);
    subscribedRef.current = false;
    setRemoteStreamActive(false);
    
    // For viewers we need audio permission to make WebRTC happy
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((stream) => {
        // We don't actually need this stream so stop the tracks
        stream.getTracks().forEach(track => track.stop());
        
        // Join the room as a subscriber
        pluginRef.current.send({
          message: {
            request: 'join',
            room: parseInt(roomId, 10),
            ptype: 'subscriber',
            display: 'Viewer'
          },
          success: () => console.log("Joined as viewer"),
          error: (err) => {
            console.error("Viewer join failed:", err);
            setError("Couldn't join as viewer");
          }
        });
      })
      .catch(err => {
        console.error("Audio permission error:", err);
        
        // Try joining anyway
        pluginRef.current.send({
          message: {
            request: 'join',
            room: parseInt(roomId, 10),
            ptype: 'subscriber',
            display: 'Viewer' 
          }
        });
      });
  }, [roomId]);

  // Audio mute toggle
  const toggleAudio = () => {
    if (!localStream) return;
    
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsAudioMuted(!isAudioMuted);
  };

  // Video toggle
  const toggleVideo = () => {
    if (!localStream) return;
    
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
    });
    setIsVideoOff(!isVideoOff);
  };

  // Initialize Janus and connect to the videoroom
  useEffect(() => {
    if (!started || !janusUrl || !roomId) return;

    // Initialize Janus library
    window.Janus.init({
      debug: 'all', 
      callback: () => {
        // Create Janus session
        janusRef.current = new window.Janus({
          server: janusUrl,
          success: () => {
            console.log("Connected to Janus server");
            
            // Attach to videoroom plugin
            janusRef.current.attach({
              plugin: 'janus.plugin.videoroom',
              opaqueId: "videoroom-" + window.Janus.randomString(12),
              
              // Plugin attached successfully
              success: (pluginHandle) => {
                pluginRef.current = pluginHandle;
                console.log("Plugin attached, ID:", pluginHandle.getId());
                
                // Start appropriate role
                if (role === 'presenter') {
                  startPresenter();
                } else if (role === 'viewer') {
                  startViewer();
                }
              },
              
              // Error attaching plugin
              error: (error) => console.error("Plugin attachment failed:", error),
              
              // Handle incoming messages
              onmessage: (msg, jsep) => {
                console.log("Received:", msg);
                
                // Handle WebRTC negotiation
                if (jsep) {
                  pluginRef.current.handleRemoteJsep({ jsep });
                  
                  // Create an answer if we're a viewer receiving an offer
                  if (role === 'viewer' && jsep.type === 'offer') {
                    console.log("Got offer, creating answer");
                    pluginRef.current.createAnswer({
                      jsep: jsep,
                      media: { audioSend: false, videoSend: false, audio: true, video: true },
                      success: (jsep) => {
                        console.log("Created answer");
                        pluginRef.current.send({
                          message: { 
                            request: "start", 
                            room: parseInt(roomId, 10),
                            video: true,
                            audio: true 
                          },
                          jsep: jsep
                        });
                      },
                      error: (err) => console.error("Answer creation failed:", err)
                    });
                  }
                }
                
                const event = msg.videoroom;
                
                // Handle "joined" event
                if (event === 'joined') {
                  console.log("Joined room", roomId);
                  
                  // For viewers, check for existing publishers
                  if (role === 'viewer') {
                    if (msg.publishers && msg.publishers.length > 0) {
                      const pub = msg.publishers[0];
                      console.log("Found presenter:", pub.id);
                      subscribedRef.current = true;
                      
                      // Subscribe to the presenter's feed
                      pluginRef.current.send({
                        message: {
                          request: 'subscribe',
                          room: parseInt(roomId, 10),
                          feed: pub.id,
                          offer_video: true,
                          offer_audio: true
                        }
                      });
                    } else {
                      console.log("No presenter yet");
                      setError("Waiting for presenter to join room " + roomId);
                    }
                  }
                }
                // Handle "event" message
                else if (event === 'event') {
                  // Handle missing feed error
                  if (msg.error && msg.error.includes("Missing mandatory element (feed)")) {
                    console.log("No presenter available");
                    setError("Waiting for presenter to join room " + roomId);
                    return;
                  } else if (msg.error) {
                    console.error("Janus error:", msg.error);
                    setError(msg.error);
                    return;
                  }
                  
                  // Handle publisher announcements
                  if (role === 'viewer' && !subscribedRef.current && 
                      msg.publishers && msg.publishers.length > 0) {
                    const pub = msg.publishers[0];
                    console.log("New presenter detected:", pub.id);
                    subscribedRef.current = true;
                    
                    pluginRef.current.send({
                      message: {
                        request: 'subscribe',
                        room: parseInt(roomId, 10),
                        feed: pub.id,
                        offer_video: true,
                        offer_audio: true
                      }
                    });
                    setError("");
                  }
                  
                  // Handle presenter leaving
                  if (role === 'viewer' && msg.leaving) {
                    console.log("Presenter left");
                    setError("Presenter has left the room");
                    subscribedRef.current = false;
                    setRemoteStreamActive(false);
                  }
                  
                  // Handle configured event
                  if (role === 'viewer' && msg.configured) {
                    console.log("Subscription has been configured");
                  }
                }
                // Handle publisher announcements
                else if (event === 'publishers' && role === 'viewer') {
                  if (msg.publishers && msg.publishers.length > 0) {
                    const pub = msg.publishers[0];
                    console.log("Presenter started publishing:", pub.id);
                    
                    pluginRef.current.send({
                      message: {
                        request: 'subscribe',
                        room: parseInt(roomId, 10),
                        feed: pub.id,
                        offer_video: true,
                        offer_audio: true
                      }
                    });
                    setError("");
                  }
                }
              },
              
              // Handle local stream
              onlocalstream: (stream) => {
                console.log("Got local stream");
                if (localVideoRef.current) {
                  localVideoRef.current.srcObject = stream;
                  localVideoRef.current.play().catch(err => console.warn("Video playback issue:", err));
                }
              },
              
              // Handle remote stream with improved error handling
              onremotestream: (stream) => {
                console.log("Got remote stream");
                console.log("Video tracks:", stream.getVideoTracks().length);
                console.log("Audio tracks:", stream.getAudioTracks().length);
                
                if (remoteVideoRef.current) {
                  // Clean up any existing stream
                  if (remoteVideoRef.current.srcObject) {
                    const existingStream = remoteVideoRef.current.srcObject;
                    existingStream.getTracks().forEach(track => track.stop());
                  }
                  
                  remoteVideoRef.current.srcObject = stream;
                  
                  // Attempt to play the video
                  const playPromise = remoteVideoRef.current.play();
                  if (playPromise !== undefined) {
                    playPromise
                      .then(() => {
                        console.log("Remote video playing successfully");
                        setRemoteStreamActive(true);
                      })
                      .catch(err => {
                        console.warn("Remote video issue:", err);
                        // Try again after a short delay
                        setTimeout(() => {
                          remoteVideoRef.current.play()
                            .then(() => {
                              console.log("Remote video playing after retry");
                              setRemoteStreamActive(true);
                            })
                            .catch(retryErr => {
                              console.error("Video retry failed:", retryErr);
                            });
                        }, 1000);
                      });
                  }
                }
              },
              
              // Handle cleanup
              oncleanup: () => {
                console.log("WebRTC connection closed");
                setRemoteStreamActive(false);
              }
            });
          },
          error: (err) => console.error("Janus connection failed:", err),
          destroyed: () => console.log("Janus session terminated")
        });
      }
    });
    
    // Cleanup when component unmounts
    return () => {
      if (janusRef.current) {
        janusRef.current.destroy();
      }
    };
  }, [started, janusUrl, roomId, role, startPresenter, startViewer]);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h2 style={{ textAlign: "center" }}>
        {role === "presenter" ? "Presenter" : "Viewer"} Interface
      </h2>
      
      {error && <div style={{ color: "red", textAlign: "center" }}>{error}</div>}
      
      {/* Start button */}
      <div style={{ textAlign: "center", marginBottom: "20px" }}>
        <button
          onClick={() => setStarted(true)}
          disabled={started || (role === "viewer" && !roomId)}
          style={{ padding: "10px 20px", fontSize: "16px" }}
        >
          Start {role}
        </button>
        
        {/* Reconnect button for viewers */}
        {role === "viewer" && started && (
          <button
            onClick={() => {
              subscribedRef.current = false;
              setError("");
              startViewer();
            }}
            style={{ padding: "10px 20px", fontSize: "16px", marginLeft: "10px" }}
          >
            Reconnect
          </button>
        )}
      </div>
      
      {/* Room input for viewer */}
      {role === "viewer" && !roomId && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <input
            type="number"
            placeholder="Enter Room ID"
            value={inputRoom}
            onChange={(e) => setInputRoom(e.target.value)}
            style={{ padding: "10px", fontSize: "16px", width: "200px" }}
          />
          <button
            onClick={handleRoomJoin}
            style={{ padding: "10px 20px", fontSize: "16px", marginLeft: "10px" }}
          >
            Join Room
          </button>
        </div>
      )}
      
      {/* Room ID display for presenter */}
      {role === "presenter" && roomId && (
        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <p>
            Room ID: <strong>{roomId}</strong> (share this with viewers)
          </p>
        </div>
      )}
      
      {/* Video containers */}
      <div id="video-container" style={{ display: "flex", gap: "20px" }}>
        <video
          id="localVideo"
          ref={localVideoRef}
          autoPlay
          muted
          playsInline
          style={{ width: "50%", border: "2px solid #ccc" }}
        />
        <video
          id="remoteVideo"
          ref={remoteVideoRef}
          autoPlay
          playsInline
          style={{ 
            width: "50%", 
            border: remoteStreamActive ? "2px solid green" : "2px solid #ccc",
            background: "#f0f0f0" 
          }}
        />
      </div>
      
      {/* Media controls */}
      <div style={{ textAlign: "center", marginTop: "10px" }}>
        {localStream && (
          <>
            <button
              onClick={toggleAudio}
              style={{ padding: "8px 16px", fontSize: "14px", marginRight: "10px" }}
            >
              {isAudioMuted ? "Unmute" : "Mute"}
            </button>
            <button
              onClick={toggleVideo}
              style={{ padding: "8px 16px", fontSize: "14px" }}
            >
              {isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
            </button>
          </>
        )}
      </div>
      
      {/* Remote stream status indicator */}
      {role === "viewer" && remoteStreamActive && (
        <div style={{ textAlign: "center", marginTop: "10px", color: "green" }}>
          Connected to presenter's stream
        </div>
      )}
    </div>
  );
}

export default VideoCall;