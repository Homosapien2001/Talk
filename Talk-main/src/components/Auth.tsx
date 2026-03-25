import { useState, type FormEvent } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../firebase';
import './Auth.css';

type AuthMode = 'login' | 'signup';

function Auth() {
    const [mode, setMode] = useState<AuthMode>('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (mode === 'signup') {
                if (!username.trim()) throw new Error('Username is required');
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                await updateProfile(userCredential.user, { displayName: username });
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
            // Success - Firebase onAuthStateChanged will handle the state update
        } catch (err: any) {
            // Handle Firebase errors with user-friendly messages
            let errorMessage = 'An error occurred. Please try again.';

            if (err.code === 'auth/email-already-in-use') {
                errorMessage = 'This email is already registered. Please login instead.';
            } else if (err.code === 'auth/invalid-email') {
                errorMessage = 'Please enter a valid email address.';
            } else if (err.code === 'auth/weak-password') {
                errorMessage = 'Password should be at least 6 characters.';
            } else if (err.code === 'auth/user-not-found') {
                errorMessage = 'No account found with this email.';
            } else if (err.code === 'auth/wrong-password') {
                errorMessage = 'Incorrect password. Please try again.';
            } else if (err.code === 'auth/invalid-credential') {
                errorMessage = 'Invalid email or password.';
            }

            setError(errorMessage);
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setMode(mode === 'login' ? 'signup' : 'login');
        setError('');
        setEmail('');
        setPassword('');
    };

    return (
        <div className="auth-container">
            <div className="auth-background">
                <div className="auth-glow"></div>
                <div className="auth-glow"></div>
                <div className="auth-glow"></div>
            </div>

            <div className="auth-card">
                <div className="auth-header">
                    <h1 className="auth-title">Welcome to Talk</h1>
                    <p className="auth-subtitle">
                        {mode === 'login'
                            ? 'Sign in to join the conversation'
                            : 'Create your account to get started'}
                    </p>
                </div>

                <div className="auth-toggle">
                    <button
                        type="button"
                        className={`auth-toggle-btn ${mode === 'login' ? 'active' : ''}`}
                        onClick={() => mode !== 'login' && toggleMode()}
                    >
                        Login
                    </button>
                    <button
                        type="button"
                        className={`auth-toggle-btn ${mode === 'signup' ? 'active' : ''}`}
                        onClick={() => mode !== 'signup' && toggleMode()}
                    >
                        Sign Up
                    </button>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {mode === 'signup' && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="username">Username</label>
                            <input
                                id="username"
                                type="text"
                                className="form-input"
                                placeholder="Camper Name"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>
                    )}
                    <div className="form-group">
                        <label className="form-label" htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            className="form-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            disabled={loading}
                        />
                    </div>

                    {error && (
                        <div className="auth-error">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <button type="submit" className="auth-submit" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="loading-spinner"></span>
                                <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                            </>
                        ) : (
                            <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    {mode === 'login' ? (
                        <p>
                            Don't have an account?{' '}
                            <button
                                type="button"
                                onClick={toggleMode}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'hsl(var(--accent-orange))',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    textDecoration: 'underline'
                                }}
                            >
                                Sign up
                            </button>
                        </p>
                    ) : (
                        <p>
                            Already have an account?{' '}
                            <button
                                type="button"
                                onClick={toggleMode}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: 'hsl(var(--accent-orange))',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                    textDecoration: 'underline'
                                }}
                            >
                                Login
                            </button>
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Auth;
