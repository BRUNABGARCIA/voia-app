import {useEffect,useId,useLayoutEffect,useRef,useState,type KeyboardEvent,type ClipboardEvent} from 'react';
import {createPortal} from 'react-dom';
import type {ItemPlanilha} from '../../shared/planilhas';
import type {ResultadoCatalogo} from '../../shared/bases-servicos';
import {normalizarBusca} from '../../shared/planilhas';
import {precoSugestao} from '../lib/preco-sugestao-servico';
import './servico-autocomplete.css';

type Props={item:ItemPlanilha;label:string;cell:string;endpoint:string;disabled:boolean;onCommit:(s:string)=>void;onSelect:(r:ResultadoCatalogo)=>void;onKeyDown:(e:KeyboardEvent<HTMLInputElement>)=>void;onPaste:(e:ClipboardEvent<HTMLInputElement>)=>void};
export default function ServicoAutocomplete({item,label,cell,endpoint,disabled,onCommit,onSelect,onKeyDown,onPaste}:Props){
 const [text,setText]=useState(item.servico),[open,setOpen]=useState(false),[rows,setRows]=useState<ResultadoCatalogo[]>([]),[state,setState]=useState<'buscando'|'pronto'|'erro'>('pronto'),[active,setActive]=useState(-1),[position,setPosition]=useState<{top:number;left:number;width:number;maxHeight:number;transform?:string}|null>(null);
 const input=useRef<HTMLInputElement>(null),popup=useRef<HTMLDivElement>(null),seq=useRef(0),id=useId();
 useEffect(()=>{setText(item.servico);setOpen(false);},[item.servico]);
 const q=normalizarBusca(text).trim().replace(/\s+/g,' ').slice(0,150);
 useEffect(()=>{
  const request=++seq.current,controller=new AbortController();setRows([]);setActive(-1);
  if(!open||q.length<2||disabled)return()=>controller.abort();setState('buscando');
  const timer=setTimeout(async()=>{try{const r=await fetch(endpoint+'?'+new URLSearchParams({q,limite:'12',priorizar_grupo:item.grupo}),{credentials:'same-origin',signal:controller.signal});if(!r.ok)throw Error('Busca indisponível');const data=await r.json();if(!controller.signal.aborted&&seq.current===request){setRows(data.resultados.slice(0,12));setState('pronto');}}catch{if(!controller.signal.aborted&&seq.current===request)setState('erro');}},250);
  return()=>{clearTimeout(timer);controller.abort();};
 },[open,q,endpoint,item.grupo,disabled]);
 useLayoutEffect(()=>{
  if(!open||q.length<2)return;function place(){const el=input.current;if(!el)return;const r=el.getBoundingClientRect(),v=window.visualViewport,leftBound=v?.offsetLeft??0,topBound=v?.offsetTop??0,w=v?.width??window.innerWidth,h=v?.height??window.innerHeight,grid=el.closest('.planilha-grid-wrap')?.getBoundingClientRect();
   if(r.bottom<=topBound||r.top>=topBound+h||r.right<=leftBound||r.left>=leftBound+w||(grid&&(r.bottom<=grid.top||r.top>=grid.bottom))){setOpen(false);return;}
   const below=topBound+h-r.bottom-8,above=r.top-topBound-8,up=below<200&&above>below,maxHeight=Math.max(20,Math.min(320,up?above:below)),width=Math.min(Math.max(r.width,420),w-16),left=Math.max(leftBound+8,Math.min(r.left,leftBound+w-width-8)),top=up?r.top-4:r.bottom+4;setPosition({top:Math.max(topBound+8,top),left,width,maxHeight,transform:up?'translateY(-100%)':undefined});
  }place();window.addEventListener('resize',place);window.addEventListener('scroll',place,true);window.visualViewport?.addEventListener('resize',place);window.visualViewport?.addEventListener('scroll',place);return()=>{window.removeEventListener('resize',place);window.removeEventListener('scroll',place,true);window.visualViewport?.removeEventListener('resize',place);window.visualViewport?.removeEventListener('scroll',place);};
 },[open,q]);
 useEffect(()=>{if(active>=0)popup.current?.querySelector(`[data-option="${active}"]`)?.scrollIntoView?.({block:'nearest'});},[active]);
 function choose(r:ResultadoCatalogo){setOpen(false);setText(r.descricao.slice(0,300));onSelect(r);}
 function keyboard(e:KeyboardEvent<HTMLInputElement>){if(e.nativeEvent.isComposing)return;if(open&&q.length>=2){if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);return;}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();e.stopPropagation();if(rows.length)setActive(n=>e.key==='ArrowDown'?(n+1)%rows.length:n<=0?rows.length-1:n-1);return;}if(e.key==='Enter'&&active>=0&&rows[active]){e.preventDefault();e.stopPropagation();choose(rows[active]);return;}if(e.key==='Tab'||e.key==='Enter')setOpen(false);}onKeyDown(e);}
 const ref=item.referencia_origem,alterado=!!ref&&text!==ref.descricao.slice(0,300);
 const pendente=ref?.tipo_base==='SINAPI'&&ref.preco_centavos===null&&!ref.regime_escolhido||!!ref?.sicro&&!ref.custo_sicro_escolhido;
 return <><input ref={input} aria-label={label} role="combobox" aria-autocomplete="list" aria-expanded={open&&q.length>=2} aria-controls={id} aria-activedescendant={active>=0&&open?`${id}-${active}`:undefined} data-cell={cell} disabled={disabled} value={text} onChange={e=>{++seq.current;setRows([]);setActive(-1);setText(e.target.value);setOpen(true);}} onBlur={()=>{setOpen(false);if(text!==item.servico)onCommit(text);}} onKeyDown={keyboard} onPaste={e=>{setOpen(false);onPaste(e);}}/>
 {ref&&<small className={'servico-ref'+(alterado?' servico-ref-alterada':'')} title={alterado?'Texto alterado; referência anterior preservada. Selecione outra sugestão para trocar a referência.':`${ref.tipo_base??'VOIA'} · ${ref.codigo} · ${ref.competencia} · ${ref.uf}`} aria-label={alterado?'Texto alterado; referência anterior preservada':undefined}>{alterado?'Texto alterado · referência preservada':`${ref.tipo_base??'VOIA'} · ${ref.codigo}${pendente?' · escolher regime/custo no detalhe':''}`}</small>}
 {open&&q.length>=2&&position&&createPortal(<div ref={popup} className="servico-sugestoes" style={position} onPointerDown={e=>{if(e.button===0)e.preventDefault();}}><div role="listbox" id={id} aria-label="Sugestões de serviços">{state==='pronto'&&rows.map((r,n)=><button type="button" role="option" aria-selected={n===active} id={`${id}-${n}`} data-option={n} key={`${r.fonte}-${r.id}`} tabIndex={-1} onPointerMove={()=>setActive(n)} onClick={()=>choose(r)}><span className="servico-sugestao-fonte">{r.tipo_base} · {r.codigo}</span><strong>{r.descricao}</strong><small>{r.unidade} · {r.uf||'Região não informada'}{r.competencia?' · '+r.competencia:''}</small><small>Ref. {precoSugestao(r,ref?.regime_escolhido)}</small></button>)}</div>{state==='buscando'?<p role="status">Buscando…</p>:state==='erro'?<p role="status">Erro ao buscar serviços. Continue com texto manual.</p>:!rows.length?<p role="status">Nenhum serviço encontrado. Continue com texto manual.</p>:<p className="servico-sugestoes-ajuda">Até 12 resultados · ↑ ↓ navegar · Enter selecionar · Esc fechar</p>}</div>,document.body)}
 </>;
}
