import React, { useState } from 'react';
import VideoCall from './components/VideoCall';

function App() {
  const [role, setRole] = useState(null);

  return (
    <div>
      {!role ? (
        <div style={{ textAlign: 'center', marginTop: 50 }}>
          <h1>Select Role</h1>
          <button onClick={() => setRole('presenter')}>Presenter</button>
          <button onClick={() => setRole('viewer')}>Viewer</button>
        </div>
      ) : (
        <VideoCall role={role} />
      )}
    </div>
  );
}

export default App;
