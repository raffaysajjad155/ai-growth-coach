import { useState } from 'react';
import { supabase } from './supabaseClient';

interface AuthScreenProps {
  onAuthSuccess: () => void;
}

function AuthScreen({ onAuthSuccess }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('email and password are both required.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      if (isSignUp) {
        const { error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message || 'something went wrong, please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shell">
      <div className="prompt-line">./ai-growth-coach --auth <span className="cursor" /></div>
      <h1 className="title">AI Growth Coach</h1>
      <p className="subtitle">
        {isSignUp ? 'Create an account to start tracking your growth.' : 'Log in to see your growth.'}
      </p>

      <div className="field" style={{ maxWidth: '320px', marginBottom: '14px' }}>
        <label>email</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </div>

      <div className="field" style={{ maxWidth: '320px', marginBottom: '18px' }}>
        <label>password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
      </div>

      <button className="run-btn" onClick={handleSubmit} disabled={loading}>
        {loading ? 'processing...' : isSignUp ? '▶ sign up' : '▶ log in'}
      </button>

      {error && <div className="error-line">✕ {error}</div>}

      <p className="dim-text" style={{ marginTop: '20px' }}>
        {isSignUp ? 'Already have an account? ' : 'New here? '}
        <span
          style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => { setIsSignUp(!isSignUp); setError(''); }}
        >
          {isSignUp ? 'Log in' : 'Sign up'}
        </span>
      </p>
    </div>
  );
}

export default AuthScreen;