import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import './App.css';

const API_BASE = 'https://vessels-trainer-nonprofit-transactions.trycloudflare.com';;

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

interface ReportData {
  status: string;
  total_submissions?: number;
  category_breakdown?: Record<string, number>;
  timeline?: { date: string; category: string }[];
  improvement_score?: number;
  weak_categories?: string[];
  recommended_resources?: string[];
}

interface MentorMember {
  member_id: string;
  last_active: string;
  total_submissions: number;
}

function App() {
  const [tab, setTab] = useState<'submit' | 'dashboard' | 'community' | 'report' | 'mentor'>('submit');
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

  const [report, setReport] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  const [mentorData, setMentorData] = useState<MentorMember[]>([]);
  const [mentorLoading, setMentorLoading] = useState(false);

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

  const loadReport = async () => {
    setReportLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/report/${memberId}`);
      setReport(response.data);
    } catch (err) {
      console.error(err);
    } finally {
      setReportLoading(false);
    }
  };

  const loadMentorDashboard = async () => {
    setMentorLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/mentor-dashboard`);
      setMentorData(response.data.members);
    } catch (err) {
      console.error(err);
    } finally {
      setMentorLoading(false);
    }
  };

  useEffect(() => {
    if (tab === 'dashboard') loadDashboard();
    if (tab === 'community') loadCommunity();
    if (tab === 'report') loadReport();
    if (tab === 'mentor') loadMentorDashboard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, memberId]);

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
        <button className={`tab-btn ${tab === 'report' ? 'active' : ''}`} onClick={() => setTab('report')}>report</button>
        <button className={`tab-btn ${tab === 'mentor' ? 'active' : ''}`} onClick={() => setTab('mentor')}>mentor</button>
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

      {tab === 'report' && (
        <div className="dashboard">
          {reportLoading && <p className="dim-text">generating report...</p>}
          {!reportLoading && report?.status === 'no_data' && (
            <p className="dim-text">no submissions yet for "{memberId}".</p>
          )}
          {!reportLoading && report?.status === 'done' && (
            <>
              <div className="stat-row">
                <div className="stat-box">
                  <div className="stat-label">total submissions</div>
                  <div className="stat-value">{report.total_submissions}</div>
                </div>
                <div className="stat-box">
                  <div className="stat-label">improvement score</div>
                  <div className="stat-value">{report.improvement_score}%</div>
                </div>
              </div>

              <h3 className="section-heading">mistake frequency by category</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={Object.entries(report.category_breakdown || {}).map(([category, count]) => ({ category, count }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232b38" />
                  <XAxis dataKey="category" tick={{ fill: '#7c8797', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#7c8797', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#10151d', border: '1px solid #232b38' }} />
                  <Bar dataKey="count" fill="#5eead4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <h3 className="section-heading">submissions over time</h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={(report.timeline || []).slice().reverse().map((t, i) => ({ index: i + 1, date: new Date(t.date).toLocaleDateString() }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#232b38" />
                  <XAxis dataKey="date" tick={{ fill: '#7c8797', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#7c8797', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: '#10151d', border: '1px solid #232b38' }} />
                  <Line type="monotone" dataKey="index" stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#a78bfa' }} />
                </LineChart>
              </ResponsiveContainer>

              <h3 className="section-heading">recommended resources</h3>
              <ul className="resource-list">
                {report.recommended_resources?.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      {tab === 'mentor' && (
        <div className="dashboard">
          {mentorLoading && <p className="dim-text">loading members...</p>}
          {!mentorLoading && mentorData.length === 0 && <p className="dim-text">no members yet.</p>}
          {!mentorLoading && mentorData.length > 0 && (
            <table className="mentor-table">
              <thead>
                <tr>
                  <th>member</th>
                  <th>submissions</th>
                  <th>last active</th>
                </tr>
              </thead>
              <tbody>
                {mentorData.map((m) => (
                  <tr key={m.member_id}>
                    <td>{m.member_id}</td>
                    <td>{m.total_submissions}</td>
                    <td>{new Date(m.last_active).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

export default App;