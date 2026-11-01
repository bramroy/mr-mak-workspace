import { useEffect, useState } from 'react'
import { api, onServiceEvent, reportError } from './client'

export interface BobTab {
  id: string; type: 'browser'; provider: 'chatgpt'; name: string; url: string
  pinned: boolean; group: string | null; tabOrder: number; open: boolean
  createdAt: string; updatedAt: string
}
interface TabState { tabs: BobTab[]; selectedId: string | null }
interface Bridge { postMessage: (message: object) => void }
declare global { interface Window { chrome?: { webview?: Bridge } } }
export const bobNative = (message: object) => window.chrome?.webview?.postMessage(message)

export function useBobTabs() {
  const [state, setState] = useState<TabState>({ tabs: [], selectedId: null })
  const [showBob, setShowBob] = useState(() => localStorage.getItem('mrmak.bobActive') === '1')
  useEffect(() => {
    api<TabState>('/browser-tabs').then(setState).catch(reportError)
    return onServiceEvent(event => {
      if (event.type === 'browser-tabs') {
        const next = event as typeof event & { tabs: BobTab[]; selectedId: string | null }
        setState({ tabs: next.tabs, selectedId: next.selectedId })
      }
    })
  }, [])
  const selected = showBob ? state.tabs.find(item => item.open && item.id === state.selectedId) || null : null
  const leave = () => { setShowBob(false); localStorage.setItem('mrmak.bobActive','0'); bobNative({ type: 'bob-hide' }) }
  const choose = (id: string) => {
    api('/browser-tabs/' + id + '/select', {}).then(() => { setShowBob(true); localStorage.setItem('mrmak.bobActive','1') }).catch(reportError)
  }
  const create = async (name: string, url: string, group: string | null) => {
    const tab = await api<BobTab>('/browser-tabs', { name: name || 'Bob', url: url || 'https://chatgpt.com/', group })
    choose(tab.id)
  }
  const close = (id: string) => {
    if (selected?.id === id) leave()
    bobNative({ type: 'bob-close', id })
    api('/browser-tabs/' + id, {}, 'DELETE').catch(reportError)
  }
  const patch = (id: string, data: object) => api('/browser-tabs/' + id, data, 'PATCH').catch(reportError)
  const reopen = (id: string) => api('/browser-tabs/' + id + '/reopen', {}).then(() => choose(id)).catch(reportError)
  return { ...state, selected, leave, choose, create, close, patch, reopen }
}
