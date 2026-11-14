import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';

function authHeaders() {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { ...authHeaders(), ...(options.headers || {}) },
  });
  return res.json();
}

function fmtDuration(sec) {
  if (!sec && sec !== 0) return '—';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtBytes(b) {
  if (!b) return '—';
  return b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`;
}

function ProgressBar({ progress }) {
  return (
    <div className="frost-progress">
      <div
        className="frost-progress-fill"
        style={{ width: `${Math.max(2, progress || 0)}%` }}
      />
    </div>
  );
}

export default function Videos() {
  const [videos, setVideos] = useState([]);
  const [jobs, setJobs] = useState({}); // jobId -> { status, progress, output, error }
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const timers = useRef({});

  const watchJob = useCallback((jobId, onDone) => {
    if (timers.current[jobId]) return;
    const tick = async () => {
      let data;
      try {
        data = await api(`/jobs/${jobId}/status`);
      } catch { return; }
      const status = data.status || {};
      setJobs((prev) => ({ ...prev, [jobId]: status }));
      if (status.status === 'completed' || status.status === 'failed') {
        clearInterval(timers.current[jobId]);
        delete timers.current[jobId];
        if (onDone) onDone(status);
      }
    };
    timers.current[jobId] = setInterval(tick, 1500);
    tick();
  }, []);

  useEffect(() => () => Object.values(timers.current).forEach(clearInterval), []);

  const patchVideo = (id, patch) =>
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)));

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setNotice('');
    try {
      const form = new FormData();
      form.append('video', file);
      const res = await fetch('/api/videos/upload', {
        method: 'POST',
        headers: authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.video) throw new Error(data.error || 'Upload failed');
      const v = data.video.video;
      setVideos((prev) => [{ id: v.id, original_filename: v.original_filename, duration: v.duration, width: v.width, height: v.height, moments: null, clips: [] }, ...prev]);
      setNotice(`Uploaded ${v.original_filename}`);
    } catch (err) {
      setNotice(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const runAnalyze = async (video) => {
    setNotice('');
    try {
      const data = await api(`/videos/${video.id}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!data.jobId) throw new Error(data.error || 'Analyze failed to start');
      patchVideo(video.id, { busy: 'analyze', job: data.jobId });
      watchJob(data.jobId, async (done) => {
        patchVideo(video.id, { busy: null });
        if (done.status === 'completed') {
          const moments = done.output?.length || 0;
          patchVideo(video.id, { moments });
          setNotice(`Analysis done — ${moments} moments found`);
        } else {
          setNotice(`Analysis failed: ${done.error || 'unknown error'}`);
        }
      });
    } catch (err) {
      setNotice(`Analyze failed: ${err.message}`);
    }
  };

  const runGenerateClips = async (video) => {
    setNotice('');
    try {
      const data = await api(`/videos/${video.id}/generate-clips`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ options: { maxClips: 5 } }),
      });
      if (!data.jobId) throw new Error(data.error || 'Clip generation failed to start');
      patchVideo(video.id, { busy: 'clips', job: data.jobId });
      watchJob(data.jobId, (done) => {
        patchVideo(video.id, { busy: null });
        if (done.status === 'completed') {
          const clips = done.output || [];
          patchVideo(video.id, { clips });
          setNotice(`Generated ${clips.length} clip${clips.length === 1 ? '' : 's'}`);
        } else {
          setNotice(`Clip generation failed: ${done.error || 'unknown error'}`);
        }
      });
    } catch (err) {
      setNotice(`Clip generation failed: ${err.message}`);
    }
  };

  const clipUrl = (clip) => `/clips/${clip.file_path.split('/').pop()}?token=${localStorage.getItem('token') || ''}`;

  return (
    <div className="min-h-screen">
      <nav className="frost-nav">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-bold frost-gradient-text">Clipping AI</h1>
            <div className="flex items-center space-x-4">
              <Link to="/dashboard" className="glass-btn">Dashboard</Link>
              <span className="glass-badge glass-badge-blue font-medium">Videos</span>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Upload */}
        <div className="glass-frost-blue-bg p-6">
          <h2 className="text-lg font-semibold text-white mb-3">Upload long-form video</h2>
          <p className="text-sm frost-muted mb-4">
            MP4/MOV up to 2 GB. After uploading, run analysis to detect moments, then generate clips —
            each moment is cut with ffmpeg into a 1080×1920 vertical Short.
          </p>
          <label className="glass-btn-primary cursor-pointer">
            <input type="file" accept="video/*" className="hidden" onChange={handleUpload} disabled={uploading} />
            {uploading ? 'Uploading…' : 'Choose video'}
          </label>
          {notice && (
            <p className={`mt-3 text-sm ${notice.toLowerCase().includes('fail') ? 'text-red-300' : 'text-emerald-300'}`}>
              {notice}
            </p>
          )}
        </div>

        {/* Video list */}
        {videos.length === 0 ? (
          <div className="glass-card p-6 text-center frost-muted">
            No videos in this session yet — upload one above.
            <span className="block mt-1 text-xs">Uploads live in server memory per boot, but clips can still be generated after a restart.</span>
          </div>
        ) : (
          videos.map((video) => {
            const job = video.job ? jobs[video.job] : null;
            const busy = video.busy;
            return (
              <div key={video.id} className="glass-frost-blue p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-white break-all">{video.original_filename || video.id}</h3>
                    <p className="text-sm frost-muted">
                      {video.width}×{video.height} · {fmtDuration(video.duration)}
                      {video.moments != null && ` · ${video.moments} moments`}
                      {video.clips.length > 0 && ` · ${video.clips.length} clips`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => runAnalyze(video)}
                      disabled={Boolean(busy)}
                      className="glass-btn"
                    >
                      {busy === 'analyze' ? 'Analyzing…' : 'Analyze'}
                    </button>
                    <button
                      onClick={() => runGenerateClips(video)}
                      disabled={Boolean(busy)}
                      className="glass-btn-primary"
                    >
                      {busy === 'clips' ? 'Generating…' : 'Generate clips'}
                    </button>
                  </div>
                </div>

                {job && (job.status === 'processing' || job.status === 'queued') && (
                  <div className="mt-4 space-y-1">
                    <ProgressBar progress={job.progress} />
                    <p className="text-xs frost-muted">
                      {busy === 'clips' ? 'Cutting clips with ffmpeg…' : 'Analyzing moments…'} {job.progress || 0}%
                    </p>
                  </div>
                )}
                {job && job.status === 'failed' && (
                  <p className="mt-4 text-sm text-red-300">Failed: {job.error || 'unknown error'}</p>
                )}

                {video.clips.length > 0 && (
                  <div className="mt-5 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {video.clips.map((clip) => (
                      <div key={clip.id} className="frost-video">
                        <video
                          controls
                          preload="metadata"
                          playsInline
                          className="w-full aspect-[9/16] bg-black"
                          src={clipUrl(clip)}
                        />
                        <div className="p-2">
                          <p className="text-xs frost-muted">
                            {fmtDuration(clip.duration)} · {fmtBytes(clip.file_size)}
                          </p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-xs frost-muted">hook {Math.round((clip.hook_score || 0) * 100)}%</span>
                            <a
                              href={clipUrl(clip)}
                              download={`${clip.id}.mp4`}
                              className="text-xs text-blue-300 hover:text-blue-200 underline underline-offset-4"
                            >
                              Download
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
