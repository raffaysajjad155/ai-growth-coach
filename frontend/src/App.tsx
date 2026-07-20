import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000';

interface FeedbackData {
  what_is_wrong: string;
  why_it_is_wrong: string;
  how_to_fix: string;
  concept_to_study: string;
}

interface Submission {
  id: string;
  member_id?: string;
  language: string;
  code: string;
  feedback_json: FeedbackData | { error: string };
  created_at: string;
}

interface Comment {
  id: string;
  author_id: string;
  comment_text: string;
  created_at: string;
}

function App() {
  const [tab, setTab] = useState<'submit' | 'dashboard' | 'community'>('submit');
  const [code, setCode] = useState('');
  const [language, setLanguage] = useState('python');
  const [memberId, setMemberId] = useState('demo-user');
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [error, setError] = useState('');

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [dashLoading, setDashLoading] = useState(false);

  const [communitySubs, setCommunitySubs] = useState<Submission[]>([]);
  const [commLoading, setCommLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [votedMap, setVotedMap] = useState<Record<string, 'up' | 'down'>>({});

  const lineCount = Math.max(code.split('\n').length, 8);

  const handleSubmit = async () => {
    if (!code.trim()) {
      setError('paste some code first — the editor is empty.');
      return;
    }
    setLoading(true);
    setError('');
    setFeedback(null);
    try {
      const response = await axios.post(`${API_BASE}/submit`, { code, language, member_id: memberId });
      if (response.data.feedback_result.status === 'success') {
        setFeedback(response.data.feedback_result.data);
      } else {
        setError('model returned an unparseable response — try again.');
      }
    } catch (err) {
      setError('could not reach the backend at localhost:8000.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    setDashLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/submissions/${memberId}`);
      setSubmissions(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setDashLoading(false);
    }
  };

  const loadCommunity = async () => {
    setCommLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/all-submissions`);
      setCommunitySubs(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setCommLoading(false);
    }
  };

  const loadComments = async (submissionId: string) => {
    try {
      const response = await axios.get(`${API_BASE}/comments/${submissionId}`);
      setComments(response.data);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleExpand = (submissionId: string) => {
    if (expandedId === submissionId) {
      setExpandedId(null);
      setComments([]);
    } else {
      setExpandedId(submissionId);
      loadComments(submissionId);
    }
  };

  const postComment = async (submissionId: string) => {
    if (!newComment.trim()) return;
    try {
      await axios.post(`${API_BASE}/comment`, {
        submission_id: submissionId,
        author_id: memberId,
        comment_text: newComment,
      });
      setNewComment('');
      loadComments(submissionId);
    } catch (err) {
      console.error(err);
    }
  };

  const castVote = async (submissionId: string, voteType: 'up' | 'down') => {
    try {
      await axios.post(`${API_BASE}/vote`, {
        submission_id: submissionId,
        voter_id: memberId,
        vote_type: voteType,
      });
      setVotedMap((prev) => ({ ...prev, [submissionId]: voteType }));
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'community') loadCommunity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  return (
    <div className="shell">
      <div className="prompt-line">./ai-growth-coach --analyze <span className="cursor" /></div>
      <h1 className="title">AI Growth Coach</h1>
      <p className="subtitle">
        Paste code, get an instant structured review, and let the pattern
        engine catch the mistakes you keep repeating.
      </p>

      <div className="tab-row">
        <button className={`tab-btn ${tab === 'submit' ? 'active' : ''}`} onClick={() => setTab('submit')}>submit</button>
        <button className={`tab-btn ${tab === 'dashboard' ? 'active' : ''}`} onClick={() => setTab('dashboard')}>dashboard</button>
        <button className={`tab-btn ${tab === 'community' ? 'active' : ''}`} onClick={() => setTab('community')}>community</button>
      </div>

      <div className="config-row">
        <div className="field">
          <label>member_id</label>
          <input value={memberId} onChange={(e) => setMemberId(e.target.value)} />
        </div>
        {tab === 'submit' && (
          <div className="field">
            <label>language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option value="python">python</option>
              <option value="javascript">javascript</option>
              <option value="cpp">cpp</option>
            </select>
          </div>
        )}
      </div>

      {tab === 'submit' && (
        <>
          <div className="editor">
            <div className="gutter">
              {Array.from({ length: lineCount }, (_, i) => <div key={i}>{i + 1}</div>)}
            </div>
            <textarea value={code} onChange={(e) => setCode(e.target.value)} placeholder="// paste your code here" rows={lineCount} />
          </div>
          <button className="run-btn" onClick={handleSubmit} disabled={loading}>
            {loading ? (
              <span className="dots">
                analyzing<span style={{ '--i': 0 } as any}>.</span><span style={{ '--i': 1 } as any}>.</span><span style={{ '--i': 2 } as any}>.</span>
              </span>
            ) : <>▶ run review</>}
          </button>
          {error && <div className="error-line">✕ {error}</div>}
          {feedback && (
            <div className="feedback-card">
              <div className="feedback-header">
                <span className="label">review output</span>
                <span className="category-tag">{feedback.concept_to_study}</span>
              </div>
              <div className="feedback-body">
                <div className="fb-row"><div className="fb-key">what's wrong</div><div className="fb-val">{feedback.what_is_wrong}</div></div>
                <div className="fb-row"><div className="fb-key">why it matters</div><div className="fb-val">{feedback.why_it_is_wrong}</div></div>
                <div className="fb-row"><div className="fb-key">how to fix</div><div className="fb-val">{feedback.how_to_fix}</div></div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'dashboard' && (
        <div className="dashboard">
          {dashLoading && <p className="dim-text">loading history...</p>}
          {!dashLoading && submissions.length === 0 && <p className="dim-text">no submissions yet for "{memberId}".</p>}
          {submissions.map((sub) => {
            const fb = sub.feedback_json as FeedbackData;
            const isValid = !('error' in sub.feedback_json);
            return (
              <div className="history-card" key={sub.id}>
                <div className="history-header">
                  <span className="lang-tag">{sub.language}</span>
                  <span className="timestamp">{new Date(sub.created_at).toLocaleString()}</span>
                </div>
                <pre className="code-preview">{sub.code}</pre>
                {isValid ? (
                  <div className="fb-row"><div className="fb-key">issue</div><div className="fb-val">{fb.what_is_wrong}</div></div>
                ) : <p className="error-line">✕ parsing failed for this submission</p>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'community' && (
        <div className="dashboard">
          {commLoading && <p className="dim-text">loading community feed...</p>}
          {!commLoading && communitySubs.length === 0 && <p className="dim-text">no submissions yet.</p>}
          {communitySubs.map((sub) => {
            const fb = sub.feedback_json as FeedbackData;
            const isValid = !('error' in sub.feedback_json);
            const isOpen = expandedId === sub.id;
            return (
              <div className="history-card" key={sub.id}>
                <div className="history-header">
                  <span className="lang-tag">{sub.member_id} · {sub.language}</span>
                  <span className="timestamp">{new Date(sub.created_at).toLocaleString()}</span>
                </div>
                <pre className="code-preview">{sub.code}</pre>
                {isValid ? (
                  <div className="fb-row"><div className="fb-key">issue</div><div className="fb-val">{fb.what_is_wrong}</div></div>
                ) : <p className="error-line">✕ parsing failed for this submission</p>}

                <div className="vote-row">
                  <button
                    className={`vote-btn ${votedMap[sub.id] === 'up' ? 'voted' : ''}`}
                    onClick={() => castVote(sub.id, 'up')}
                  >
                    {votedMap[sub.id] === 'up' ? '✓ voted helpful' : '▲ helpful'}
                  </button>
                  <button
                    className={`vote-btn ${votedMap[sub.id] === 'down' ? 'voted' : ''}`}
                    onClick={() => castVote(sub.id, 'down')}
                  >
                    {votedMap[sub.id] === 'down' ? '✓ voted' : '▼ not helpful'}
                  </button>
                  <button className="vote-btn" onClick={() => toggleExpand(sub.id)}>
                    {isOpen ? '✕ close comments' : '💬 comments'}
                  </button>
                </div>

                {isOpen && (
                  <div className="comment-section">
                    {comments.length === 0 && <p className="dim-text">no comments yet.</p>}
                    {comments.map((c) => (
                      <div className="comment-item" key={c.id}>
                        <span className="comment-author">{c.author_id}</span>
                        <span className="comment-text">{c.comment_text}</span>
                      </div>
                    ))}
                    <div className="comment-input-row">
                      <input
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="add a comment..."
                      />
                      <button className="vote-btn" onClick={() => postComment(sub.id)}>post</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default App;