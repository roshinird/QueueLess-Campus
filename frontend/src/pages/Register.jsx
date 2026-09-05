import { Link } from "react-router-dom";

function Register() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-icon">Q</div>
          <div>
            <h1>QueueLess</h1>
            <span>Campus</span>
          </div>
        </div>

        <div className="auth-heading">
          <h2>Create your account</h2>
          <p>Join QueueLess Campus and skip the physical queue.</p>
        </div>

        <form className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full name</label>
            <input
              id="name"
              type="text"
              placeholder="Enter your full name"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Create a password"
              required
            />
          </div>

          <button type="submit" className="primary-button auth-button">
            Create Account
          </button>
        </form>

        <p className="auth-footer">
          Already have an account?{" "}
          <Link to="/login">Login</Link>
        </p>

        <Link to="/" className="back-link">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}

export default Register;