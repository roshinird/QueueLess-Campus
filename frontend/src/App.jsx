import { Link, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import "./App.css";
function Home() {
  return (
    <div className="app">
      <header className="navbar">
        <div className="brand">
          <div className="brand-icon">Q</div>
          <div>
            <h1>QueueLess</h1>
            <span>Campus</span>
          </div>
        </div>

        <div className="nav-actions">
          <Link to="/login" className="nav-link">
  Login
</Link>

<Link to="/register" className="nav-button">
  Register
</Link>
        </div>
      </header>

      <main className="hero">
        <section className="hero-content">
          <div className="badge">SMART CAMPUS QUEUE MANAGEMENT</div>

          <h2>
            Skip the queue.
            <br />
            <span>Save your time.</span>
          </h2>

          <p>
            Join campus service queues digitally, track your position in
            real-time, and get notified when your turn is near.
          </p>

          <div className="hero-actions">
            <Link to="/login" className="primary-button">
  Get Started
</Link>

<Link to="/login" className="secondary-button">
  Explore Queues
</Link>
          </div>
        </section>

        <section className="queue-preview">
          <div className="preview-header">
            <div>
              <span className="preview-label">LIVE QUEUE</span>
              <h3>Main Canteen</h3>
            </div>

            <span className="status">
              <span className="status-dot"></span>
              Open
            </span>
          </div>

          <div className="queue-number">
            <span>Your position</span>
            <strong>08</strong>
            <small>people ahead of you</small>
          </div>

          <div className="queue-info">
            <div>
              <span>Current Token</span>
              <strong>#42</strong>
            </div>

            <div>
              <span>Estimated Wait</span>
              <strong>12 min</strong>
            </div>
          </div>

          <div className="progress-container">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
            <span>You're getting closer!</span>
          </div>
        </section>
      </main>

      <section className="features">
        <div className="feature-card">
          <div className="feature-icon">01</div>
          <h3>Join Digitally</h3>
          <p>
            Join a campus queue from anywhere without physically standing in
            line.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">02</div>
          <h3>Track Your Turn</h3>
          <p>
            See your live queue position and estimated waiting time.
          </p>
        </div>

        <div className="feature-card">
          <div className="feature-icon">03</div>
          <h3>Get Notified</h3>
          <p>
            Receive notifications when your turn is approaching.
          </p>
        </div>
      </section>
    </div>
  );
}
function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
    </Routes>
  );
}

export default App;

