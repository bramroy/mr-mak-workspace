import { useCallback, useEffect, useState } from 'react'
import { api, onServiceEvent } from './client'
import { Icon } from './Icons'
import type { CoordinatorIdentity } from './types'
import './coordinator.css'

type Check = { name: string; result: 'PASS' | 'FAIL' | 'NOT RUN' }
type Receipt = { sha: string; link: string | null; checks: Check[]; verified: boolean; verifyError: string | null; disagreements: { name: string; reported: string; github: string }[]; negativeSeenFailing: boolean; note: string | null; at: string }
type Verdict = { verifier: string; sha: string; result: 'PASS' | 'FAIL' | 'NOT RUN'; note: string | null; at: string }
type Assignment = {
  id: string; title: string; intent: string; owner: string; dispatcher: string; status: string; repo: string | null; branch: string | null; link: string | null
  proof?: boolean; stalled?: { reason: string } | null; receipts: Receipt[]; verdicts: Verdict[]; handoff: { to: string; from: string; accepted?: string } | null
}
type Gate = { name: string; ok: boolean; detail: string }
type Snapshot = { dispatcher: string; readOnly: string | null; identity: CoordinatorIdentity | null; gates: Gate[]; charter: string; open: Assignment[]; closed: Assignment[] }
const statusLabel: Record<string, string> = { assigned: 'Assigned', receipted: 'Receipt in', verified: 'Verdict in', closed: 'Closed' }
const short = (sha: string) => sha.slice(0, 8)
const tone = (result: string) => result === 'PASS' ? 'pass' : result === 'FAIL' ? 'fail' : 'notrun'

// The coordinator's durable record, read-only here: who owns what, which commit each receipt names, and what has
// and has not been proved. Closing a task is the coordinator's act and it is refused unless the proof is complete.
export default function CoordinatorPanel({ onClose }: { onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [error, setError] = useState('')
  const refresh = useCallback(async () => {
    try { setSnapshot(await api<Snapshot>('/coordinator/assignments')); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
  }, [])
  useEffect(() => {
    void Promise.resolve().then(refresh)
    return onServiceEvent(event => { if (event.type === 'assignments' || event.type === 'coordinator-state') void refresh() })
  }, [refresh])
  const identity = snapshot?.identity
  const [approving, setApproving] = useState(false)
  const approve = async () => { setApproving(true); try { await api('/coordinator/cutover', {}); await refresh() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) } finally { setApproving(false) } }
  const others = snapshot?.gates.filter(gate => gate.name !== 'owner') || []
  return <div className="files-panel coordinator-panel"><header><h2>Coordinator</h2><div>
    <button className="desk-icon" onClick={() => void refresh()} title="Refresh" aria-label="Refresh coordinator"><Icon name="refresh" size={15} /></button>
    <button className="desk-icon" onClick={onClose} aria-label="Close coordinator"><Icon name="close" size={17} /></button>
  </div></header>
    <div className="coord-summary" data-testid="coordinator-summary">
      <strong>{identity ? (identity.provider === 'claude' ? 'Claude' : 'Codex') : 'Coordinator'}{identity?.observed ? ` · ${identity.observed}` : identity?.requested ? ` · ${identity.requested} (not reported yet)` : ''}</strong>
      <p>Dispatcher <code>{snapshot?.dispatcher || '…'}</code>. One dispatcher per task; a task moves only when the other side accepts.</p>
    </div>
    <div className="coord-scroll">
      {snapshot?.readOnly && <p className="coord-warn" role="alert" data-testid="coordinator-readonly">Read only: {snapshot.readOnly}. Only one Mr. Mak process dispatches for this folder.</p>}
      {snapshot && <section className="coord-gates" aria-label="Cutover gates" data-testid="coordinator-gates"><h3>Cutover from the old dispatcher</h3>
        <ul>{snapshot.gates.map(gate => <li key={gate.name}><span className={`coord-result ${gate.ok ? 'pass' : 'notrun'}`}>{gate.ok ? 'PASS' : 'NOT YET'}</span> {gate.detail}</li>)}</ul>
        {!snapshot.gates.find(gate => gate.name === 'owner')?.ok && <button className="desk-secondary" disabled={approving || !others.every(gate => gate.ok) || !!snapshot.readOnly} onClick={() => void approve()}>Approve cutover</button>}
        <p className="coord-meta">Until all three pass, the coordinator may run only a proof task.</p></section>}
      {error && <p className="desk-error-inline" role="alert">{error}</p>}
      {snapshot && !snapshot.open.length && <p className="coord-empty">No open assignments.</p>}
      {snapshot?.open.map(task => {
        const receipt = task.receipts[task.receipts.length - 1], verdict = receipt ? task.verdicts.filter(item => item.sha === receipt.sha).slice(-1)[0] : undefined
        return <article className="coord-task" key={task.id} data-task-id={task.id}>
          <div className="coord-task-title"><h3>{task.title}</h3><span className={`coord-status ${task.status}`}>{task.proof ? 'Proof · ' : ''}{task.stalled ? 'Stalled' : statusLabel[task.status] || task.status}</span></div>
          {task.stalled && <p className="coord-warn">Stalled: {task.stalled.reason}</p>}
          <p className="coord-intent">“{task.intent}”</p>
          <p className="coord-meta">Owner <b>{task.owner}</b>{task.repo ? <> · {task.repo}</> : null}{task.branch ? <> · {task.branch}</> : null}</p>
          <p className="coord-meta">Dispatcher <code>{task.dispatcher}</code>{task.dispatcher === snapshot.dispatcher ? ' (this coordinator)' : ''}{task.handoff && !task.handoff.accepted ? ` · handing to ${task.handoff.to}` : ''}</p>
          {receipt ? <div className="coord-proof"><p>Receipt <code>{short(receipt.sha)}</code> · <span className={receipt.verified ? 'coord-ok' : 'coord-warn'}>{receipt.verified ? 'checks verified on GitHub' : 'not verified on GitHub'}</span>{receipt.link && <> · <a href={receipt.link} target="_blank" rel="noreferrer">open</a></>}</p>
            <ul>{receipt.checks.map((check: Check) => <li key={check.name}><span className={`coord-result ${tone(check.result)}`}>{check.result}</span> {check.name}</li>)}</ul>
            {!receipt.verified && receipt.verifyError && <p className="coord-warn">{receipt.verifyError}</p>}
            {receipt.disagreements.length > 0 && <p className="coord-warn">The worker reported {receipt.disagreements.map(item => `${item.name} ${item.reported}`).join(', ')}; GitHub says {receipt.disagreements.map(item => item.github).join(', ')}.</p>}
            <p className={receipt.negativeSeenFailing ? 'coord-ok' : 'coord-warn'}>{receipt.negativeSeenFailing ? 'A negative case was seen failing.' : 'No negative case seen failing yet.'}</p>
            <p className={verdict ? (verdict.result === 'PASS' ? 'coord-ok' : 'coord-warn') : 'coord-warn'}>{verdict ? `Independent verdict ${verdict.result} by ${verdict.verifier} on ${short(verdict.sha)}` : 'No independent verdict on this commit.'}</p></div>
            : <p className="coord-warn">No receipt yet.</p>}
          {task.link && <p className="coord-meta"><a href={task.link} target="_blank" rel="noreferrer">GitHub task</a></p>}
        </article>
      })}
      {!!snapshot?.closed.length && <details className="coord-closed"><summary>{snapshot.closed.length} closed</summary>{snapshot.closed.map(task => <p key={task.id}>{task.title}</p>)}</details>}
      <details className="coord-charter"><summary>Charter</summary><pre>{snapshot?.charter}</pre></details>
    </div>
    <footer className="mcp-footer"><p>This record lives on this computer. GitHub holds the task and the proof; the links above open them.</p></footer>
  </div>
}
