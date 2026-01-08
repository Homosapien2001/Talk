import React from 'react';

interface PostSessionProps {
    onReturn: () => void;
}

const PostSession: React.FC<PostSessionProps> = ({ onReturn }) => {
    return (
        <div className="view-container post-session-view">
            <div className="post-card glass">
                <div className="fire-icon">🔥</div>
                <h2>The fire has died down...</h2>
                <p className="text-secondary">
                    Thank you for sharing your presence. Conversations like these keep the world a bit warmer.
                </p>

                <div className="post-actions">
                    <div className="donation-section">
                        <p className="label">Want to keep the fire going?</p>
                        <button className="btn-secondary donation-btn">
                            Buy some wood ($1)
                        </button>
                        <p className="hint text-secondary">(Mock Donation for Experiment)</p>
                    </div>

                    <div className="feedback-section">
                        <p className="label">How was your stay?</p>
                        <div className="emoji-row">
                            <button className="emoji-btn">😊</button>
                            <button className="emoji-btn">😐</button>
                            <button className="emoji-btn">😞</button>
                        </div>
                    </div>

                    <button className="btn-primary" onClick={onReturn}>
                        Return to Lobby
                    </button>
                </div>
            </div>

            <style>{`
                .post-session-view {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .post-card {
                    padding: 3rem;
                    max-width: 450px;
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    animation: slideUp 0.6s cubic-bezier(0.23, 1, 0.32, 1);
                }
                .fire-icon {
                    font-size: 3rem;
                    filter: grayscale(1) opacity(0.5);
                }
                .post-actions {
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                    margin-top: 1rem;
                }
                .donation-section, .feedback-section {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }
                .emoji-row {
                    display: flex;
                    justify-content: center;
                    gap: 1.5rem;
                }
                .emoji-btn {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 50%;
                    width: 50px;
                    height: 50px;
                    font-size: 1.5rem;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .emoji-btn:hover {
                    background: rgba(255,255,255,0.15);
                    transform: translateY(-2px);
                }
                .donation-btn {
                    padding: 0.8rem;
                    font-weight: 600;
                    border: 1px solid hsla(var(--accent-orange), 0.3);
                    color: hsl(var(--accent-orange));
                }
                .hint {
                    font-size: 0.8rem;
                }
                @keyframes slideUp {
                    from { transform: translateY(20px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default PostSession;
