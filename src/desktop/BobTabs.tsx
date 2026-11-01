import { useEffect, useRef, useState } from 'react'
import { api, onServiceEvent, reportError } from './client'
import { Icon } from './Icons'
import { bobNative, hasBobNative, type BobTab } from './bobSessionState'

export function BobTabStrip({ tabs, selectedId, choose, close, patch }: {
  tabs: BobTab[]; selectedId: string | null; choose: (id: string) => void
  close: (id: string) => void; patch: (id: string, data: object) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  return <div className="bob-tabs" role="group" aria-label="ChatGPT browser tabs">
    {tabs.filter(item => item.open).sort((a,b) => Number(b.pinned)-Number(a.pinned) || a.tabOrder-b.tabOrder).map(tab =>
      <div className={'chat-tab bob-tab ' + (selectedId===tab.id ? 'selected' : '')} key={tab.id}>
        {editing === tab.id ? <form onSubmit={event => {event.preventDefault();patch(tab.id,{name});setEditing(null)}}>
          <input value={name} onChange={event => setName(event.target.value)} aria-label="Rename Bob tab" maxLength={100} autoFocus/>
          <button type="submit">Save</button></form> :
          <button className="chat-tab-select" role="tab" aria-selected={selectedId===tab.id} onClick={() => choose(tab.id)} onDoubleClick={() => {setEditing(tab.id);setName(tab.name)}} title={tab.url}>
            <Icon name="message-circle" size={13}/><span className="chat-tab-name">{tab.name}</span>{tab.pinned && <Icon name="pin" size={11}/>}
          </button>}
        <button className="chat-tab-close" onClick={() => patch(tab.id, {pinned:!tab.pinned})} aria-label={tab.pinned ? 'Unpin Bob tab' : 'Pin Bob tab'}><Icon name="pin" size={12}/></button>
        <button className="chat-tab-close" onClick={() => close(tab.id)} aria-label={'Close '+tab.name}><Icon name="close" size={12}/></button>
      </div>)}
  </div>
}

interface BobQuestion { id: string; title: string; question: string; status: string }
export function BobBrowserPanel({ tab, tabs, patch, suspended }: {tab: BobTab; tabs: BobTab[]; patch: (id: string, data: object) => void; suspended: boolean}) {
  const region = useRef<HTMLDivElement>(null)
  const [questions,setQuestions] = useState<BobQuestion[]>([])
  const [inbox,setInbox] = useState(false)
  const nativeAvailable = hasBobNative()
  const refresh = () => api<{questions:BobQuestion[]}>('/bob-questions').then(result => setQuestions(result.questions)).catch(reportError)
  useEffect(() => {refresh();return onServiceEvent(event => {if(event.type==='bob-questions')refresh()})},[])
  useEffect(() => {
    if (suspended) { bobNative({ type: "bob-hide" }); return }
    const update = () => {
      const element = region.current
      if (!element) return
      const r=element.getBoundingClientRect()
      bobNative({type:'bob-select',id:tab.id,tabs:tabs.filter(item=>item.open).map(item=>({id:item.id,url:item.url})),
        rect:{x:Math.round(r.x),y:Math.round(r.y),width:Math.round(r.width),height:Math.round(r.height)}})
    }
    const observer=new ResizeObserver(update)
    if(region.current)observer.observe(region.current)
    update()
    window.addEventListener('resize',update)
    const changed=(event: Event) => {
      const data=(event as CustomEvent<{id:string;url:string}>).detail
      if(data?.id===tab.id && data.url!==tab.url && data.url.startsWith('https://chatgpt.com/')) patch(data.id,{url:data.url})
    }
    window.addEventListener('bob-webview-url',changed)
    return () => { observer.disconnect();window.removeEventListener('resize',update);window.removeEventListener('bob-webview-url',changed);bobNative({type:'bob-hide'}) }
  },[tab.id,tab.url,tabs,patch,suspended])
  return <div className="bob-view">
    <div className="bob-view-heading"><strong><Icon name="message-circle" size={15}/>{tab.name}</strong>
      <button onClick={() => {setInbox(!inbox);if(!inbox)refresh()}}><Icon name="inbox" size={14}/> Ask Bob inbox {questions.length ? '('+questions.length+')':''}</button></div>
    {inbox && <div className="bob-questions"><strong>Review the coordinator's question before sending it</strong>
      {!questions.length && <p>No questions waiting.</p>}
      {questions.map(q=><div key={q.id}><b>{q.title}</b><textarea readOnly rows={3} value={q.question} aria-label={q.title}/>
        <button onClick={() => navigator.clipboard.writeText(q.question).catch(reportError)}>Copy</button>
        <button onClick={() => api('/bob-questions/'+q.id+'/dismiss',{}).then(refresh).catch(reportError)}>Dismiss</button></div>)}
      <button onClick={() => setInbox(false)}>Close inbox</button></div>}
    <div className="bob-native-region" ref={region}>
      {!nativeAvailable && <div className="bob-browser-fallback"><strong>Native ChatGPT pane not attached to this browser.</strong>
        <p>The Bob conversation is saved, but this standalone browser can't embed ChatGPT.</p>
        <a href={tab.url} target="_blank" rel="noopener noreferrer">Open {tab.name} in browser</a></div>}
    </div>
  </div>
}
